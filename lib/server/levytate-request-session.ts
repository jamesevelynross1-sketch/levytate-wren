import { levytateBetaSessionCookie, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";

export function readRequestCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return undefined;
}

export async function readRequestLevyTateBetaSession(request: Request) {
  return readLevyTateBetaSession(readRequestCookie(request.headers.get("cookie"), levytateBetaSessionCookie));
}
