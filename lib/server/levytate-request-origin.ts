import { isLevyTateAuthCookieHost, parseConfiguredOrigin } from "@/lib/levytate/hosts";

/** Next may use an internal hostname in request.url. The HTTP Host is the
 * browser authority, but only a configured application/deployment/loopback
 * host is trusted. Forwarded-Host and client-supplied redirect URLs are ignored.
 */
export function applicationRequestOrigin(request: Request): string {
  const internal = new URL(request.url);
  const host = (request.headers.get("host") ?? internal.host).trim().toLowerCase();
  if (!host || /[\s,/@\\?#]/.test(host) || !isLevyTateAuthCookieHost(host)) throw new Error("Unrecognised application host.");
  const parsed = new URL(`https://${host}`);
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (!local && parsed.port && parsed.origin !== parseConfiguredOrigin(process.env.LEVYTATE_APP_BASE_URL)) throw new Error("Unrecognised application port.");
  const protocol = local ? internal.protocol : "https:";
  if (protocol !== "http:" && protocol !== "https:") throw new Error("Invalid application protocol.");
  return new URL(`${protocol}//${host}`).origin;
}

export function applicationRequestUrl(request: Request): URL {
  const incoming = new URL(request.url);
  const result = new URL(applicationRequestOrigin(request));
  result.pathname = incoming.pathname;
  result.search = incoming.search;
  return result;
}
