import { z } from "zod";
import { authenticatedClientFetch, type ClientIdentity } from "@/lib/levytate/client-session";
import type { LevyFinanceState } from "./types";

const money = z.number().int().safe();
const date = z.iso.date();
const transaction = z.object({
  transactionId: z.string(), transactionDate: date, description: z.string(),
  category: z.enum(["levy_in", "apprenticeship_spend", "levy_expiry", "transfer_out", "transfer_in", "refund_or_adjustment", "other"]),
  amountPence: money, sourceRow: z.number().int().positive(), fingerprint: z.string(),
  providerName: z.string().optional(), apprenticeName: z.string().optional(), programmeName: z.string().optional(),
  payeScheme: z.string().optional(), payrollMonth: z.string().optional(), reportedBalancePence: money.optional(),
});
const evidence = z.object({
  ok: z.literal(true),
  state: z.object({
    version: z.literal(1), mode: z.literal("persistent"), transactions: z.array(transaction),
    imports: z.array(z.object({
      id: z.string(), importedAt: z.iso.datetime({ offset: true }), fileName: z.string(),
      sourceRows: z.number().int().nonnegative(), newTransactions: z.number().int().nonnegative(),
      duplicateRows: z.number().int().nonnegative(), reviewRows: z.number().int().nonnegative(),
      dateRange: z.object({ from: date, to: date }).nullable(),
    })),
    manualBalancePence: money.optional(), manualBalanceConfirmedAt: z.iso.datetime({ offset: true }).optional(),
  }),
});

export const financeCopilotUnavailable = "Finance evidence is temporarily unavailable. Retry when the Finance source reconnects; no balance or transaction count can be confirmed.";

/** The mounted workspace owns this identity; never infer it from a refreshed session. */
export async function loadFinanceCopilotEvidence(identity: ClientIdentity | null): Promise<LevyFinanceState> {
  if (!identity?.email || !identity.organisationId) throw new Error("Reload your workspace before asking about Finance.");
  const response = await authenticatedClientFetch("/api/levytate-finance", { method: "GET" }, identity);
  if (response.status === 409) throw new Error("The signed-in account or employer changed. Reload your workspace before asking about Finance.");
  if (!response.ok) throw new Error(financeCopilotUnavailable);
  const result = evidence.safeParse(await response.json());
  if (!result.success) throw new Error(financeCopilotUnavailable);
  return result.data.state;
}
