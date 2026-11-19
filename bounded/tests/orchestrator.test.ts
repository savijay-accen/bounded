import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

import { query } from '@anthropic-ai/claude-agent-sdk';
import { CodeReviewOrchestrator } from '../src/orchestrator.js';

const mockedQuery = vi.mocked(query);

const validReport = {
  pullRequest: {
    owner: 'udacity',
    repo: 'cd14715-simple-todo-app',
    number: 1,
  },
  fileReviews: [
    {
      file: 'src/todo.ts',
      codeQuality: {
        file: 'src/todo.ts',
        issues: [],
        overallScore: 90,
        summary: 'Good code quality.',
      },
      testCoverage: {
        file: 'src/todo.ts',
        hasTests: true,
        testFiles: ['src/todo.test.ts'],
        untestedPaths: [],
        coverageEstimate: 85,
        summary: 'Most paths are tested.',
      },
      refactorings: {
        file: 'src/todo.ts',
        suggestions: [],
        summary: 'No major refactoring required.',
      },
    },
  ],
  summary: {
    totalFiles: 1,
    overallScore: 90,
    criticalIssues: 0,
    highPriorityTests: 0,
    refactoringOpportunities: 0,
  },
  recommendations: [],
  metadata: {
    analyzedAt: '2026-11-17T10:00:00.000Z',
    duration: 10,
    agentVersions: {
      'code-quality-analyzer': '1.0',
      'test-coverage-analyzer': '1.0',
      'refactoring-suggester': '1.0',
    },
  },
};

async function* createMessageStream(...items: unknown[]) {
  for (const item of items) {
    yield item;
  }
}

describe('CodeReviewOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('ANTHROPIC_MODEL', 'test-model');
    vi.stubEnv('PROJECT_ROOT', '/tmp/test-project');
  });

  describe('Configuration', () => {
    it('should initialize with default options', () => {
      expect(() => new CodeReviewOrchestrator()).not.toThrow();
    });

    it('should accept custom model, cwd and maxTurns', () => {
      expect(
        () =>
          new CodeReviewOrchestrator({
            model: 'custom-model',
            cwd: '/tmp/custom-project',
            maxTurns: 10,
          }),
      ).not.toThrow();
    });

    it('should reject missing model configuration', () => {
      vi.stubEnv('ANTHROPIC_MODEL', '');

      expect(() => new CodeReviewOrchestrator()).toThrow(
        'ANTHROPIC_MODEL is not configured',
      );
    });
  });

  describe('reviewPullRequest', () => {
    it('should reject invalid pull request details', async () => {
      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest('', 'repo', 1),
      ).rejects.toThrow('Invalid pull request details');

      await expect(
        orchestrator.reviewPullRequest('owner', '', 1),
      ).rejects.toThrow('Invalid pull request details');

      await expect(
        orchestrator.reviewPullRequest('owner', 'repo', 0),
      ).rejects.toThrow('Invalid pull request details');

      await expect(
        orchestrator.reviewPullRequest('owner', 'repo', 1.5),
      ).rejects.toThrow('Invalid pull request details');

      expect(mockedQuery).not.toHaveBeenCalled();
    });

    it('should return a valid aggregated ReviewReport', async () => {
      mockedQuery.mockReturnValue(
        createMessageStream({
          type: 'result',
          subtype: 'success',
          is_error: false,
          structured_output: validReport,
        }) as never,
      );

      const orchestrator = new CodeReviewOrchestrator();

      const result = await orchestrator.reviewPullRequest(
        'udacity',
        'cd14715-simple-todo-app',
        1,
      );

      expect(result).toEqual(validReport);
      expect(result.pullRequest.number).toBe(1);
      expect(result.fileReviews).toHaveLength(1);
      expect(result.summary.totalFiles).toBe(1);
    });

    it('should register all three specialized agents', async () => {
      mockedQuery.mockReturnValue(
        createMessageStream({
          type: 'result',
          subtype: 'success',
          is_error: false,
          structured_output: validReport,
        }) as never,
      );

      const orchestrator = new CodeReviewOrchestrator();

      await orchestrator.reviewPullRequest('udacity', 'cd14715-simple-todo-app', 1);

      const options = mockedQuery.mock.calls[0][0].options;

      expect(options.agents).toHaveProperty('code-quality-analyzer');
      expect(options.agents).toHaveProperty('test-coverage-analyzer');
      expect(options.agents).toHaveProperty('refactoring-suggester');
    });

    it('should configure GitHub and ESLint MCP tools', async () => {
      mockedQuery.mockReturnValue(
        createMessageStream({
          type: 'result',
          subtype: 'success',
          is_error: false,
          structured_output: validReport,
        }) as never,
      );

      const orchestrator = new CodeReviewOrchestrator();

      await orchestrator.reviewPullRequest('udacity', 'cd14715-simple-todo-app', 1);

      const options = mockedQuery.mock.calls[0][0].options;

      expect(options.mcpServers).toHaveProperty('github');
      expect(options.mcpServers).toHaveProperty('eslint');
      expect(options.allowedTools).toContain('Task');
    });

    it('should reject output that does not match the Zod schema', async () => {
      mockedQuery.mockReturnValue(
        createMessageStream({
          type: 'result',
          subtype: 'success',
          is_error: false,
          structured_output: {
            pullRequest: {},
            fileReviews: [],
          },
        }) as never,
      );

      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest('udacity', 'cd14715-simple-todo-app', 1),
      ).rejects.toThrow('does not match the required schema');
    });

    it('should handle SDK failures', async () => {
      mockedQuery.mockReturnValue(
        createMessageStream({
          type: 'result',
          subtype: 'error',
          errors: ['Simulated SDK failure'],
        }) as never,
      );

      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest('udacity', 'cd14715-simple-todo-app', 1),
      ).rejects.toThrow('Simulated SDK failure');
    });

    it('should handle SDK results marked as errors', async () => {
      mockedQuery.mockReturnValue(
        createMessageStream({
          type: 'result',
          subtype: 'success',
          is_error: true,
          result: 'Simulated review error',
          structured_output: validReport,
        }) as never,
      );

      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest('udacity', 'cd14715-simple-todo-app', 1),
      ).rejects.toThrow('Simulated review error');
    });

    it('should reject when the SDK returns no result', async () => {
      mockedQuery.mockReturnValue(
        createMessageStream({
          type: 'system',
          subtype: 'init',
        }) as never,
      );

      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest('udacity', 'cd14715-simple-todo-app', 1),
      ).rejects.toThrow('without returning a review report');
    });
  });
});
