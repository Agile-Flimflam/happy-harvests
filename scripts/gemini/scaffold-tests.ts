import { GoogleGenerativeAI } from '@google/generative-ai';
import * as core from '@actions/core';
import * as github from '@actions/github';
import {
  initGeminiClient,
  initGitHubClient,
  getPRContext,
  getChangedFiles,
  getFileContents,
  filterCodeFiles,
  isNewFile,
  getTestFilePath,
} from './utils';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const SAFE_PATH = '/usr/bin:/bin';
const GIT_EXECUTABLE = '/usr/bin/git';
const REPO_ROOT = process.cwd();
// Restrict PATH to fixed, typically unwritable system directories to avoid using user-controlled executables,
// but preserve a minimal set of environment variables that Git and related tooling may rely on.
const SAFE_ENV = {
  PATH: SAFE_PATH,
  NODE_ENV: process.env.NODE_ENV ?? 'production',
  HOME: process.env.HOME,
  USER: process.env.USER,
} satisfies Partial<NodeJS.ProcessEnv>;

function sanitizeForPrompt(value: string): string {
  // Structural safety for user-controlled content embedded in LLM prompts.
  return (
    value
      // Break markdown code fences so they can't interfere with our prompt structure.
      .replaceAll('```', '``\u200b`')
      // Remove any null characters that could affect parsing.
      .replaceAll('\u0000', '')
      // Normalize newlines to reduce ambiguity.
      .replace(/\r\n?/g, '\n')
  );
}

function sanitizeFileSystemPath(filePath: string): string {
  const trimmed = filePath.trim();

  // Reject obviously dangerous characters for CLI and filesystem usage.
  if (trimmed.includes('\u0000') || trimmed.includes('\n') || trimmed.includes('\r')) {
    throw new Error(`Refusing to use unsafe file path containing control characters: ${filePath}`);
  }

  // Only allow non-empty, relative paths that stay within the repository tree.
  if (!trimmed || path.isAbsolute(trimmed)) {
    throw new Error(`Refusing to use non-relative or empty file path: ${filePath}`);
  }

  // Normalize the path and ensure it stays within the repository root when resolved.
  const normalized = path.normalize(trimmed);
  const resolved = path.resolve(REPO_ROOT, normalized);
  const relativeToRepoRoot = path.relative(REPO_ROOT, resolved);

  // If the resolved path escapes the repo root, or does not point to a concrete file
  // path under the repo (e.g. ".", empty), reject it.
  if (
    !relativeToRepoRoot ||
    relativeToRepoRoot === '.' ||
    relativeToRepoRoot.startsWith('..') ||
    path.isAbsolute(relativeToRepoRoot)
  ) {
    throw new Error(
      `Refusing to use file path outside repository root: ${filePath} (resolved to ${resolved})`
    );
  }

  return relativeToRepoRoot;
}

function sanitizeGitRef(ref: string): string {
  const trimmed = ref.trim();

  // Reject obviously dangerous characters for CLI usage.
  if (trimmed.includes('\u0000') || trimmed.includes('\n') || trimmed.includes('\r')) {
    throw new Error(`Refusing to use unsafe git ref containing control characters: ${ref}`);
  }

  // Disallow refs that could be parsed as options.
  if (!trimmed || trimmed.startsWith('-')) {
    throw new Error(`Refusing to use unsafe git ref: ${ref}`);
  }

  return trimmed;
}

function isLikelyValidBranchRef(ref: string): boolean {
  const trimmed = ref.trim();
  if (!trimmed) return false;

  // Exclude common non-branch ref patterns used by GitHub.
  if (trimmed.startsWith('refs/')) return false;
  if (trimmed.startsWith('pull/')) return false;
  if (trimmed.startsWith('tags/')) return false;

  return true;
}

interface TestScaffold {
  filePath: string;
  testCode: string;
}

async function generateTestScaffold(
  gemini: GoogleGenerativeAI,
  sourceFilePath: string,
  sourceCode: string
): Promise<string> {
  const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const safeSourceFilePath: string = sanitizeForPrompt(sourceFilePath);
  const safeSourceCode: string = sanitizeForPrompt(sourceCode);

  const prompt = `You are a test generator for a TypeScript/React/Next.js project using Jest and @testing-library/react.

Generate a comprehensive test suite for the following source file. Follow these patterns:

**Testing Library Setup:**
- Use Jest with @testing-library/react and @testing-library/jest-dom
- Import from '@testing-library/react' for React components
- Use \`describe\` blocks to group related tests
- Use \`it\` or \`test\` for individual test cases
- Use \`beforeEach\` for setup when needed

**Test Structure:**
- For utility functions: Test all exported functions with various inputs, edge cases, and error conditions
- For React components: Test rendering, user interactions, props handling, and accessibility
- Use descriptive test names that explain what is being tested
- Group related tests in \`describe\` blocks

**Import Patterns:**
- Use path aliases: \`@/\` maps to \`src/\`
- Example: \`import { functionName } from '@/lib/utils'\`

**Example Test Patterns:**

For utility functions:
\`\`\`typescript
import { functionName } from './source-file';

describe('functionName', () => {
  it('should handle normal case', () => {
    expect(functionName(input)).toBe(expected);
  });

  it('should handle edge case', () => {
    expect(functionName(edgeInput)).toBe(expected);
  });
});
\`\`\`

For React components:
\`\`\`typescript
import { render, screen } from '@testing-library/react';
import { ComponentName } from './source-file';

describe('ComponentName', () => {
  it('should render correctly', () => {
    render(<ComponentName />);
    expect(screen.getByText(/expected text/i)).toBeInTheDocument();
  });

  it('should handle user interactions', () => {
    // Test user interactions
  });
});
\`\`\`

**Important:**
- Generate complete, runnable test code
- Include imports for all dependencies
- Test all exported functions/components
- Cover edge cases and error conditions
- Use explicit types (never use \`any\`)
- Follow the existing codebase patterns

Source file path: ${safeSourceFilePath}
Source code:
\`\`\`typescript
${safeSourceCode}
\`\`\`

Generate the complete, runnable TypeScript test file code. You may respond either with raw TypeScript test code or with a single fenced \`\`\`typescript\`\`\` code block, but do not include any non-code commentary or explanations.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Clean up the response - remove markdown code blocks if present
    let testCode = text.trim();
    if (testCode.startsWith('```')) {
      testCode = testCode
        .replaceAll(/^```(?:typescript|ts|tsx)?\n?/gm, '')
        .replaceAll(/```$/gm, '')
        .trim();
    }

    return testCode;
  } catch (error) {
    core.warning(`Failed to generate test for ${sourceFilePath}: ${error}`);
    throw error;
  }
}

async function checkTestFileExists(
  octokit: ReturnType<typeof initGitHubClient>,
  owner: string,
  repo: string,
  testPath: string,
  baseSha: string
): Promise<boolean> {
  try {
    const content = await getFileContents(octokit, owner, repo, testPath, baseSha);
    return content.length > 0;
  } catch {
    return false;
  }
}

async function resolvePRContext(octokit: ReturnType<typeof initGitHubClient>) {
  try {
    return getPRContext();
  } catch (error) {
    const prNumberFromEnv = process.env.PR_NUMBER;
    if (!prNumberFromEnv) throw error;

    const context = github.context;
    const { data: pr } = await octokit.rest.pulls.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: Number.parseInt(prNumberFromEnv, 10),
    });

    return {
      owner: context.repo.owner,
      repo: context.repo.repo,
      prNumber: Number.parseInt(prNumberFromEnv, 10),
      baseSha: pr.base.sha,
      headSha: pr.head.sha,
    };
  }
}

async function identifyFilesNeedingTests(
  octokit: ReturnType<typeof initGitHubClient>,
  prContext: { owner: string; repo: string; prNumber: number; baseSha: string }
) {
  const allFiles = await getChangedFiles(
    octokit,
    prContext.owner,
    prContext.repo,
    prContext.prNumber
  );
  const newFiles = filterCodeFiles(allFiles).filter(isNewFile);

  if (newFiles.length === 0) {
    core.info('No new TypeScript/TSX files in this PR.');
    return [];
  }

  core.info(`Found ${newFiles.length} new code files`);

  const filesNeedingTests: Array<{ sourcePath: string; testPath: string }> = [];

  for (const file of newFiles) {
    const { testPath, specPath } = getTestFilePath(file.filename);

    const [testExists, specExists] = await Promise.all([
      checkTestFileExists(octokit, prContext.owner, prContext.repo, testPath, prContext.baseSha),
      checkTestFileExists(octokit, prContext.owner, prContext.repo, specPath, prContext.baseSha),
    ]);

    if (!testExists && !specExists) {
      filesNeedingTests.push({
        sourcePath: file.filename,
        testPath,
      });
    }
  }

  return filesNeedingTests;
}

async function generateScaffolds(
  gemini: GoogleGenerativeAI,
  octokit: ReturnType<typeof initGitHubClient>,
  prContext: { owner: string; repo: string; headSha: string },
  filesNeedingTests: Array<{ sourcePath: string; testPath: string }>
): Promise<TestScaffold[]> {
  const scaffolds: TestScaffold[] = [];

  for (const { sourcePath, testPath } of filesNeedingTests) {
    core.info(`Generating test for ${sourcePath}...`);

    const sourceCode = await getFileContents(
      octokit,
      prContext.owner,
      prContext.repo,
      sourcePath,
      prContext.headSha
    );

    if (!sourceCode) {
      core.warning(`Could not fetch content for ${sourcePath}`);
      continue;
    }

    try {
      const testCode = await generateTestScaffold(gemini, sourcePath, sourceCode);
      scaffolds.push({
        filePath: testPath,
        testCode,
      });
    } catch (error) {
      core.warning(`Failed to generate test for ${sourcePath}: ${error}`);
    }
  }

  return scaffolds;
}

interface LastCommitInfo {
  author: string;
  message: string;
}

const ACTION_AUTHOR = 'github-actions[bot] <github-actions[bot]@users.noreply.github.com>';
const COMMIT_SUBJECT_PREFIX = 'test: add generated test scaffolds for ';

function getLastCommitInfo(): LastCommitInfo | null {
  try {
    // Safe usage: command and arguments are constant strings; no user-controlled data is passed here.
    const author = execFileSync(GIT_EXECUTABLE, ['log', '-1', '--pretty=format:%an <%ae>'], {
      encoding: 'utf-8',
      env: SAFE_ENV,
    }).trim();
    // Safe usage: command and arguments are constant strings; no user-controlled data is passed here.
    const message = execFileSync(GIT_EXECUTABLE, ['log', '-1', '--pretty=format:%s'], {
      encoding: 'utf-8',
      env: SAFE_ENV,
    }).trim();

    return { author, message };
  } catch (error) {
    core.warning(`Could not check last commit: ${error}`);
    return null;
  }
}

function isRepeatActionCommit(lastCommitInfo: LastCommitInfo | null): boolean {
  if (!lastCommitInfo) return false;

  return (
    lastCommitInfo.author === ACTION_AUTHOR &&
    lastCommitInfo.message.startsWith(COMMIT_SUBJECT_PREFIX)
  );
}

function writeScaffoldsToDisk(scaffolds: TestScaffold[]): void {
  for (const scaffold of scaffolds) {
    // Sanitize the relative file path before using it for any filesystem operations
    const safeRelativePath = sanitizeFileSystemPath(scaffold.filePath);
    const fullPath = path.join(process.cwd(), safeRelativePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, scaffold.testCode, 'utf-8');
    core.info(`Wrote ${scaffold.filePath}`);
  }
}

function stageScaffoldFiles(scaffolds: TestScaffold[]): void {
  const filePaths: string[] = scaffolds.map((scaffold) =>
    sanitizeFileSystemPath(scaffold.filePath)
  );
  // Use `--` to ensure paths are not interpreted as flags.
  // Safe usage: command is fixed, paths are sanitized and passed as separate arguments after `--`.
  execFileSync(GIT_EXECUTABLE, ['add', '--', ...filePaths], { stdio: 'inherit', env: SAFE_ENV });
}

function hasPendingChanges(): boolean {
  const status = execFileSync(GIT_EXECUTABLE, ['status', '--porcelain'], {
    encoding: 'utf-8',
    env: SAFE_ENV,
  });

  return Boolean(status.trim());
}

function buildCommitMessage(scaffolds: TestScaffold[]): string {
  const sanitizedFileList = scaffolds
    .map((scaffold) => scaffold.filePath.replaceAll('`', '').replaceAll('$', ''))
    .join(', ');

  return `test: add generated test scaffolds for ${scaffolds.length} file(s)

Generated by Gemini AI workflow
Files: ${sanitizedFileList}`;
}

function getPrNumberFromEnvOrContext(defaultPrNumber: number): number {
  const prNumberEnv = process.env.PR_NUMBER;
  if (!prNumberEnv) return defaultPrNumber;

  const parsed = Number.parseInt(prNumberEnv, 10);
  if (Number.isNaN(parsed)) {
    core.warning(
      `Environment variable PR_NUMBER="${prNumberEnv}" is not a valid number; falling back to default PR number ${defaultPrNumber}.`
    );
    return defaultPrNumber;
  }

  return parsed;
}

async function resolveTargetBranchForPush(
  octokit: ReturnType<typeof initGitHubClient>,
  prContext: { owner: string; repo: string; prNumber: number }
): Promise<string | null> {
  const envHeadRef = process.env.GITHUB_HEAD_REF;
  if (envHeadRef && isLikelyValidBranchRef(envHeadRef)) {
    return sanitizeGitRef(envHeadRef);
  }

  const envRefName = process.env.GITHUB_REF_NAME;
  if (envRefName && isLikelyValidBranchRef(envRefName)) {
    return sanitizeGitRef(envRefName);
  }

  // Fall back to GitHub API to resolve the PR's head branch, which works reliably
  // in workflow_dispatch mode where GITHUB_HEAD_REF may be empty and GITHUB_REF_NAME
  // may point at a detached PR ref like "pull/123/head".
  const prNumber = getPrNumberFromEnvOrContext(prContext.prNumber);

  const { data: pr } = await octokit.rest.pulls.get({
    owner: prContext.owner,
    repo: prContext.repo,
    pull_number: prNumber,
  });

  const headRef = pr.head?.ref;
  const headRepoFullName = pr.head?.repo?.full_name;
  const baseRepoFullName = `${prContext.owner}/${prContext.repo}`;

  if (headRef && headRepoFullName === baseRepoFullName && isLikelyValidBranchRef(headRef)) {
    return sanitizeGitRef(headRef);
  }

  core.info(
    'PR head is from a fork or has an unsupported ref; skipping auto-push and falling back to PR comment only.'
  );

  return null;
}

function pushToBranch(targetBranch: string): void {
  // Safe usage: repository is a fixed literal and branch name is sanitized and passed as an argument.
  execFileSync(GIT_EXECUTABLE, ['push', 'origin', targetBranch], {
    stdio: 'inherit',
    env: SAFE_ENV,
  });
  core.info(`Pushed test scaffolds to ${targetBranch}`);
}

async function createCommittedScaffoldsComment(
  octokit: ReturnType<typeof initGitHubClient>,
  prContext: { owner: string; repo: string; prNumber: number },
  scaffolds: TestScaffold[]
): Promise<void> {
  const commentBody = `## ✅ Test Scaffolding Committed

I've generated and committed test boilerplate for ${scaffolds.length} new file(s):

${scaffolds.map((s) => `- \`${s.filePath}\``).join('\n')}

**Next Steps:**
1. Review the generated tests
2. Customize them as needed
3. Run \`pnpm test\` to verify the tests pass

These are boilerplate tests - please review and enhance them based on your specific requirements.`;

  await octokit.rest.issues.createComment({
    owner: prContext.owner,
    repo: prContext.repo,
    issue_number: prContext.prNumber,
    body: commentBody,
  });
}

async function commitAndPushOrComment(
  octokit: ReturnType<typeof initGitHubClient>,
  prContext: { owner: string; repo: string; prNumber: number },
  scaffolds: TestScaffold[]
): Promise<void> {
  const commitMessage = buildCommitMessage(scaffolds);

  // Safe usage: command is fixed and commit message is constructed from trusted/static data.
  execFileSync(GIT_EXECUTABLE, ['commit', '-m', commitMessage], {
    stdio: 'inherit',
    env: SAFE_ENV,
  });

  const targetBranch = await resolveTargetBranchForPush(octokit, prContext);

  if (!targetBranch) {
    // If we cannot determine a safe branch to push to (e.g., forked PR), do not fail the job;
    // instead, provide the scaffolds via PR comment only.
    await postScaffoldsComment(octokit, prContext, scaffolds);
    return;
  }

  pushToBranch(targetBranch);
  await createCommittedScaffoldsComment(octokit, prContext, scaffolds);
}

async function commitScaffolds(
  octokit: ReturnType<typeof initGitHubClient>,
  prContext: { owner: string; repo: string; prNumber: number },
  scaffolds: TestScaffold[]
) {
  // Check if the last commit was made by this action to prevent infinite loops.
  // Uses execFileSync with fixed arguments (no untrusted input) to avoid shell injection risks.
  const lastCommitInfo = getLastCommitInfo();
  if (isRepeatActionCommit(lastCommitInfo)) {
    core.info('Last commit was made by this action. Skipping to prevent infinite loop.');
    return;
  }

  // Write files to disk and commit them
  core.info(`Writing ${scaffolds.length} test files to disk...`);
  writeScaffoldsToDisk(scaffolds);

  // Stage files
  stageScaffoldFiles(scaffolds);

  // Check if there are any changes to commit
  try {
    if (!hasPendingChanges()) {
      core.info('No changes to commit.');
      return;
    }

    await commitAndPushOrComment(octokit, prContext, scaffolds);
  } catch (error) {
    core.warning(
      `Failed to commit/push generated test scaffolds, falling back to PR comment: ${error}`
    );
    await postScaffoldsComment(octokit, prContext, scaffolds);
  }
}

async function postScaffoldsComment(
  octokit: ReturnType<typeof initGitHubClient>,
  prContext: { owner: string; repo: string; prNumber: number },
  scaffolds: TestScaffold[]
) {
  const commentBody = `## 🧪 Test Scaffolding Generated

I've generated test boilerplate for ${scaffolds.length} new file(s) that don't have corresponding test files:

${scaffolds
  .map(
    (scaffold) => `
### \`${scaffold.filePath}\`

\`\`\`typescript
${scaffold.testCode}
\`\`\`
`
  )
  .join('\n')}

**Instructions:**
1. Copy the test code above
2. Create the test file(s) in your branch
3. Review and customize the tests as needed
4. Run \`pnpm test\` to verify the tests pass

**Or:** Add the \`generate-tests\` label to this PR to automatically commit these tests.

These are boilerplate tests - please review and enhance them based on your specific requirements.`;

  await octokit.rest.issues.createComment({
    owner: prContext.owner,
    repo: prContext.repo,
    issue_number: prContext.prNumber,
    body: commentBody,
  });
}

try {
  core.info('Starting test scaffolding...');

  const gemini = initGeminiClient();
  const octokit = initGitHubClient();
  const prContext = await resolvePRContext(octokit);

  core.info(`Scaffolding tests for PR #${prContext.prNumber}`);

  const filesNeedingTests = await identifyFilesNeedingTests(octokit, prContext);

  if (filesNeedingTests.length === 0) {
    core.info('All new files already have corresponding test files.');
  } else {
    core.info(`Generating test scaffolds for ${filesNeedingTests.length} files`);

    const scaffolds = await generateScaffolds(gemini, octokit, prContext, filesNeedingTests);

    if (scaffolds.length === 0) {
      core.info('No test scaffolds generated.');
    } else {
      core.info(`Processed test scaffolds for ${scaffolds.length} files`);

      const shouldCommit = process.env.COMMIT_CHANGES === 'true';

      if (shouldCommit) {
        await commitScaffolds(octokit, prContext, scaffolds);
      } else {
        await postScaffoldsComment(octokit, prContext, scaffolds);
      }
    }
  }
} catch (error) {
  core.setFailed(`Test scaffolding failed: ${error}`);
}
