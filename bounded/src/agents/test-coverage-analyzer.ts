import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { testCoverageAnalyzerPrompt } from '../prompts/test-coverage-analyzer.prompt.js';

export const testCoverageAnalyzer: AgentDefinition = {
  description:
    'Analyzes code changes for missing tests, untested paths, edge cases, and test coverage improvements.',
  model: 'inherit',
  tools: [
    'Read',
    'Glob',
    'Grep',
    'Skill',
  ],
  prompt: testCoverageAnalyzerPrompt,
};
