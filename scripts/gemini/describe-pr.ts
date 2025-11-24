import { GoogleGenerativeAI } from '@google/generative-ai';
import * as core from '@actions/core';
import { initGeminiClient, initGitHubClient, getPRContext, getPRDiff } from './utils';

const MAX_DIFF_LENGTH: number = 50_000;

const DIFF_HEADER_REGEX: RegExp = /^diff --git .*$/gm;

function sanitizeForPrompt(value: string): string {
  return (
    value
      // Break markdown code fences so they can't interfere with our prompt structure
      .replaceAll('```', '``\u200b`')
      // Remove any null characters that could affect parsing
      .replaceAll('\u0000', '')
  );
}

function truncateDiffAtFileBoundary(
  diff: string,
  maxLength: number
): { truncatedDiff: string; wasTruncated: boolean } {
  if (diff.length <= maxLength) {
    return { truncatedDiff: diff, wasTruncated: false };
  }

  let lastBoundaryIndex: number = -1;
  let match: RegExpExecArray | null;

  // Find the last "diff --git" boundary before the max length so we don't cut a file in half.
  // If none is found, fall back to a simple character-based truncation.

  while ((match = DIFF_HEADER_REGEX.exec(diff)) !== null) {
    if (match.index > maxLength) {
      break;
    }
    lastBoundaryIndex = match.index;
  }

  if (lastBoundaryIndex > 0) {
    return {
      truncatedDiff: diff.substring(0, lastBoundaryIndex),
      wasTruncated: true,
    };
  }

  return {
    truncatedDiff: diff.substring(0, maxLength),
    wasTruncated: true,
  };
}

async function generatePRDescription(
  gemini: GoogleGenerativeAI,
  title: string,
  currentDescription: string,
  diff: string,
  wasDiffTruncated: boolean,
  originalDiffLength: number
): Promise<string> {
  const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const safeTitle: string = sanitizeForPrompt(title);
  const safeDescription: string =
    currentDescription && currentDescription.trim().length > 0
      ? sanitizeForPrompt(currentDescription)
      : '(No description provided)';
  const safeDiff: string = sanitizeForPrompt(diff);

  const truncationPromptNote: string = wasDiffTruncated
    ? `

NOTE: The diff provided below was truncated for length before being sent to you.
- Original diff length: ${originalDiffLength.toLocaleString()} characters
- Provided diff length: ${diff.length.toLocaleString()} characters

When generating the description, clearly mention that the analysis may not cover all files or changes in this PR.`
    : '';

  const prompt = `You are a technical writer for a software development team. Analyze the following pull request and generate a professional, comprehensive PR description.

PR Title: ${safeTitle}

Current Description (may be empty or minimal):
${safeDescription}

Git Diff:
\`\`\`
${safeDiff}
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

${truncationPromptNote}

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
  } else {
    const { truncatedDiff, wasTruncated } = truncateDiffAtFileBoundary(diff, MAX_DIFF_LENGTH);

    if (wasTruncated) {
      core.warning(
        `PR diff was truncated for description generation: used ${truncatedDiff.length.toLocaleString()} of ${diff.length.toLocaleString()} characters.`
      );
    }

    // Generate description
    const newDescription = await generatePRDescription(
      gemini,
      pr.title,
      pr.body || '',
      truncatedDiff,
      wasTruncated,
      diff.length
    );

    const finalDescription = wasTruncated
      ? `${newDescription}\n\n> ⚠️ Note: This PR description was generated from a truncated diff and may not reflect every change in this PR.`
      : newDescription;

    // Update PR description
    await octokit.rest.pulls.update({
      owner: prContext.owner,
      repo: prContext.repo,
      pull_number: prContext.prNumber,
      body: finalDescription,
    });

    core.info('PR description updated successfully');
  }
} catch (error) {
  core.setFailed(`PR description generation failed: ${error}`);
}
