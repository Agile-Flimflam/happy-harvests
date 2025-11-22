import { GoogleGenerativeAI } from '@google/generative-ai';
import * as core from '@actions/core';
import { initGeminiClient, initGitHubClient, getPRContext, getPRDiff } from './utils';

async function generatePRDescription(
  gemini: GoogleGenerativeAI,
  title: string,
  currentDescription: string,
  diff: string
): Promise<string> {
  const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `You are a technical writer for a software development team. Analyze the following pull request and generate a professional, comprehensive PR description.

PR Title: ${title}

Current Description (may be empty or minimal):
${currentDescription || '(No description provided)'}

Git Diff:
\`\`\`
${diff.substring(0, 50000)}${diff.length > 50000 ? '\n...(truncated)' : ''}
\`\`\`

Generate a professional PR description in markdown format that includes:

1. **Summary**: A clear, concise summary of what this PR does (2-3 sentences)
2. **Changes Made**: A bulleted list of the key changes
3. **Testing**: What testing was done or should be done
4. **Breaking Changes**: If any, clearly state them
5. **Related Issues**: If applicable, reference related issues or tickets

The description should be:
- Professional and clear
- Suitable for an audit trail
- Helpful for code reviewers
- Informative for future developers

If the current description already contains substantial information, enhance it rather than replacing it entirely. Preserve any existing context that is valuable.

Respond with ONLY the markdown description, no additional commentary.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Clean up markdown code blocks if present
    let description = text.trim();
    if (description.startsWith('```')) {
      description = description
        .replaceAll(/^```(?:markdown)?\n?/gm, '')
        .replaceAll(/```$/gm, '')
        .trim();
    }

    return description;
  } catch (error) {
    core.warning(`Failed to generate PR description: ${error}`);
    throw error;
  }
}

try {
  core.info('Starting PR description generation...');

  const gemini = initGeminiClient();
  const octokit = initGitHubClient();
  const prContext = getPRContext();

  core.info(`Generating description for PR #${prContext.prNumber}`);

  // Get PR details
  const { data: pr } = await octokit.rest.pulls.get({
    owner: prContext.owner,
    repo: prContext.repo,
    pull_number: prContext.prNumber,
  });

  // Get PR diff
  const diff = await getPRDiff(octokit, prContext.owner, prContext.repo, prContext.prNumber);

  if (!diff || diff.length === 0) {
    core.warning('No diff found for this PR');
    process.exit(0);
  }

  // Generate description
  const newDescription = await generatePRDescription(gemini, pr.title, pr.body || '', diff);

  // Update PR description
  await octokit.rest.pulls.update({
    owner: prContext.owner,
    repo: prContext.repo,
    pull_number: prContext.prNumber,
    body: newDescription,
  });

  core.info('PR description updated successfully');
} catch (error) {
  core.setFailed(`PR description generation failed: ${error}`);
  process.exit(1);
}
