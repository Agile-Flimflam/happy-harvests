import { GoogleGenerativeAI } from '@google/generative-ai';
import * as core from '@actions/core';
import * as github from '@actions/github';
import {
  initGeminiClient,
  initGitHubClient,
  getPRContext,
  getChangedCodeFiles,
  getFileContents,
  isNewFile,
  getTestFilePath,
  prepareForPrompt,
  ensureCombinedPromptLength,
} from './utils';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const SAFE_PATH = '/usr/bin:/bin';

function resolveGitExecutable(): string {
  const gitExecutableFromEnv: string | undefined = process.env.GIT_EXECUTABLE;

  if (gitExecutableFromEnv && gitExecutableFromEnv.trim().length > 0) {
    // Allow callers to explicitly override the git executable location for
    // environments where git is not installed in a standard system path.
    return gitExecutableFromEnv.trim();
  }

  // Fall back to relying on PATH resolution for "git". The SAFE_ENV below
  // constrains PATH to a minimal set of system directories in CI, but local
  // environments can either ensure git is discoverable via PATH or provide
  // GIT_EXECUTABLE explicitly.
  return 'git';
}

// Constants used to construct markdown code fences inside prompt templates without
// having to embed raw triple-backtick sequences directly in template literals.
const CODE_FENCE: string = '```';
const CODE_FENCE_TS: string = '```typescript';

const REPO_ROOT = process.cwd();
// Restrict PATH to fixed, typically unwritable system directories to avoid using user-controlled
// executables, but preserve a minimal, explicitly whitelisted set of environment variables that Git
// and related tooling may rely on. In particular, we forward the Git author/committer identity
// variables if they are set by the workflow so that commits created by this script are attributed
// correctly, without exposing the full process environment to child processes.
function sanitizeOptionalEnvValue(name: string, value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const trimmed = value.trim();

  // Drop empty values rather than forwarding them.
  if (!trimmed) return undefined;

  // Reject control characters (including newlines) to avoid breaking downstream parsers or tools.
  if (/[\u0000-\u001F\u007F]/u.test(trimmed)) {
    core.warning(`Ignoring unsafe value for ${name}: contains control characters.`);
    return undefined;
  }

  // Defensively bound the length to avoid excessively large values impacting child processes.
  if (trimmed.length > 1024) {
    core.warning(`Ignoring unsafe value for ${name}: value is unreasonably long.`);
    return undefined;
  }

  return trimmed;
}

const RAW_SAFE_ENV = {
  PATH: SAFE_PATH,
  NODE_ENV: process.env.NODE_ENV ?? 'production',
  HOME: sanitizeOptionalEnvValue('HOME', process.env.HOME),
  USER: sanitizeOptionalEnvValue('USER', process.env.USER),
  GIT_AUTHOR_NAME: sanitizeOptionalEnvValue('GIT_AUTHOR_NAME', process.env.GIT_AUTHOR_NAME),
  GIT_AUTHOR_EMAIL: sanitizeOptionalEnvValue('GIT_AUTHOR_EMAIL', process.env.GIT_AUTHOR_EMAIL),
  GIT_COMMITTER_NAME: sanitizeOptionalEnvValue(
    'GIT_COMMITTER_NAME',
    process.env.GIT_COMMITTER_NAME
  ),
  GIT_COMMITTER_EMAIL: sanitizeOptionalEnvValue(
    'GIT_COMMITTER_EMAIL',
    process.env.GIT_COMMITTER_EMAIL
  ),
} satisfies Partial<NodeJS.ProcessEnv>;

const SAFE_ENV: NodeJS.ProcessEnv = {
  PATH: RAW_SAFE_ENV.PATH ?? SAFE_PATH,
  NODE_ENV: RAW_SAFE_ENV.NODE_ENV ?? 'production',
};

if (RAW_SAFE_ENV.HOME !== undefined) {
  SAFE_ENV.HOME = RAW_SAFE_ENV.HOME;
}

if (RAW_SAFE_ENV.USER !== undefined) {
  SAFE_ENV.USER = RAW_SAFE_ENV.USER;
}

if (RAW_SAFE_ENV.GIT_AUTHOR_NAME !== undefined) {
  SAFE_ENV.GIT_AUTHOR_NAME = RAW_SAFE_ENV.GIT_AUTHOR_NAME;
}

if (RAW_SAFE_ENV.GIT_AUTHOR_EMAIL !== undefined) {
  SAFE_ENV.GIT_AUTHOR_EMAIL = RAW_SAFE_ENV.GIT_AUTHOR_EMAIL;
}

if (RAW_SAFE_ENV.GIT_COMMITTER_NAME !== undefined) {
  SAFE_ENV.GIT_COMMITTER_NAME = RAW_SAFE_ENV.GIT_COMMITTER_NAME;
}

if (RAW_SAFE_ENV.GIT_COMMITTER_EMAIL !== undefined) {
  SAFE_ENV.GIT_COMMITTER_EMAIL = RAW_SAFE_ENV.GIT_COMMITTER_EMAIL;
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
  // path under the repo (e.g. ".", empty), reject it. Note: we intentionally treat "."
  // (the repository root) as invalid here; this action only writes test files alongside
  // source files within subdirectories, and never at the repository root.
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
  if (/[\u0000\n\r]/u.test(trimmed)) {
    throw new Error(`Refusing to use unsafe git ref containing control characters: ${ref}`);
  }

  // Disallow refs that could be parsed as options.
  if (!trimmed || trimmed.startsWith('-')) {
    throw new Error(`Refusing to use unsafe git ref: ${ref}`);
  }

  return trimmed;
}

function resolveGitRemote(): string {
  const remoteFromEnv: string | undefined = process.env.GIT_REMOTE;

  if (remoteFromEnv !== undefined) {
    const trimmed = remoteFromEnv.trim();

    // Reject empty, option-like, or control-character/whitespace-containing values and fall back.
    if (trimmed && !trimmed.startsWith('-') && !/[\u0000-\u001F\u007F\s]/u.test(trimmed)) {
      return trimmed;
    }

    core.warning(
      `Ignoring unsafe GIT_REMOTE value "${remoteFromEnv}", falling back to default remote 'origin'.`
    );
  }

  // Default remote name commonly used in Git repositories; callers can override via GIT_REMOTE.
  return 'origin';
}

/**
 * Lightweight heuristic to decide whether a ref name is *probably* a user branch name
 * for the purposes of this workflow.
 *
 * Important:
 * - This does NOT implement the full git refname validation rules.
 * - It is intentionally conservative: suspicious or special-looking refs are rejected,
 *   and git itself performs the final validation when commands are executed.
 * - This helper expects "short" branch names such as `main` or `feature/foo` and will
 *   intentionally reject fully qualified refs like `refs/heads/main`.
 *
 * If you need stronger guarantees, or support for full ref names, call
 * `git check-ref-format --branch <name>` instead and/or normalize refs yourself before
 * passing them to this helper.
 */
function isLikelyValidBranchRef(ref: string): boolean {
  const trimmed = ref.trim();
  if (!trimmed) return false;

  // Exclude common non-branch / special ref patterns used by Git / GitHub.
  if (trimmed.startsWith('refs/')) return false;
  if (trimmed.startsWith('pull/')) return false;
  if (trimmed.startsWith('tags/')) return false;
  if (trimmed.startsWith('heads/')) return false;
  if (trimmed.startsWith('remotes/')) return false;
  if (trimmed.startsWith('merge/')) return false;

  // Apply a very simple structural sanity check:
  // - disallow whitespace and obvious problematic characters
  // - disallow some patterns that are known-invalid or special in git refs
  // The character class explicitly escapes `[` and `]` and also rejects backslash
  // to avoid ambiguity across regex engines.
  if (/[~^:\s?*[\\\]]/.test(trimmed)) return false;
  if (trimmed.includes('..')) return false;
  if (trimmed.endsWith('.')) return false;
  if (trimmed.endsWith('/')) return false;
  if (trimmed.endsWith('.lock')) return false;
  if (trimmed.includes('@{')) return false;

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

  const safeSourceFilePath: string = prepareForPrompt(sourceFilePath);
  const safeSourceCode: string = prepareForPrompt(sourceCode);

  ensureCombinedPromptLength([safeSourceFilePath, safeSourceCode]);

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
${CODE_FENCE_TS}
import { functionName } from './source-file';

describe('functionName', () => {
  it('should handle normal case', () => {
    expect(functionName(input)).toBe(expected);
  });

  it('should handle edge case', () => {
    expect(functionName(edgeInput)).toBe(expected);
  });
});
${CODE_FENCE}

For React components:
${CODE_FENCE_TS}
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
${CODE_FENCE}

**Important:**
- Generate complete, runnable test code
- Include imports for all dependencies
- Test all exported functions/components
- Cover edge cases and error conditions
- Use explicit types (never use \`any\`)
- Follow the existing codebase patterns

Source file path: ${safeSourceFilePath}
Source code:
${CODE_FENCE_TS}
${safeSourceCode}
${CODE_FENCE}

Generate the complete, runnable TypeScript test file code. You may respond either with raw TypeScript test code or with a single fenced ${CODE_FENCE_TS} code block, but do not include any non-code commentary or explanations.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Clean up the response - remove a single outer markdown code fence if present, while leaving
    // any inner fenced code blocks inside the generated test code intact.
    let testCode = text.trim();
    if (testCode.startsWith('```')) {
      testCode = testCode
        .replace(/^```(?:typescript|ts|tsx)?\s*/, '')
        .replace(/\n```$/, '')
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
    // A non-null result means the file exists, even if it is empty.
    return content !== null;
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
  const codeFiles = await getChangedCodeFiles(
    octokit,
    prContext.owner,
    prContext.repo,
    prContext.prNumber
  );
  const newFiles = codeFiles.filter(isNewFile);

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

    if (sourceCode === null) {
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

// NOTE: This author identity must match the Git configuration used in the
// GitHub Actions workflow (see `.github/workflows/gemini-integration.yml`),
// otherwise `isRepeatActionCommit` will fail to recognize commits created by
// this action and the infinite-loop protection will not work as intended.
const ACTION_AUTHOR = 'github-actions[bot] <github-actions[bot]@users.noreply.github.com>';
const COMMIT_SUBJECT_PREFIX = 'test: add generated test scaffolds for ';
const ACTION_COMMIT_MARKER = 'Generated-by: gemini-scaffold-tests-action';

function getExitCodeFromError(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;

  const candidate = error as { status?: unknown; code?: unknown };

  const status: unknown = candidate.status;
  if (typeof status === 'number') {
    return status;
  }

  const code: unknown = candidate.code;
  if (typeof code === 'number') {
    return code;
  }

  return null;
}

function hasAnyCommits(): boolean {
  try {
    // `git rev-parse --verify HEAD` exits with:
    // - 0 when HEAD resolves successfully (i.e., there is at least one commit)
    // - 128 when HEAD does not exist (e.g., an empty repository)
    execFileSync(resolveGitExecutable(), ['rev-parse', '--verify', 'HEAD'], {
      stdio: 'ignore',
      env: SAFE_ENV,
    });
    return true;
  } catch (error) {
    const status: number | null = getExitCodeFromError(error);

    if (status === 128) {
      core.info('Repository has no commits yet; skipping last-commit check for scaffold action.');
      return false;
    }

    core.warning(`Could not determine commit presence via git rev-parse: ${error}`);
    // On unexpected errors, behave conservatively and skip the last-commit check.
    return false;
  }
}

function getLastCommitInfo(): LastCommitInfo | null {
  try {
    if (!hasAnyCommits()) {
      return null;
    }

    // Safe usage: command and arguments are constant strings; no user-controlled data is passed here.
    const author = execFileSync(
      resolveGitExecutable(),
      ['log', '-1', '--pretty=format:%an <%ae>'],
      {
        encoding: 'utf-8',
        env: SAFE_ENV,
      }
    ).trim();
    // Safe usage: command and arguments are constant strings; no user-controlled data is passed here.
    // Use %B to read the full commit message (subject + body) so we can reliably detect the
    // action's marker line in isRepeatActionCommit.
    const message = execFileSync(resolveGitExecutable(), ['log', '-1', '--pretty=format:%B'], {
      encoding: 'utf-8',
      env: SAFE_ENV,
    }).trim();

    return { author, message };
  } catch (error) {
    core.warning(`Could not check last commit via git log: ${error}`);
    return null;
  }
}

function isRepeatActionCommit(lastCommitInfo: LastCommitInfo | null): boolean {
  if (!lastCommitInfo) return false;

  return (
    lastCommitInfo.author === ACTION_AUTHOR &&
    lastCommitInfo.message.startsWith(COMMIT_SUBJECT_PREFIX) &&
    lastCommitInfo.message.includes(ACTION_COMMIT_MARKER)
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
  execFileSync(resolveGitExecutable(), ['add', '--', ...filePaths], {
    stdio: 'inherit',
    env: SAFE_ENV,
  });
}

function hasPendingChanges(): boolean {
  try {
    // `git diff --cached --quiet` exits with:
    // - 0 when there are no staged changes
    // - 1 when there are staged changes
    // - >1 on errors
    execFileSync(resolveGitExecutable(), ['diff', '--cached', '--quiet'], {
      stdio: 'ignore',
      env: SAFE_ENV,
    });

    // Exit code 0: no staged changes.
    return false;
  } catch (error) {
    const status: number | null = getExitCodeFromError(error);

    if (status === 1) {
      // Git uses exit code 1 to indicate that differences were found.
      return true;
    }

    core.warning(`Could not determine staged changes status via git diff --cached: ${error}`);
    // Be conservative on unexpected errors and assume there may be changes.
    return true;
  }
}

function buildCommitMessage(scaffolds: TestScaffold[]): string {
  // File paths come from GitHub's API and are already validated for filesystem/git usage, but we
  // still defensively escape them for inclusion in the commit message body. Using JSON-style
  // escaping ensures that control characters (newlines, tabs, etc.) are represented safely and
  // cannot break the commit message format, even if the message is later consumed by other tools.
  const escapedFileList = scaffolds
    .map((scaffold) => {
      // Keep the JSON-style quoting to avoid fragile manual slicing; this produces entries like
      // `"path/with\"quotes.ts"` which are unambiguous and safe for parsers that may consume the
      // commit message later.
      return JSON.stringify(scaffold.filePath);
    })
    .join(', ');

  return `test: add generated test scaffolds for ${scaffolds.length} file(s)

Generated by Gemini AI workflow
${ACTION_COMMIT_MARKER}
Files: ${escapedFileList}`;
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
  try {
    const remote = resolveGitRemote();
    // Safe usage: repository is a fixed literal and branch name is sanitized and passed as an argument.
    execFileSync(resolveGitExecutable(), ['push', remote, targetBranch], {
      stdio: 'inherit',
      env: SAFE_ENV,
    });
    core.info(`Pushed test scaffolds to ${remote}/${targetBranch}`);
  } catch (error) {
    core.warning(`Failed to push test scaffolds to ${targetBranch}: ${error}`);
    throw error;
  }
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
  execFileSync(resolveGitExecutable(), ['commit', '-m', commitMessage], {
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
