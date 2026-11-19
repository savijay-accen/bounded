import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { codeQualityAnalyzerPrompt } from '../prompts/code-quality-analyzer.prompt.js';

export const codeQualityAnalyzer: AgentDefinition = {
  description:
    'Analyzes source code for security vulnerabilities, performance problems, bugs, maintainability issues, and coding best practices.',
  model: 'inherit',
  tools: [
    'Read',
    'Glob',
    'Grep',
    'Skill',
    'mcp__eslint__lint-files',
  ],
  prompt: codeQualityAnalyzerPrompt,
};
