export type ServiceHealthState = "operational" | "degraded" | "unavailable";

export function classifyReadiness(input: { checkedAt: string; criticalAvailable: boolean; nonCriticalAvailable: boolean }) {
  if (!input.criticalAvailable) return { status: "unavailable" as const, checkedAt: input.checkedAt, message: "A critical service dependency is unavailable." };
  if (!input.nonCriticalAvailable) return { status: "degraded" as const, checkedAt: input.checkedAt, message: "The service is available with limited diagnostics." };
  return { status: "operational" as const, checkedAt: input.checkedAt };
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
