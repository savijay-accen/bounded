import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { CodeReviewOrchestrator } from './orchestrator.js';
import { ReportGenerator } from './utils/index.js';


async function main(): Promise<void> {
  // 1. Validate command-line arguments
  const [owner, repo, prStr] = process.argv.slice(2);

  if (!owner || !repo || !prStr) {
    console.error('Usage: npm run dev -- <owner> <repo> <pr-number>');
    process.exitCode = 1;
    return;
  }

  const prNumber = Number(prStr);

  if (!Number.isInteger(prNumber) || prNumber < 1) {
    console.error('Error: Pull request number must be a positive integer.');
    process.exitCode = 1;
    return;
  }

  // 2. Validate authentication
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasAwsCredentials = Boolean(
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
  );

  if (hasAnthropicKey) {
    console.log('🔐 Using Anthropic API authentication');
  } else if (hasAwsCredentials) {
    if (!process.env.AWS_REGION) {
      console.error('Error: AWS_REGION is required when using AWS Bedrock.');
      process.exitCode = 1;
      return;
    }
    console.log('🔐 Using AWS Bedrock authentication');
  } else {
    console.error(
      'Error: Configure either ANTHROPIC_API_KEY or both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.'
    );
    process.exitCode = 1;
    return;
  }

  // 3. Validate model configuration
  if (!process.env.ANTHROPIC_MODEL) {
    console.error('Error: ANTHROPIC_MODEL is not configured.');
    process.exitCode = 1;
    return;
  }

  try {
    // 4. Run the pull request review
    console.log(`Starting review: ${owner}/${repo} PR #${prNumber}`);

    const orchestrator = new CodeReviewOrchestrator();
    const report = await orchestrator.reviewPullRequest(owner, repo, prNumber);

    // 5. Generate JSON, Markdown, and HTML reports
    const reportGenerator = new ReportGenerator();
    const reportsDirectory = join(process.cwd(), 'reports');

    await mkdir(reportsDirectory, { recursive: true });

    const safeOwner = owner.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeRepo = repo.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePrefix = `${safeOwner}-${safeRepo}-pr-${prNumber}`;

    await Promise.all([
      writeFile(
        join(reportsDirectory, `${filePrefix}.json`),
        reportGenerator.generateJSONReport(report),
        'utf-8'
      ),
      writeFile(
        join(reportsDirectory, `${filePrefix}.md`),
        reportGenerator.generateMarkdownReport(report),
        'utf-8'
      ),
      writeFile(
        join(reportsDirectory, `${filePrefix}.html`),
        reportGenerator.generateHTMLReport(report),
        'utf-8'
      ),
    ]);

    console.log('Pull request review completed successfully.');
    console.log(`Reports saved in: ${reportsDirectory}`);
  } catch (error) {
    console.error(
      'Review failed:',
      error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
  }
}

main();
