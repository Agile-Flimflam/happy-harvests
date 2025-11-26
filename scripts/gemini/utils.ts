import { GoogleGenerativeAI } from '@google/generative-ai';
import * as github from '@actions/github';
import { Octokit } from '@octokit/rest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Upper bound on the amount of user-controlled content we will embed directly into a single
// prompt field.
// This helps keep prompts within reasonable size limits and reduces the impact of extremely
// large or adversarial inputs.
//
// Note: We leave a small buffer (e.g. 1000 chars) below the "half of combined max" threshold
// to account for truncation messages ("[Content truncated...]") and overhead, ensuring that
// two truncated fields don't accidentally sum to slightly more than MAX_COMBINED_PROMPT_CONTENT_LENGTH.
const MAX_PROMPT_CONTENT_LENGTH: number = 39_000;

// Conservative upper bound on *combined* prompt fields that share the same prompt. Callers
// should still be mindful of the model's request limits (e.g., tokens) after additional static
// context is added around the user-controlled pieces.
//
// This is set to 80,000 characters, allowing two fully-saturated fields (39k each) to fit comfortably
// with room for truncation notices.
const MAX_COMBINED_PROMPT_CONTENT_LENGTH: number = 80_000;

/**
 * Prepare arbitrary user-controlled content before embedding it into an LLM prompt.
 *
 * This helper focuses on structural safety and size limits. It deliberately does **not**
 * try to "solve" prompt injection; callers must still treat model outputs as untrusted.
 */
export function prepareForPrompt(value: string): string {
  // Normalize markdown fences and newlines first so downstream logic sees a consistent shape.
  const normalized: string = value
    // Break markdown code fences so they can't interfere with our prompt structure.
    .replaceAll('```', '``\u200b`')
    // Normalize newlines to reduce ambiguity across platforms.
    .replace(/\r\n?/g, '\n');

  // Remove control characters (other than newlines) that could affect parsing.
  const withoutControlChars: string = normalized.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
    ''
  );

  // Enforce a hard upper bound on content length embedded in prompts.
  if (withoutControlChars.length > MAX_PROMPT_CONTENT_LENGTH) {
    const originalLength: number = withoutControlChars.length;
    const omittedCharacters: number = originalLength - MAX_PROMPT_CONTENT_LENGTH;

    return `${withoutControlChars.slice(
      0,
      MAX_PROMPT_CONTENT_LENGTH
    )}\n\n[Content truncated for safety - remaining ${omittedCharacters.toLocaleString()} characters omitted]`;
  }

  return withoutControlChars;
}

/**
 * Ensure a collection of prompt fields stays below a combined length limit.
 */
export function ensureCombinedPromptLength(
  values: ReadonlyArray<string>,
  maxLength: number = MAX_COMBINED_PROMPT_CONTENT_LENGTH
): void {
  const totalLength = values.reduce((accumulator, value) => accumulator + value.length, 0);

  if (totalLength > maxLength) {
    const exceededBy = totalLength - maxLength;
    throw new Error(
      `Combined prompt content length exceeds ${maxLength.toLocaleString()} characters by ` +
        `${exceededBy.toLocaleString()} characters.`
    );
  }
}

/**
 * Initialize Gemini API client
 */
export function initGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('GEMINI_API_KEY is required');
  }
  return new GoogleGenerativeAI(apiKey.trim());
}

/**
 * Initialize GitHub Octokit client
 */
export function initGitHubClient(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token || token.trim() === '') {
    throw new Error('GITHUB_TOKEN is required');
  }
  return new Octokit({ auth: token.trim() });
}

/**
 * Get PR context from GitHub Actions environment.
 *
 * This helper is intended for `pull_request` events only. For `workflow_dispatch` or other events,
 * callers should resolve the PR (and its SHAs) explicitly via the GitHub API rather than relying
 * on this function.
 */
export function getPRContext(): {
  owner: string;
  repo: string;
  prNumber: number;
  baseSha: string;
  headSha: string;
} {
  const context = github.context;
  const pr = context.payload.pull_request;

  if (!pr || !pr.number) {
    throw new Error('getPRContext can only be used for pull_request events with an associated PR');
  }

  return {
    owner: context.repo.owner,
    repo: context.repo.repo,
    prNumber: pr.number,
    baseSha: pr.base.sha,
    headSha: pr.head.sha,
  };
}

/**
 * Fetch changed files in a PR
 */
export interface ChangedFileSummary {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
}

export async function getChangedFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<ChangedFileSummary[]> {
  const { data: files } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
  });

  return files.map((file) => ({
    filename: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
  }));
}

/**
 * Fetch the full diff for a PR
 */
export async function getPRDiff(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<string> {
  const { data: diff } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
    mediaType: {
      format: 'diff',
    },
  });

  if (typeof diff !== 'string') {
    throw new TypeError('Failed to fetch PR diff: unexpected response type');
  }

  return diff;
}

/**
 * Fetch file contents from a specific commit.
 *
 * Returns the UTF-8 decoded file contents, or `null` if the file does not exist (HTTP 404).
 * Other errors are propagated to the caller.
 */
export async function getFileContents(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string | null> {
  const normalizedPath: string = path.trim();

  // Defense in depth: reject obviously unsafe or traversal-like paths even though the
  // GitHub API also validates repository paths.
  if (normalizedPath.includes('..')) {
    throw new Error(`Invalid file path: traversal sequences not allowed (${path})`);
  }

  if (!normalizedPath || normalizedPath.startsWith('/')) {
    throw new Error(`Invalid file path: ${path}`);
  }

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: normalizedPath,
      ref,
    });

    if ('content' in data && 'encoding' in data) {
      const allowedEncodings: ReadonlyArray<BufferEncoding> = ['base64', 'utf-8'];
      const encoding: string = typeof data.encoding === 'string' ? data.encoding : '';

      if (!allowedEncodings.includes(encoding as BufferEncoding)) {
        throw new Error(`Unsupported encoding "${String(data.encoding)}" for file ${path}`);
      }

      const buffer: Buffer = Buffer.from(data.content, encoding as BufferEncoding);
      const content: string = buffer.toString('utf-8');
      return content;
    }
    throw new Error(`File ${path} is not a file`);
  } catch (error: unknown) {
    if (isErrorWithStatusOrCode(error) && error.status === 404) {
      return null;
    }
    throw error;
  }
}

type ErrorWithStatusOrCode = {
  status?: number;
  code?: number;
};

function isErrorWithStatusOrCode(error: unknown): error is ErrorWithStatusOrCode {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  if (!('status' in error) && !('code' in error)) {
    return false;
  }

  const candidateStatus: unknown = (error as { status?: unknown }).status;
  const candidateCode: unknown = (error as { code?: unknown }).code;

  return (
    (candidateStatus === undefined || typeof candidateStatus === 'number') &&
    (candidateCode === undefined || typeof candidateCode === 'number')
  );
}

/**
 * Check if a file exists locally
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Get the test file path for a given source file
 */
export function getTestFilePath(sourcePath: string): { testPath: string; specPath: string } {
  const ext = path.extname(sourcePath);
  const basePath = ext.length > 0 ? sourcePath.slice(0, -ext.length) : sourcePath;
  const dir = path.dirname(sourcePath);
  const baseName = path.basename(basePath);

  // Check for .test.ts or .spec.ts
  const testExt = ext === '.tsx' ? '.test.tsx' : '.test.ts';
  const specExt = ext === '.tsx' ? '.spec.tsx' : '.spec.ts';

  return {
    testPath: path.join(dir, `${baseName}${testExt}`),
    specPath: path.join(dir, `${baseName}${specExt}`),
  };
}

/**
 * Filter files to only TypeScript/TSX files
 */
export function filterCodeFiles(files: ReadonlyArray<ChangedFileSummary>): ChangedFileSummary[] {
  return files.filter((file) => {
    const ext: string = path.extname(file.filename);

    // Only consider .ts/.tsx files
    if (ext !== '.ts' && ext !== '.tsx') {
      return false;
    }

    // Exclude declaration files
    if (file.filename.endsWith('.d.ts')) {
      return false;
    }

    // Exclude test/spec files (e.g., *.test.ts, *.spec.ts, *.test.tsx, *.spec.tsx)
    const isTestOrSpecFile: boolean =
      file.filename.endsWith('.test.ts') ||
      file.filename.endsWith('.spec.ts') ||
      file.filename.endsWith('.test.tsx') ||
      file.filename.endsWith('.spec.tsx');

    if (isTestOrSpecFile) {
      return false;
    }

    return true;
  });
}

/**
 * Convenience helper that returns only TypeScript/TSX code files changed in a PR.
 *
 * This avoids repeating the "list files, then filter" pattern in each script and ensures
 * we only walk the changed file list once per invocation.
 */
export async function getChangedCodeFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<ChangedFileSummary[]> {
  const allFiles: ChangedFileSummary[] = await getChangedFiles(octokit, owner, repo, prNumber);
  return filterCodeFiles(allFiles);
}

/**
 * Check if a file is new (added status)
 */
export function isNewFile(file: { status: string }): boolean {
  return file.status === 'added';
}
