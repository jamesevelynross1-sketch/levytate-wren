import { randomUUID } from "node:crypto";
import type { EarlyAccessStatus } from "@/lib/levytate/early-access/domain";

const subscribersTableName = "subscribers";
const pendingSegment = "levytate_early_access_pending";
const approvedSegment = "levytate_beta_access";
const declinedSegment = "levytate_early_access_declined";
const managedSegments = [pendingSegment, approvedSegment, declinedSegment] as const;

type SubscriberGrantRow = {
  email: string;
  status?: string | null;
  source_page?: string | null;
  unsubscribe_token?: string | null;
  segments?: string[] | null;
};

export type PersistentEarlyAccessState = "none" | "pending" | "approved" | "declined";

export function normaliseBetaGrantEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function getPersistentEarlyAccessState(email: string): Promise<PersistentEarlyAccessState> {
  const normalisedEmail = normaliseBetaGrantEmail(email);
  if (!normalisedEmail) return "none";

  const config = getSupabaseConfig();
  if (!config) return "none";

  const existing = await getSubscriberGrantByEmail(config, normalisedEmail);
  const segments = Array.isArray(existing?.segments) ? existing.segments : [];

  if (segments.includes(approvedSegment)) return "approved";
  if (segments.includes(declinedSegment)) return "declined";
  if (segments.includes(pendingSegment)) return "pending";
  return "none";
}

export async function syncPersistentEarlyAccessState(email: string, status: EarlyAccessStatus) {
  const normalisedEmail = normaliseBetaGrantEmail(email);
  if (!normalisedEmail) {
    throw new Error("Beta access email is required.");
  }

  const config = getSupabaseConfig();
  if (!config) {
    throw new Error("Persistent beta access storage is unavailable.");
  }

  const existing = await getSubscriberGrantByEmail(config, normalisedEmail);
  const existingSegments = Array.isArray(existing?.segments)
    ? existing.segments.filter((segment): segment is string => typeof segment === "string" && segment.trim().length > 0)
    : [];

  const retainedSegments = existingSegments.filter((segment) => !managedSegments.includes(segment as (typeof managedSegments)[number]));
  const nextSegments = [...retainedSegments, getStateSegment(status)];

  if (existing) {
    await updateSubscriberGrant(config, normalisedEmail, nextSegments);
    return;
  }

  await createSubscriberGrant(config, normalisedEmail, nextSegments);
}

function getStateSegment(status: EarlyAccessStatus) {
  if (status === "Approved" || status === "Onboarded") return approvedSegment;
  if (status === "Declined") return declinedSegment;
  return pendingSegment;
}

function getSupabaseConfig() {
  const url = readRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = readRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) return null;

  return {
    url: url.replace(/\/$/, ""),
    serviceRoleKey,
  };
}

async function getSubscriberGrantByEmail(config: { url: string; serviceRoleKey: string }, email: string) {
  const query = new URLSearchParams({
    select: "email,status,source_page,unsubscribe_token,segments",
    email: `eq.${email}`,
    limit: "1",
  });

  const response = await fetch(`${config.url}/rest/v1/${subscribersTableName}?${query.toString()}`, {
    headers: getSupabaseHeaders(config.serviceRoleKey),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Beta access grants could not be checked.");
  }

  const rows = (await response.json()) as SubscriberGrantRow[];
  return rows[0] ?? null;
}

async function createSubscriberGrant(
  config: { url: string; serviceRoleKey: string },
  email: string,
  segments: string[],
) {
  const now = new Date().toISOString();
  const response = await fetch(`${config.url}/rest/v1/${subscribersTableName}?on_conflict=email`, {
    method: "POST",
    headers: getSupabaseHeaders(config.serviceRoleKey, {
      Prefer: "resolution=merge-duplicates,return=minimal",
    }),
    body: JSON.stringify([
      {
        email,
        status: "active",
        source_page: "/levytate/early-access",
        unsubscribe_token: randomUUID(),
        segments,
        updated_at: now,
      },
    ]),
  });

  if (!response.ok) {
    throw new Error("Beta access grant could not be created.");
  }
}

async function updateSubscriberGrant(
  config: { url: string; serviceRoleKey: string },
  email: string,
  segments: string[],
) {
  const response = await fetch(
    `${config.url}/rest/v1/${subscribersTableName}?email=eq.${encodeURIComponent(email)}`,
    {
      method: "PATCH",
      headers: getSupabaseHeaders(config.serviceRoleKey, {
        Prefer: "return=minimal",
      }),
      body: JSON.stringify({
        segments,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Beta access grant could not be updated.");
  }
}

function readRuntimeEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value || value === '""' || value === "''") return "";
  return value.replace(/^["']|["']$/g, "").trim();
}

function getSupabaseHeaders(serviceRoleKey: string, extraHeaders: Record<string, string> = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };
}
