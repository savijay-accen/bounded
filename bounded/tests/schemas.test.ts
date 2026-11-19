import { describe, expect, it } from 'vitest';

import {
  CodeQualityResultSchema,
  TestCoverageResultSchema,
  RefactoringSuggestionSchema,
  ReviewReportSchema,
  CodeQualityResultJSONSchema,
  TestCoverageResultJSONSchema,
  RefactoringSuggestionJSONSchema,
  ReviewReportJSONSchema,
} from '../src/types/index.js';

const validQuality = {
  file: 'src/todo.ts',
  issues: [
    {
      line: 10,
      severity: 'medium',
      category: 'maintainability',
      description: 'Function is too complex.',
      suggestion: 'Extract smaller functions.',
    },
  ],
  overallScore: 90,
  summary: 'Good code quality.',
};

const validCoverage = {
  file: 'src/todo.ts',
  hasTests: true,
  testFiles: ['src/todo.test.ts'],
  untestedPaths: [
    {
      type: 'function',
      location: 'deleteTodo()',
      priority: 'high',
      reasoning: 'The function has no direct test.',
      suggestedTest: 'Test deleting an existing todo.',
    },
  ],
  coverageEstimate: 85,
  summary: 'Most paths are tested.',
};

const validRefactoring = {
  file: 'src/todo.ts',
  suggestions: [
    {
      type: 'extract-function',
      location: 'line 10',
      impact: 'medium',
      description: 'Extract repeated logic.',
      before: 'Repeated code',
      after: 'Reusable function',
      benefits: 'Improves maintainability.',
    },
  ],
  summary: 'One improvement identified.',
};

const validReport = {
  pullRequest: {
    owner: 'udacity',
    repo: 'cd14715-simple-todo-app',
    number: 1,
  },
  fileReviews: [
    {
      file: 'src/todo.ts',
      codeQuality: validQuality,
      testCoverage: validCoverage,
      refactorings: validRefactoring,
    },
  ],
  summary: {
    totalFiles: 1,
    overallScore: 90,
    criticalIssues: 0,
    highPriorityTests: 1,
    refactoringOpportunities: 1,
  },
  recommendations: [
    {
      priority: 'medium',
      category: 'testing',
      description: 'Add tests for uncovered functions.',
      files: ['src/todo.ts'],
    },
  ],
  metadata: {
    analyzedAt: '2026-11-17T10:00:00.000Z',
    duration: 10,
    agentVersions: {
      analyzer: '1.0',
    },
  },
};

describe('Zod Schema Validation', () => {
  describe('CodeQualityResultSchema', () => {
    it('accepts valid code quality data', () => {
      expect(CodeQualityResultSchema.safeParse(validQuality).success).toBe(true);
    });

    it('rejects invalid severity values', () => {
      const invalid = {
        ...validQuality,
        issues: [{ ...validQuality.issues[0], severity: 'urgent' }],
      };

      expect(CodeQualityResultSchema.safeParse(invalid).success).toBe(false);
    });

    it('accepts empty issues and boundary scores', () => {
      expect(
        CodeQualityResultSchema.safeParse({
          ...validQuality,
          issues: [],
          overallScore: 0,
        }).success,
      ).toBe(true);

      expect(
        CodeQualityResultSchema.safeParse({
          ...validQuality,
          overallScore: 100,
        }).success,
      ).toBe(true);
    });

    it('rejects scores outside 0 to 100', () => {
      expect(
        CodeQualityResultSchema.safeParse({
          ...validQuality,
          overallScore: 101,
        }).success,
      ).toBe(false);
    });
  });

  describe('TestCoverageResultSchema', () => {
    it('accepts valid test coverage data', () => {
      expect(TestCoverageResultSchema.safeParse(validCoverage).success).toBe(true);
    });

    it('rejects invalid priority values', () => {
      const invalid = {
        ...validCoverage,
        untestedPaths: [
          { ...validCoverage.untestedPaths[0], priority: 'urgent' },
        ],
      };

      expect(TestCoverageResultSchema.safeParse(invalid).success).toBe(false);
    });

    it('accepts empty test arrays and boundary coverage values', () => {
      expect(
        TestCoverageResultSchema.safeParse({
          ...validCoverage,
          testFiles: [],
          untestedPaths: [],
          coverageEstimate: 0,
        }).success,
      ).toBe(true);

      expect(
        TestCoverageResultSchema.safeParse({
          ...validCoverage,
          coverageEstimate: 100,
        }).success,
      ).toBe(true);
    });

    it('rejects coverage above 100', () => {
      expect(
        TestCoverageResultSchema.safeParse({
          ...validCoverage,
          coverageEstimate: 101,
        }).success,
      ).toBe(false);
    });
  });

  describe('RefactoringSuggestionSchema', () => {
    it('accepts valid refactoring data', () => {
      expect(
        RefactoringSuggestionSchema.safeParse(validRefactoring).success,
      ).toBe(true);
    });

    it('rejects invalid refactoring types', () => {
      const invalid = {
        ...validRefactoring,
        suggestions: [
          { ...validRefactoring.suggestions[0], type: 'rewrite-everything' },
        ],
      };

      expect(
        RefactoringSuggestionSchema.safeParse(invalid).success,
      ).toBe(false);
    });

    it('accepts an empty suggestions array', () => {
      expect(
        RefactoringSuggestionSchema.safeParse({
          ...validRefactoring,
          suggestions: [],
        }).success,
      ).toBe(true);
    });
  });

  describe('ReviewReportSchema', () => {
    it('accepts a complete valid review report', () => {
      expect(ReviewReportSchema.safeParse(validReport).success).toBe(true);
    });

    it('rejects a report with missing required fields', () => {
      expect(
        ReviewReportSchema.safeParse({
          pullRequest: validReport.pullRequest,
          fileReviews: [],
        }).success,
      ).toBe(false);
    });

    it('accepts empty file reviews and recommendations', () => {
      expect(
        ReviewReportSchema.safeParse({
          ...validReport,
          fileReviews: [],
          recommendations: [],
          summary: {
            ...validReport.summary,
            totalFiles: 0,
          },
        }).success,
      ).toBe(true);
    });
  });

  describe('JSON Schema exports', () => {
    it.each([
      ['Code Quality', CodeQualityResultJSONSchema],
      ['Test Coverage', TestCoverageResultJSONSchema],
      ['Refactoring', RefactoringSuggestionJSONSchema],
      ['Review Report', ReviewReportJSONSchema],
    ])('exports a valid JSON Schema for %s', (_name, schema) => {
      expect(schema).toBeTypeOf('object');
      expect(schema).toHaveProperty('type', 'object');
      expect(schema).toHaveProperty('properties');
    });

    it('includes required fields in the ReviewReport JSON Schema', () => {
      expect(ReviewReportJSONSchema).toHaveProperty('required');
      expect(ReviewReportJSONSchema.required).toContain('pullRequest');
      expect(ReviewReportJSONSchema.required).toContain('fileReviews');
      expect(ReviewReportJSONSchema.required).toContain('summary');
      expect(ReviewReportJSONSchema.required).toContain('metadata');
    });
  });
});
