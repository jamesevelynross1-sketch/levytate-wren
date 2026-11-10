import "server-only";

import { NextResponse } from "next/server";
import {
  isLevyTateAuthCookieHost,
  levytateAuthCookieOptions,
  levytateLegacySessionCookieDomain,
} from "@/lib/levytate/hosts";

export type LevyTateAuthCookie = {
  name: string;
  value: string;
  maxAge: number;
  sameSite?: "lax" | "strict";
};

export function setLevyTateAuthCookies(
  response: NextResponse,
  hostHeader: string | null | undefined,
  cookies: readonly LevyTateAuthCookie[],
) {
  if (!isLevyTateAuthCookieHost(hostHeader)) {
    throw new Error("LevyTate authentication cookies cannot be issued on this host.");
  }

  // Cookie identity is name + domain + path; the host-only flag is not part of
  // that key. Expire the legacy Domain variant first so the replacement
  // host-only cookie is the final value processed by the browser.
  expireLegacyDomainCookies(response, hostHeader, cookies);

  for (const cookie of cookies) {
    appendCookie(response, cookie.name, cookie.value, {
      ...levytateAuthCookieOptions(cookie.maxAge, hostHeader, cookie.sameSite),
    });
  }

  return response;
}

export function expireLevyTateAuthCookies(
  response: NextResponse,
  hostHeader: string | null | undefined,
  names: readonly string[],
) {
  const cookies = names.map((name) => ({ name, value: "", maxAge: 0 }) satisfies LevyTateAuthCookie);
  for (const cookie of cookies) {
    appendCookie(response, cookie.name, "", {
      ...levytateAuthCookieOptions(0, hostHeader),
      expires: new Date(0),
    });
  }

  expireLegacyDomainCookies(response, hostHeader, cookies);
  return response;
}

function expireLegacyDomainCookies(
  response: NextResponse,
  hostHeader: string | null | undefined,
  cookies: readonly Pick<LevyTateAuthCookie, "name" | "sameSite">[],
) {
  const domain = levytateLegacySessionCookieDomain(hostHeader);
  if (!domain) return;

  for (const cookie of cookies) {
    appendCookie(response, cookie.name, "", {
      ...levytateAuthCookieOptions(0, hostHeader, cookie.sameSite),
      domain,
      expires: new Date(0),
    });
  }
}

function appendCookie(
  response: NextResponse,
  name: string,
  value: string,
  options: Parameters<NextResponse["cookies"]["set"]>[2],
) {
  // ResponseCookies de-duplicates by name, including host-only and Domain variants.
  // Serialise each cookie independently, then append it so both migration headers survive.
  const serialised = new NextResponse();
  serialised.cookies.set(name, value, options);
  const header = serialised.headers.get("set-cookie");
  if (!header) throw new Error("LevyTate authentication cookie serialisation failed.");
  response.headers.append("set-cookie", header);
}
