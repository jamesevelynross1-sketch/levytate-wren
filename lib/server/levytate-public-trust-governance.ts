import "server-only";
import type { PublicTrustSlug } from "@/lib/levytate/public-trust-content";

export type PublicTrustReviewStatus = "approved_for_early_access" | "legal_approval_required";

const governance: Readonly<Record<PublicTrustSlug, { reviewStatus: PublicTrustReviewStatus; internalOwner: string; active: boolean }>> = {
  privacy: { reviewStatus: "legal_approval_required", internalOwner: "LevyTate product owner", active: true },
  "early-access-terms": { reviewStatus: "legal_approval_required", internalOwner: "LevyTate product owner", active: true },
  "data-processing": { reviewStatus: "legal_approval_required", internalOwner: "LevyTate product owner", active: true },
  support: { reviewStatus: "approved_for_early_access", internalOwner: "LevyTate support owner", active: true },
  "account-help": { reviewStatus: "approved_for_early_access", internalOwner: "LevyTate support owner", active: true },
  "data-rights": { reviewStatus: "legal_approval_required", internalOwner: "LevyTate product owner", active: true },
};

export function getPublicTrustGovernance() {
  return governance;
}
