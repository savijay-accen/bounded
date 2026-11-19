import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { refactoringSuggesterPrompt } from '../prompts/refactoring-suggester.prompt.js';

export const refactoringSuggester: AgentDefinition = {
  description:
    'Reviews code for refactoring opportunities, design pattern improvements, modernization, simplification, and redundant code.',
  model: 'inherit',
  tools: [
    'Read',
    'Glob',
    'Grep',
    'Skill',
  ],
  prompt: refactoringSuggesterPrompt,
};
