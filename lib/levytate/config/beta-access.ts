export const levytateBetaSessionCookie = "levytate_beta_session";

export const levytateBetaAllowedEmails: string[] = [];

export function getLevyTateBetaAccessCode() {
  return process.env.LEVYTATE_BETA_CODE ?? "LEVYTATE-BETA";
}

export function isAllowedBetaEmail(email: string) {
  const normalised = email.trim().toLowerCase();
  if (!normalised || !normalised.includes("@")) return false;
  if (!levytateBetaAllowedEmails.length) return true;
  return levytateBetaAllowedEmails.map((item) => item.toLowerCase()).includes(normalised);
}
