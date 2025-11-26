import { GoogleGenerativeAI } from '@google/generative-ai';
import * as core from '@actions/core';
import {
  initGeminiClient,
  initGitHubClient,
  getPRContext,
  getChangedCodeFiles,
  getFileContents,
  prepareForPrompt,
} from './utils';
import { z } from 'zod';

interface ReviewIssue {
  file: string;
  line: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  category: 'type-safety' | 'tailwind' | 'security' | 'other';
}

interface ReviewResult {
  /**
   * Indicates whether the review completed successfully for this file.
   *
   * Note: This function is intentionally "best effort" and will **never throw** for
   * expected model / parsing issues. Instead, callers should rely on this flag and
   * the `issues` array. This differs from the test-scaffolding flow, where generation
   * errors are allowed to propagate so that invalid scaffolds cannot be silently used.
   */
  success: boolean;
  issues: ReviewIssue[];
}

const reviewIssueArraySchema = z.array(
  z.object({
    line: z.number(),
    severity: z.enum(['error', 'warning', 'info']),
    message: z.string(),
    category: z.enum(['type-safety', 'tailwind', 'security', 'other']),
  })
);

async function reviewCodeWithGemini(
  gemini: GoogleGenerativeAI,
  filePath: string,
  fileContent: string
): Promise<ReviewResult> {
  const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const safeFilePath: string = prepareForPrompt(filePath);
  const safeFileContent: string = prepareForPrompt(fileContent);

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

    // Clean up the response - remove a single outer markdown code block wrapper if present
    let jsonText = text.trim();
    if (jsonText.startsWith('```')) {
      // Support optional language tag, e.g. ```json
      const firstNewlineIndex: number = jsonText.indexOf('\n');
      const openingFenceEnd: number =
        firstNewlineIndex === -1 ? jsonText.length : firstNewlineIndex + 1;

      // Look for the last closing fence; this ensures we only strip a single outer wrapper
      const closingFenceStart: number = jsonText.lastIndexOf('```');

      if (closingFenceStart > openingFenceEnd) {
        jsonText = jsonText.slice(openingFenceEnd, closingFenceStart).trim();
      }
    }

    try {
      const issuesWithoutFile = reviewIssueArraySchema.parse(JSON.parse(jsonText));

      // Add file path to each issue
      const issuesWithFile: ReviewIssue[] = issuesWithoutFile.map((issue) => ({
        ...issue,
        file: filePath,
      }));

      return {
        success: true,
        issues: issuesWithFile,
      };
    } catch (parseError: unknown) {
      const message: string = parseError instanceof Error ? parseError.message : String(parseError);
      core.warning(`Failed to parse review response for ${filePath}: ${message}`);
      return {
        success: false,
        issues: [],
      };
    }
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : String(error);
    core.warning(`Failed to review ${filePath}: ${message}`);
    return {
      success: false,
      issues: [],
    };
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
    } catch (error: unknown) {
      const message: string = error instanceof Error ? error.message : String(error);
      core.warning(`Failed to post comment for ${file}: ${message}`);
    }
  }
}

async function run(): Promise<void> {
  try {
    core.info('Starting Gemini code review...');

    const gemini = initGeminiClient();
    const octokit = initGitHubClient();
    const prContext = getPRContext();

    core.info(`Reviewing PR #${prContext.prNumber} in ${prContext.owner}/${prContext.repo}`);

    // Get changed TypeScript/TSX code files once for this review run
    const codeFiles = await getChangedCodeFiles(
      octokit,
      prContext.owner,
      prContext.repo,
      prContext.prNumber
    );

    if (codeFiles.length === 0) {
      core.info('No TypeScript/TSX files changed in this PR.');
      return;
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

      if (content === null) {
        core.warning(`Could not fetch content for ${file.filename}`);
        continue;
      }

      const reviewResult = await reviewCodeWithGemini(gemini, file.filename, content);

      if (!reviewResult.success) {
        core.warning(
          `Gemini review failed for ${file.filename}; treating as "no issues reported" for this file.`
        );
        continue;
      }

      allIssues.push(...reviewResult.issues);
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
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : String(error);
    core.setFailed(`Code review failed: ${message}`);
  }
}

run().catch((error: unknown) => {
  const message: string = error instanceof Error ? error.message : String(error);
  core.setFailed(`Unhandled error: ${message}`);
  process.exit(1);
});
