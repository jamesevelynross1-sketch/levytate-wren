import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const adminCookieName = "mpr_admin_subscribers";
const adminSessionValue = "mpr-admin-subscribers";

export function getAdminPasswordConfigured() {
  return Boolean(getAdminPassword());
}

export function isValidAdminPassword(password: string) {
  const adminPassword = getAdminPassword();

  if (!adminPassword) {
    return false;
  }

  return safeEqual(password, adminPassword);
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  const token = cookieStore.get(adminCookieName)?.value;

  return Boolean(token && safeEqual(token, createAdminToken()));
}

export async function setAdminSessionCookie() {
  const cookieStore = await cookies();

  cookieStore.set(adminCookieName, createAdminToken(), {
    httpOnly: true,
    maxAge: 60 * 60 * 8,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin/subscribers",
  });
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(adminCookieName);
}

function getAdminPassword() {
  return process.env.ADMIN_SUBSCRIBERS_PASSWORD ?? process.env.ADMIN_PASSWORD;
}

function createAdminToken() {
  const adminPassword = getAdminPassword() ?? "not-configured";

  return createHmac("sha256", adminPassword)
    .update(adminSessionValue)
    .digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
