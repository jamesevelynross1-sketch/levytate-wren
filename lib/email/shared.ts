export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://mprconsulting.co.uk").replace(/\/$/, "");
}

export function getUnsubscribeUrl(siteUrl: string, token?: string | null, email?: string) {
  if (token) {
    return `${siteUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
  }

  return `${siteUrl}/unsubscribe?email=${encodeURIComponent(email ?? "")}`;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
