import * as core from '@actions/core';
import { initVertexModel, getServiceAccountEmail } from './utils';

async function main(): Promise<void> {
  try {
    const { model, projectId, location } = initVertexModel('gemini-3-pro-preview');
    const serviceAccount = getServiceAccountEmail();

    core.info(
      `Running Vertex AI smoke test for project ${projectId} (${location})` +
        (serviceAccount ? ` via ${serviceAccount}` : '')
    );

    const response = await model.countTokens({
      contents: [
        {
          role: 'user',
          parts: [{ text: 'Return a short acknowledgement to confirm connectivity.' }],
        },
      ],
    });

    const totalTokens = response.totalTokens ?? 0;
    core.info(`Vertex AI token check succeeded (estimated tokens: ${totalTokens}).`);
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : String(error);
    core.setFailed(`Vertex AI smoke test failed: ${message}`);
  }
}

main().catch((error: unknown) => {
  const message: string = error instanceof Error ? error.message : String(error);
  core.setFailed(`Vertex AI smoke test failed: ${message}`);
  process.exit(1);
});
