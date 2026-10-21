/**
 * Public Explore consent is independent of employer-tenant terms.
 * Version this text whenever the contact purpose or disclosure changes.
 */
export const EXPLORE_GUIDANCE_CONSENT_VERSION = "explore-guidance-v1";
export const EXPLORE_GUIDANCE_CONSENT_TEXT =
  "I agree that LevyTate, operated by MPR Consulting, can use my details to contact me about this development enquiry. I understand my employer will not be contacted without a separate agreed step.";
export const EXPLORE_MANAGER_CONSENT_VERSION = "explore-manager-v1";
export const EXPLORE_MANAGER_CONSENT_TEXT =
  "I agree that LevyTate, operated by MPR Consulting, can use my details to contact me about this employee development enquiry as a manager. I understand that no other employee or colleague will be contacted without a separate agreed step.";
export type ExploreRequesterType = "employee" | "manager";
export const EXPLORE_PRIVACY_URL = "/explore/privacy";

export const EXPLORE_ENQUIRY_STATUSES = [
  "new",
  "in_review",
  "guidance_sent",
  "manager_conversation",
  "provider_matching",
  "enrolled",
  "converted_to_levytate",
  "closed",
] as const;
export type ExploreEnquiryStatus = (typeof EXPLORE_ENQUIRY_STATUSES)[number];

export const EXPLORE_REVENUE_ROUTES = [
  "unqualified",
  "provider_referral",
  "levytate_licence",
  "both",
  "none",
] as const;
export type ExploreRevenueRoute = (typeof EXPLORE_REVENUE_ROUTES)[number];

export const EXPLORE_STATUS_LABELS: Record<ExploreEnquiryStatus, string> = {
  new: "New enquiry",
  in_review: "Reviewing",
  guidance_sent: "Guidance provided",
  manager_conversation: "Manager conversation",
  provider_matching: "Provider matching",
  enrolled: "Enrolled",
  converted_to_levytate: "LevyTate client",
  closed: "Closed",
};
export const EXPLORE_ROUTE_LABELS: Record<ExploreRevenueRoute, string> = {
  unqualified: "Not yet qualified",
  provider_referral: "MPR provider referral",
  levytate_licence: "LevyTate licence",
  both: "Both potential routes",
  none: "No commercial opportunity",
};
