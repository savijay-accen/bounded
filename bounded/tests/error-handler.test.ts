import { describe, it, expect, vi } from 'vitest';
import {
  ReviewError,
  ErrorCodes,
  withRetry,
  withTimeout,
  isReviewError,
  formatError,
} from '../src/utils/error-handler.js';

describe('Error Handler', () => {
  describe('ReviewError', () => {
    it('should create a custom error with code and metadata', () => {
      const error = new ReviewError('Test failure', ErrorCodes.AGENT_FAILED, {
        agent: 'code-quality',
      });

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ReviewError');
      expect(error.code).toBe(ErrorCodes.AGENT_FAILED);
      expect(error.metadata).toEqual({ agent: 'code-quality' });
    });
  });

  describe('withRetry', () => {
    it('should return the result when the operation succeeds', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const result = await withRetry(operation, 3, 0);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry and succeed after a failure', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue('success');

      const result = await withRetry(operation, 3, 0);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should throw RETRY_EXHAUSTED after all attempts fail', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Permanent failure'));

      await expect(withRetry(operation, 2, 0)).rejects.toMatchObject({
        code: ErrorCodes.RETRY_EXHAUSTED,
      });

      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should reject invalid retry configuration', async () => {
      await expect(withRetry(async () => 'ok', 0, 0))
        .rejects.toMatchObject({ code: ErrorCodes.INVALID_CONFIG });

      await expect(withRetry(async () => 'ok', 2, -1))
        .rejects.toMatchObject({ code: ErrorCodes.INVALID_CONFIG });
    });
  });

  describe('withTimeout', () => {
    it('should return the result when the operation finishes in time', async () => {
      const result = await withTimeout(async () => 'completed', 1000);
      expect(result).toBe('completed');
    });

    it('should throw AGENT_TIMEOUT when the operation takes too long', async () => {
      const operation = () =>
        new Promise<string>(resolve => setTimeout(() => resolve('late'), 100));

      await expect(withTimeout(operation, 10)).rejects.toMatchObject({
        code: ErrorCodes.AGENT_TIMEOUT,
      });
    });

    it('should reject an invalid timeout', async () => {
      await expect(withTimeout(async () => 'ok', 0))
        .rejects.toMatchObject({ code: ErrorCodes.INVALID_CONFIG });
    });
  });

  describe('Error utilities', () => {
    it('should identify ReviewError instances', () => {
      const error = new ReviewError('Failure', ErrorCodes.UNKNOWN_ERROR);

      expect(isReviewError(error)).toBe(true);
      expect(isReviewError(new Error('Regular error'))).toBe(false);
    });

    it('should format ReviewError with its error code', () => {
      const error = new ReviewError('Something failed', ErrorCodes.AGENT_FAILED);

      expect(formatError(error)).toBe('[AGENT_FAILED] Something failed');
    });

    it('should format standard and unknown errors', () => {
      expect(formatError(new Error('Regular failure'))).toBe('Regular failure');
      expect(formatError('Unknown failure')).toBe('Unknown failure');
    });
  });
});
