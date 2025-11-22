import { GoogleGenerativeAI } from '@google/generative-ai';
import * as core from '@actions/core';
import {
  initGeminiClient,
  initGitHubClient,
  getPRContext,
  getChangedFiles,
  getFileContents,
  filterCodeFiles,
} from './utils';

interface ReviewIssue {
  file: string;
  line: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  category: 'type-safety' | 'tailwind' | 'security' | 'other';
}

async function reviewCodeWithGemini(
  gemini: GoogleGenerativeAI,
  filePath: string,
  fileContent: string
): Promise<ReviewIssue[]> {
  const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `You are a senior code reviewer for a TypeScript/React/Next.js project using Tailwind CSS and shadcn/ui components.

Review the following code file for these specific issues:

1. **Type Safety**: 
   - Any usage of \`any\` type (should be explicit types)
   - Unsafe type casting (e.g., \`as unknown\`, \`as any\`)
   - Missing type annotations where they should be explicit

2. **Tailwind/Shadcn Patterns**:
   - Conflicting utility classes (e.g., \`p-4 p-8\` - both padding classes)
   - Accessibility violations in JSX (missing aria labels, improper semantic HTML)
   - Incorrect shadcn component usage patterns

3. **Security**:
   - Potential injection points in API routes or server-side code
   - Unsafe string concatenation in SQL-like contexts
   - Missing input validation

For each issue found, provide a JSON array with this exact structure:
[
  {
    "line": <line_number>,
    "severity": "error" | "warning" | "info",
    "message": "<clear description>",
    "category": "type-safety" | "tailwind" | "security" | "other"
  }
]

If no issues are found, return an empty array: []

File path: ${filePath}
File content:
\`\`\`typescript
${fileContent}
\`\`\`

Respond ONLY with valid JSON, no markdown, no explanations.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Clean up the response - remove markdown code blocks if present
    let jsonText = text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText
        .replaceAll(/^```(?:json)?\n?/gm, '')
        .replaceAll(/```$/gm, '')
        .trim();
    }

    const issues: ReviewIssue[] = JSON.parse(jsonText);

    // Add file path to each issue
    return issues.map((issue) => ({
      ...issue,
      file: filePath,
    }));
  } catch (error) {
    core.warning(`Failed to review ${filePath}: ${error}`);
    return [];
  }
}

async function postReviewComments(
  octokit: ReturnType<typeof initGitHubClient>,
  owner: string,
  repo: string,
  prNumber: number,
  issues: ReviewIssue[]
): Promise<void> {
  if (issues.length === 0) {
    core.info('No issues found. Creating a success comment.');
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: '✅ **Gemini Code Review**: No issues detected in this PR.',
    });
    return;
  }

  // Group issues by file
  const issuesByFile = new Map<string, ReviewIssue[]>();
  for (const issue of issues) {
    if (!issuesByFile.has(issue.file)) {
      issuesByFile.set(issue.file, []);
    }
    issuesByFile.get(issue.file)!.push(issue);
  }

  // Post inline comments for each file
  for (const [file, fileIssues] of Array.from(issuesByFile.entries())) {
    const body = `## 🔍 Code Review Issues in \`${file}\`

${fileIssues
  .map(
    (issue) => `- **Line ${issue.line}** (${issue.severity}): ${issue.message} [${issue.category}]`
  )
  .join('\n')}`;

    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
  }
}

async function main(): Promise<void> {
  try {
    core.info('Starting Gemini code review...');

    const gemini = initGeminiClient();
    const octokit = initGitHubClient();
    const prContext = getPRContext();

    core.info(`Reviewing PR #${prContext.prNumber} in ${prContext.owner}/${prContext.repo}`);

    // Get changed files
    const allFiles = await getChangedFiles(
      octokit,
      prContext.owner,
      prContext.repo,
      prContext.prNumber
    );
    const codeFiles = filterCodeFiles(allFiles);

    if (codeFiles.length === 0) {
      core.info('No TypeScript/TSX files changed in this PR.');
      process.exit(0);
    }

    core.info(`Found ${codeFiles.length} code files to review`);

    // Review each file
    const allIssues: ReviewIssue[] = [];
    for (const file of codeFiles) {
      core.info(`Reviewing ${file.filename}...`);

      // Get file content from head commit
      const content = await getFileContents(
        octokit,
        prContext.owner,
        prContext.repo,
        file.filename,
        prContext.headSha
      );

      if (!content) {
        core.warning(`Could not fetch content for ${file.filename}`);
        continue;
      }

      const issues = await reviewCodeWithGemini(gemini, file.filename, content);
      allIssues.push(...issues);
    }

    // Post review comments
    await postReviewComments(
      octokit,
      prContext.owner,
      prContext.repo,
      prContext.prNumber,
      allIssues
    );

    core.info(`Review complete. Found ${allIssues.length} issues.`);
  } catch (error) {
    core.setFailed(`Code review failed: ${error}`);
    process.exit(1);
  }
}

main();
