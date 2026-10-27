const DEFAULT_PLATFORM_ORIGIN = "https://app.levytate.co.uk";
const DEFAULT_WEBSITE_ORIGIN = "https://www.levytate.co.uk";

const marketingHosts = new Set(["levytate.co.uk", "www.levytate.co.uk"]);

const exactPublicPaths = new Set([
  "/early-access",
  "/privacy",
  "/early-access-terms",
  "/data-processing",
  "/support",
  "/account-help",
  "/data-rights",
  "/status",
  "/levytate",
  "/levytate/early-access",
  "/levytate/privacy",
  "/levytate/early-access-terms",
  "/levytate/data-processing",
  "/levytate/support",
  "/levytate/account-help",
  "/levytate/data-rights",
  "/levytate/status",
]);

const publicPathPrefixes = ["/solutions/", "/company/"];

const publicSitemapPaths = [
  "/",
  "/early-access",
  "/privacy",
  "/early-access-terms",
  "/data-processing",
  "/support",
  "/account-help",
  "/data-rights",
  "/status",
  "/solutions/employers",
  "/solutions/employees",
  "/solutions/training-providers",
  "/company/about",
  "/company/contact",
  "/company/partner",
];

export const levytatePublicFormPaths = ["/api/levytate-early-access"] as const;

export function requestHostname(hostHeader: string | null | undefined) {
  return hostHeader?.split(",")[0]?.trim().split(":")[0]?.toLowerCase() ?? "";
}

export function parseConfiguredOrigin(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const pathname = url.pathname.replace(/\/+$/, "");
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (
      !["http:", "https:"].includes(url.protocol)
      || (!local && url.protocol !== "https:")
      || url.username
      || url.password
      || url.search
      || url.hash
      || pathname
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function getLevyTatePlatformHost() {
  return new URL(parseConfiguredOrigin(process.env.LEVYTATE_APP_BASE_URL) ?? DEFAULT_PLATFORM_ORIGIN).hostname;
}

export function getLevyTateWebsiteOrigin() {
  return parseConfiguredOrigin(process.env.LEVYTATE_WEBSITE_URL) ?? DEFAULT_WEBSITE_ORIGIN;
}

export function getLevyTatePlatformOrigin(requestOrigin?: string) {
  const configured = parseConfiguredOrigin(process.env.LEVYTATE_APP_BASE_URL);
  if (configured) return configured;

  if (requestOrigin) {
    try {
      const url = new URL(requestOrigin);
      if (!isKnownLevyTateProductionHost(url.hostname) && ["http:", "https:"].includes(url.protocol)) {
        return url.origin;
      }
    } catch {
      return DEFAULT_PLATFORM_ORIGIN;
    }
  }

  if (process.env.VERCEL_ENV === "preview") {
    const host = (process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL || "").replace(/^https?:\/\//, "").trim();
    if (host) return `https://${host}`;
  }

  return DEFAULT_PLATFORM_ORIGIN;
}

export function getLevyTateLinkOrigin() {
  const configured = parseConfiguredOrigin(process.env.LEVYTATE_APP_BASE_URL);
  if (configured) return configured;

  if (process.env.VERCEL_ENV === "preview") {
    const host = (process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL || "").replace(/^https?:\/\//, "").trim();
    if (host) return `https://${host}`;
  }

  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    return DEFAULT_PLATFORM_ORIGIN;
  }

  return "http://localhost:3000";
}

export function isLevyTatePlatformHost(host: string) {
  return requestHostname(host) === getLevyTatePlatformHost();
}

export function isLevyTateMarketingHost(host: string) {
  return marketingHosts.has(requestHostname(host));
}

export function isLevyTateProductHost(host: string) {
  return isLevyTatePlatformHost(host) || isLevyTateMarketingHost(host);
}

export function isLevyTatePublicPagePath(pathname: string) {
  return exactPublicPaths.has(pathname) || publicPathPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export function isLevyTatePlatformEntryPath(pathname: string) {
  return pathname === "/login" || pathname === "/app" || pathname.startsWith("/app/");
}

export function levyTateWebsiteUrl(path: string) {
  return new URL(path, getLevyTateWebsiteOrigin()).toString();
}

export function levyTateAuthCallbackUrl(requestUrl: string, callbackPath: string) {
  return new URL(callbackPath, getLevyTatePlatformOrigin(new URL(requestUrl).origin)).toString();
}

export function levyTateEmployerSignInUrl() {
  const origin = getLevyTateLinkOrigin();
  const path = isLevyTatePlatformHost(new URL(origin).hostname) ? "/login" : "/levytate/login";
  return new URL(path, origin).toString();
}

export function levyTateProviderSignInUrl() {
  return new URL("/levytate/provider/login", getLevyTateLinkOrigin()).toString();
}

export function levyTateEmployerSignInPath(host: string) {
  return isLevyTatePlatformHost(host) ? "/login" : "/levytate/login";
}

export function levyTateAppHomePath(host: string) {
  return isLevyTatePlatformHost(host) ? "/app" : "/levytate/app";
}

export function levyTatePublicSitemap(host: string) {
  const normalised = requestHostname(host);
  if (!isLevyTatePlatformHost(normalised) && !isLevyTateMarketingHost(normalised)) return null;
  if (isLevyTatePlatformHost(normalised)) return [];

  const origin = getLevyTateWebsiteOrigin();
  return publicSitemapPaths.map((path) => new URL(path, origin).toString());
}

export function levytateSessionCookieDomain(hostHeader: string | null | undefined) {
  const host = requestHostname(hostHeader);
  if (!host || host === "localhost" || host === "127.0.0.1") return undefined;

  const configured = process.env.LEVYTATE_SESSION_COOKIE_DOMAIN?.trim().toLowerCase().replace(/^\./, "");
  if (configured) {
    const platformHost = getLevyTatePlatformHost();
    const websiteHost = new URL(getLevyTateWebsiteOrigin()).hostname;
    const coversWebsite = websiteHost === configured || websiteHost.endsWith(`.${configured}`);
    if (coversWebsite && configured !== platformHost) return undefined;
    if (host === configured || host.endsWith(`.${configured}`)) return configured;
    return undefined;
  }

  if (isLevyTatePlatformHost(host)) return getLevyTatePlatformHost();
  return undefined;
}

export function levytateAuthCookieOptions(
  maxAge: number,
  hostHeader: string | null | undefined,
  sameSite: "lax" | "strict" = "lax",
) {
  const domain = levytateSessionCookieDomain(hostHeader);
  return {
    httpOnly: true as const,
    sameSite,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
    ...(domain ? { domain } : {}),
  };
}

export function applyLevyTatePublicCors<T extends Response>(request: Request, response: T) {
  const headers = levyTatePublicCorsHeaders(request);
  headers.forEach((value, key) => response.headers.set(key, value));
  return response;
}

export function levyTatePublicCorsHeaders(request: Request) {
  const headers = new Headers({ Vary: "Origin" });
  const origin = request.headers.get("origin");
  if (!origin) return headers;

  try {
    if (new URL(origin).origin !== getLevyTateWebsiteOrigin()) return headers;
  } catch {
    return headers;
  }

  headers.set("Access-Control-Allow-Origin", new URL(origin).origin);
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Accept");
  headers.set("Access-Control-Max-Age", "86400");
  return headers;
}

function isKnownLevyTateProductionHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "levytate.co.uk"
    || host === "www.levytate.co.uk"
    || host === "app.levytate.co.uk"
    || host === getLevyTatePlatformHost();
}
