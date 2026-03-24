import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimitStore } from '@/lib/rate-limit';

describe('rate-limit', () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it('allows requests within limit', () => {
    const config = { maxRequests: 3, windowSec: 60 };
    const r1 = checkRateLimit('user-1', config);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit('user-1', config);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit('user-1', config);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('blocks requests over limit', () => {
    const config = { maxRequests: 2, windowSec: 60 };
    checkRateLimit('user-2', config);
    checkRateLimit('user-2', config);

    const r3 = checkRateLimit('user-2', config);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
    expect(r3.retryAfterSec).toBeGreaterThan(0);
    expect(r3.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it('isolates different keys', () => {
    const config = { maxRequests: 1, windowSec: 60 };
    checkRateLimit('key-a', config);

    const r2 = checkRateLimit('key-b', config);
    expect(r2.allowed).toBe(true);
  });

  it('resets when store is cleared', () => {
    const config = { maxRequests: 1, windowSec: 60 };
    checkRateLimit('user-x', config);

    const r = checkRateLimit('user-x', config);
    expect(r.allowed).toBe(false);

    resetRateLimitStore();

    const r2 = checkRateLimit('user-x', config);
    expect(r2.allowed).toBe(true);
  });
});
