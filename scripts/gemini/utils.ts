import { GoogleGenerativeAI } from '@google/generative-ai';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { Octokit } from '@octokit/rest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Initialize Gemini API client
 */
export function initGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY || core.getInput('gemini_api_key');
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('GEMINI_API_KEY is required');
  }
  return new GoogleGenerativeAI(apiKey.trim());
}

/**
 * Initialize GitHub Octokit client
 */
export function initGitHubClient(): Octokit {
  const token = process.env.GITHUB_TOKEN || core.getInput('github_token');
  if (!token || token.trim() === '') {
    throw new Error('GITHUB_TOKEN is required');
  }
  return new Octokit({ auth: token.trim() });
}

/**
 * Get PR context from GitHub Actions environment
 */
export function getPRContext(): {
  owner: string;
  repo: string;
  prNumber: number;
  baseSha: string;
  headSha: string;
} {
  const context = github.context;
  // Check for PR number from environment (for manual workflow dispatch) or from context
  const prNumberFromEnv = process.env.PR_NUMBER ? Number.parseInt(process.env.PR_NUMBER, 10) : null;
  const prNumber = prNumberFromEnv || context.payload.pull_request?.number;

  if (!prNumber || Number.isNaN(prNumber)) {
    throw new Error(
      'This workflow must be run on a pull request or with PR_NUMBER environment variable'
    );
  }

  return {
    owner: context.repo.owner,
    repo: context.repo.repo,
    prNumber,
    baseSha: context.payload.pull_request?.base?.sha || context.sha,
    headSha: context.payload.pull_request?.head?.sha || context.sha,
  };
}

/**
 * Fetch changed files in a PR
 */
export async function getChangedFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<Array<{ filename: string; status: string; additions: number; deletions: number }>> {
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
  const { data: diff } = await octokit.request(`GET /repos/${owner}/${repo}/pulls/${prNumber}`, {
    headers: {
      accept: 'application/vnd.github.v3.diff',
    },
  });

  if (typeof diff !== 'string') {
    throw new Error('Failed to fetch PR diff: unexpected response type');
  }

  return diff;
}

/**
 * Fetch file contents from a specific commit
 */
export async function getFileContents(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    if ('content' in data && 'encoding' in data) {
      const content = Buffer.from(data.content, data.encoding as BufferEncoding).toString('utf-8');
      return content;
    }
    throw new Error(`File ${path} is not a file`);
  } catch (error) {
    if ((error as { status?: number }).status === 404) {
      return '';
    }
    throw error;
  }
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
  const basePath = sourcePath.replace(ext, '');
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
export function filterCodeFiles(
  files: Array<{ filename: string; status: string; additions: number; deletions: number }>
): Array<{ filename: string; status: string; additions: number; deletions: number }> {
  return files.filter((file) => {
    const ext = path.extname(file.filename);
    return ext === '.ts' || ext === '.tsx';
  });
}

/**
 * Check if a file is new (added status)
 */
export function isNewFile(file: { status: string }): boolean {
  return file.status === 'added';
}
