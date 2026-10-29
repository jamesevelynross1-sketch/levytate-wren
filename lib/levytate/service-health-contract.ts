export type ServiceHealthState = "operational" | "degraded" | "unavailable";
export type ServiceReadiness = { status: ServiceHealthState; checkedAt: string; message?: string };
export type ReadinessCheck = () => Promise<void>;

export function classifyReadiness(input: { checkedAt: string; criticalAvailable: boolean; optionalAvailable: boolean }): ServiceReadiness {
  if (!input.criticalAvailable) return { status: "unavailable" as const, checkedAt: input.checkedAt, message: "A critical service dependency is unavailable." };
  if (!input.optionalAvailable) return { status: "degraded" as const, checkedAt: input.checkedAt, message: "The service is available with a limited supporting check." };
  return { status: "operational" as const, checkedAt: input.checkedAt };
}

export async function evaluateReadinessChecks(input: {
  checkedAt: string;
  criticalChecks: readonly ReadinessCheck[];
  optionalChecks: readonly ReadinessCheck[];
  timeoutMs: number;
}) {
  const deadline = Date.now() + input.timeoutMs;
  const criticalAvailable = await checksAvailable(input.criticalChecks, input.timeoutMs);
  if (!criticalAvailable) return classifyReadiness({ checkedAt: input.checkedAt, criticalAvailable: false, optionalAvailable: true });
  const remainingMs = Math.max(0, deadline - Date.now());
  const optionalAvailable = input.optionalChecks.length === 0
    || (remainingMs > 0 && await checksAvailable(input.optionalChecks, remainingMs));
  return classifyReadiness({ checkedAt: input.checkedAt, criticalAvailable: true, optionalAvailable });
}

export function createReadinessCache(input: {
  cacheMs: number;
  evaluate: () => Promise<ServiceReadiness>;
  now?: () => number;
  onResult?: (result: ServiceReadiness, previousStatus: ServiceHealthState | null) => void;
}) {
  let cached: { expiresAt: number; promise: Promise<ServiceReadiness> } | null = null;
  let previousStatus: ServiceHealthState | null = null;
  const now = input.now ?? Date.now;

  async function evaluate() {
    const result = await input.evaluate();
    input.onResult?.(result, previousStatus);
    previousStatus = result.status;
    return result;
  }

  return {
    get(options: { bypassCache?: boolean } = {}) {
      const requestedAt = now();
      if (!options.bypassCache && cached && cached.expiresAt > requestedAt) return cached.promise;
      const promise = evaluate();
      if (!options.bypassCache) {
        const entry = { expiresAt: requestedAt + input.cacheMs, promise };
        cached = entry;
        void promise.catch(() => { if (cached === entry) cached = null; });
      }
      return promise;
    },
    clear() { cached = null; },
  };
}

export async function withHealthTimeout<T>(operation: () => Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new ServiceHealthTimeoutError()), timeoutMs); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

export class ServiceHealthTimeoutError extends Error { constructor() { super("Health check timed out"); this.name = "ServiceHealthTimeoutError"; } }

async function checksAvailable(checks: readonly ReadinessCheck[], timeoutMs: number) {
  const results = await Promise.allSettled(checks.map((check) => withHealthTimeout(check, timeoutMs)));
  return results.every((result) => result.status === "fulfilled");
}
