import { query } from '@anthropic-ai/claude-agent-sdk';

import { mcpServersConfig } from './config/mcp.config.js';

import {
  codeQualityAnalyzer,
  testCoverageAnalyzer,
  refactoringSuggester,
} from './agents/index.js';

import { orchestratorPrompt } from './prompts/index.js';

import {
  ReviewReportSchema,
  ReviewReportJSONSchema,
  type ReviewReport,
} from './types/report-types.js';

/**
 * Orchestrator configuration options
 */
export interface OrchestratorOptions {
  model?: string;
  cwd?: string;
  maxTurns?: number;
}

/**
 * Main Code Review Orchestrator
 * Coordinates subagents to analyze pull requests and generate reports.
 */
export class CodeReviewOrchestrator {
  private readonly model: string;
  private readonly cwd: string;
  private readonly maxTurns: number;

  constructor(options: OrchestratorOptions = {}) {
    this.model = options.model || process.env.ANTHROPIC_MODEL || '';
    this.cwd = options.cwd || process.env.PROJECT_ROOT || process.cwd();
    this.maxTurns = options.maxTurns ?? 30;

    if (!this.model) {
      throw new Error(
        'ANTHROPIC_MODEL is not configured. Set it in your environment or pass it in OrchestratorOptions.'
      );
    }
  }

  /**
   * Review a pull request using parallel subagent analysis.
   */
  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    if (!owner.trim() || !repo.trim() || !Number.isInteger(prNumber) || prNumber < 1) {
      throw new Error('Invalid pull request details. Provide an owner, repository, and positive PR number.');
    }

    const prompt = `
${orchestratorPrompt}

Review this GitHub pull request:
- Repository owner: ${owner}
- Repository name: ${repo}
- Pull request number: ${prNumber}

Fetch the pull request information and changed files before starting the analysis.
Return the complete ReviewReport as structured output.
`;

    const response = query({
      prompt,
      options: {
        model: this.model,
        cwd: this.cwd,
        maxTurns: this.maxTurns,
        permissionMode: 'default',
        allowedTools: ['Task', 'mcp__github__*', 'mcp__eslint__*'],
        mcpServers: mcpServersConfig,
        agents: {
          'code-quality-analyzer': codeQualityAnalyzer,
          'test-coverage-analyzer': testCoverageAnalyzer,
          'refactoring-suggester': refactoringSuggester,
        },
        outputFormat: {
          type: 'json_schema',
          schema: ReviewReportJSONSchema,
        },
      },
    });

    for await (const message of response) {
      if (message.type !== 'result') {
        continue;
      }

      if (message.subtype !== 'success') {
        const errors = 'errors' in message ? message.errors.join('; ') : 'Unknown SDK error';
        throw new Error(`Pull request review failed: ${errors}`);
      }

      if (message.is_error) {
        throw new Error(`Pull request review failed: ${message.result}`);
      }

      const validation = ReviewReportSchema.safeParse(message.structured_output);

      if (!validation.success) {
        throw new Error(
          `The generated review report does not match the required schema: ${validation.error.message}`
        );
      }

      return validation.data;
    }

    throw new Error('The Claude Agent SDK finished without returning a review report.');
  }
}
