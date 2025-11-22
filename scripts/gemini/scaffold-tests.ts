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
import { execSync } from 'node:child_process';

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

  // Determine if it's a React component or utility function
  const isComponent = sourceFilePath.endsWith('.tsx');

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

Source file path: ${sourceFilePath}
Source code:
\`\`\`typescript
${sourceCode}
\`\`\`

Generate the complete test file code. Respond with ONLY the TypeScript test code, no markdown, no explanations, no code blocks.`;

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

async function commitScaffolds(
  octokit: ReturnType<typeof initGitHubClient>,
  prContext: { owner: string; repo: string; prNumber: number },
  scaffolds: TestScaffold[]
) {
  // Check if the last commit was made by this action to prevent infinite loops
  try {
    const lastCommitAuthor = execSync('git log -1 --pretty=format:"%an <%ae>"', {
      encoding: 'utf-8',
    }).trim();
    const lastCommitMessage = execSync('git log -1 --pretty=format:"%s"', {
      encoding: 'utf-8',
    }).trim();

    if (
      lastCommitAuthor.includes('GitHub Action') &&
      lastCommitMessage.includes('test: add generated test scaffolds')
    ) {
      core.info('Last commit was made by this action. Skipping to prevent infinite loop.');
      return;
    }
  } catch (error) {
    core.warning(`Could not check last commit: ${error}`);
  }

  // Write files to disk and commit them
  core.info(`Writing ${scaffolds.length} test files to disk...`);

  for (const scaffold of scaffolds) {
    const fullPath = path.join(process.cwd(), scaffold.filePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, scaffold.testCode, 'utf-8');
    core.info(`Wrote ${scaffold.filePath}`);
  }

  // Stage files
  execSync('git add ' + scaffolds.map((s) => s.filePath).join(' '), {
    stdio: 'inherit',
  });

  // Check if there are any changes to commit
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' });
    if (!status.trim()) {
      core.info('No changes to commit.');
      return;
    }

    const commitMessage = `test: add generated test scaffolds for ${scaffolds.length} file(s)

Generated by Gemini AI workflow
Files: ${scaffolds.map((s) => s.filePath).join(', ')}`;

    execSync(`git commit -m "${commitMessage}"`, {
      stdio: 'inherit',
    });

    const branchName = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME;
    if (branchName) {
      execSync(`git push origin ${branchName}`, {
        stdio: 'inherit',
      });
      core.info(`Pushed test scaffolds to ${branchName}`);
    } else {
      core.warning('Could not determine branch name for push');
    }

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
  } catch (error) {
    core.warning(`Failed to commit/push: ${error}`);
    throw error;
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

async function main(): Promise<void> {
  try {
    core.info('Starting test scaffolding...');

    const gemini = initGeminiClient();
    const octokit = initGitHubClient();
    const prContext = await resolvePRContext(octokit);

    core.info(`Scaffolding tests for PR #${prContext.prNumber}`);

    const filesNeedingTests = await identifyFilesNeedingTests(octokit, prContext);

    if (filesNeedingTests.length === 0) {
      core.info('All new files already have corresponding test files.');
      process.exit(0);
    }

    core.info(`Generating test scaffolds for ${filesNeedingTests.length} files`);

    const scaffolds = await generateScaffolds(gemini, octokit, prContext, filesNeedingTests);

    if (scaffolds.length === 0) {
      core.info('No test scaffolds generated.');
      process.exit(0);
    }

    core.info(`Processed test scaffolds for ${scaffolds.length} files`);

    const shouldCommit = process.env.COMMIT_CHANGES === 'true';

    if (shouldCommit) {
      try {
        await commitScaffolds(octokit, prContext, scaffolds);
      } catch {
        // Fallback to comment if commit/push fails
        await postScaffoldsComment(octokit, prContext, scaffolds);
      }
    } else {
      await postScaffoldsComment(octokit, prContext, scaffolds);
    }
  } catch (error) {
    core.setFailed(`Test scaffolding failed: ${error}`);
    process.exit(1);
  }
}

main();
