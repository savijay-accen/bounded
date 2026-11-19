import { describe, it, expect } from 'vitest';
import {
  RateLimiter,
  DEFAULT_RATE_LIMITS,
  withRateLimit,
} from '../src/utils/rate-limiter.js';

describe('RateLimiter', () => {
  it('should use default rate limits', () => {
    const limiter = new RateLimiter();

    expect(limiter.getStatus().activeRequests).toBe(0);
    expect(limiter.getStatus().availableRequests).toBe(
      DEFAULT_RATE_LIMITS.maxRequestsPerMinute
    );
  });

  it('should accept custom rate limits', () => {
    const limiter = new RateLimiter({
      maxRequestsPerMinute: 10,
      maxTokensPerMinute: 5000,
      maxConcurrent: 2,
    });

    const status = limiter.getStatus();

    expect(status.availableRequests).toBe(10);
    expect(status.availableTokens).toBe(5000);
  });

  it('should record a request when acquired', async () => {
    const limiter = new RateLimiter();

    await limiter.acquire(500);

    const status = limiter.getStatus();

    expect(status.activeRequests).toBe(1);
    expect(status.requestsInWindow).toBe(1);
    expect(status.tokensInWindow).toBe(500);
  });

  it('should reject invalid token estimates', async () => {
    const limiter = new RateLimiter();

    await expect(limiter.acquire(-100)).rejects.toThrow();
    await expect(limiter.acquire(Infinity)).rejects.toThrow();
    await expect(limiter.acquire(200000)).rejects.toThrow();
  });

  it('should release an active request', async () => {
    const limiter = new RateLimiter();

    await limiter.acquire(500);
    limiter.release();

    expect(limiter.getStatus().activeRequests).toBe(0);
  });

  it('should update token usage after release', async () => {
    const limiter = new RateLimiter();

    await limiter.acquire(500);
    limiter.release(300);

    expect(limiter.getStatus().tokensInWindow).toBe(300);
  });

  it('should enforce the concurrent request limit', async () => {
    const limiter = new RateLimiter({ maxConcurrent: 1 });

    await limiter.acquire(100);

    let secondRequestCompleted = false;
    const secondRequest = limiter.acquire(100).then(() => {
      secondRequestCompleted = true;
    });

    await Promise.resolve();

    expect(limiter.getStatus().activeRequests).toBe(1);
    expect(secondRequestCompleted).toBe(false);

    limiter.release();
    await secondRequest;

    expect(secondRequestCompleted).toBe(true);
    expect(limiter.getStatus().activeRequests).toBe(1);

    limiter.release();
  });

  it('should execute a function through withRateLimit', async () => {
    const limiter = new RateLimiter();
    const operation = async () => 'success';

    const result = await withRateLimit(limiter, operation, 100);

    expect(result).toBe('success');
    expect(limiter.getStatus().activeRequests).toBe(0);
  });

  it('should release the request slot when the function fails', async () => {
    const limiter = new RateLimiter();
    const operation = async () => {
      throw new Error('Operation failed');
    };

    await expect(
      withRateLimit(limiter, operation, 100)
    ).rejects.toThrow('Operation failed');

    expect(limiter.getStatus().activeRequests).toBe(0);
  });
});
