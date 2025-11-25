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

function sanitizeForPrompt(value: string): string {
  // Start with basic structural safety; avoid brittle pattern-based "injection" filters
  // and rely on the model's own safety mechanisms instead.
  let sanitized: string = value
    // Break markdown code fences so they can't interfere with our prompt structure.
    .replaceAll('```', '``\u200b`')
    // Remove any null characters that could affect parsing.
    .replaceAll('\u0000', '')
    // Normalize newlines to reduce ambiguity.
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n');

  // Hard-cap maximum length to avoid extremely large prompts and reduce attack surface.
  const MAX_CONTENT_LENGTH: number = 40_000;
  if (sanitized.length > MAX_CONTENT_LENGTH) {
    sanitized = `${sanitized.slice(0, MAX_CONTENT_LENGTH)}\n\n[truncated user-controlled content]`;
  }

  return sanitized;
}

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

  const safeFilePath: string = sanitizeForPrompt(filePath);
  const safeFileContent: string = sanitizeForPrompt(fileContent);

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

File path: ${safeFilePath}
File content:
\`\`\`typescript
${safeFileContent}
\`\`\`

Respond with valid JSON as the only content. You may optionally wrap it in a \`\`\`json\`\`\` code block, but do not include any additional commentary or text.`;

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

    try {
      const issues: ReviewIssue[] = JSON.parse(jsonText);

      // Add file path to each issue
      return issues.map((issue) => ({
        ...issue,
        file: filePath,
      }));
    } catch (parseError) {
      core.warning(`Failed to parse review response for ${filePath}: ${parseError}`);
      return [];
    }
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

    try {
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body,
      });
    } catch (error) {
      core.warning(`Failed to post comment for ${file}: ${error}`);
    }
  }
}

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
  } else {
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
  }
} catch (error) {
  core.setFailed(`Code review failed: ${error}`);
}
