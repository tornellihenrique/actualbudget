export type LoginThrottle = {
  allow(): boolean;
  recordFailure(): void;
  reset(): void;
};

// Global rather than per-IP: there is one account to protect, and a global
// budget also stops attempts spread across many addresses.
export function createLoginThrottle({
  maxFailures,
  windowMs,
  now = Date.now,
}: {
  maxFailures: number;
  windowMs: number;
  now?: () => number;
}): LoginThrottle {
  let failures: number[] = [];

  function prune() {
    const cutoff = now() - windowMs;
    failures = failures.filter(at => at > cutoff);
  }

  return {
    allow() {
      prune();
      return failures.length < maxFailures;
    },
    recordFailure() {
      failures.push(now());
    },
    reset() {
      failures = [];
    },
  };
}
