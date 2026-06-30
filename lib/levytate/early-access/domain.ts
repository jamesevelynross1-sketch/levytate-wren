export const earlyAccessStatuses = [
  "New",
  "Contacted",
  "Approved",
  "Declined",
  "Onboarded",
] as const;

export const betaApprovedEarlyAccessStatuses = ["Approved", "Onboarded"] as const;

export type EarlyAccessStatus = (typeof earlyAccessStatuses)[number];

export type EarlyAccessRequest = {
  id: string;
  organisation: string;
  contactName: string;
  email: string;
  employeeCount: string;
  biggestChallenge: string;
  consent: boolean;
  submittedAt: string;
  status: EarlyAccessStatus;
};

export type EarlyAccessCreateInput = {
  organisation: string;
  contactName: string;
  email: string;
  employeeCount: string;
  biggestChallenge?: string;
  consent: boolean;
};

export type EarlyAccessUpdateInput = {
  status: EarlyAccessStatus;
};

export const earlyAccessEmployeeBands = [
  "1-49",
  "50-249",
  "250-999",
  "1,000-4,999",
  "5,000+",
] as const;

export const earlyAccessStorageKey = "levytate_early_access_requests";
export const earlyAccessApprovalTokenStorageKey = "levytate_early_access_approval_tokens";

export function isEarlyAccessStatus(value: unknown): value is EarlyAccessStatus {
  return typeof value === "string" && earlyAccessStatuses.includes(value as EarlyAccessStatus);
}

export function isBetaApprovedEarlyAccessStatus(value: unknown): value is EarlyAccessStatus {
  return typeof value === "string" && betaApprovedEarlyAccessStatuses.includes(value as (typeof betaApprovedEarlyAccessStatuses)[number]);
}
