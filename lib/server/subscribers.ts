import { randomUUID } from "node:crypto";
import {
  defaultSegments,
  type IntelligenceSegment,
  normaliseSegments,
} from "@/lib/segments";

export type Subscriber = {
  id: string;
  email: string;
  unsubscribeToken: string | null;
  segments: IntelligenceSegment[];
};

type SubscriberStatus = "active" | "unsubscribed";

export type AdminSubscriber = {
  email: string;
  status: SubscriberStatus;
  createdAt: string;
  sourcePage: string | null;
  segments: IntelligenceSegment[];
};

type SupabaseSubscriberRow = {
  id: string;
  email: string;
  status?: SubscriberStatus;
  unsubscribe_token?: string | null;
  created_at?: string;
  source_page?: string | null;
  segments?: string[] | null;
};

type UpsertSubscriberInput = {
  email: string;
  sourcePage?: string;
  segments?: IntelligenceSegment[];
};

type SubscriberStoreErrorCode =
  | "missing_supabase_env"
  | "supabase_request_failed";

export class SubscriberStoreError extends Error {
  code: SubscriberStoreErrorCode;
  status?: number;
  details?: string;
  missingEnv?: string[];

  constructor(
    message: string,
    options: {
      code: SubscriberStoreErrorCode;
      status?: number;
      details?: string;
      missingEnv?: string[];
    },
  ) {
    super(message);
    this.name = "SubscriberStoreError";
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
    this.missingEnv = options.missingEnv;
  }
}

export function normaliseEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function getSubscriberByEmail(email: string) {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const response = await fetchSupabase(
    `${url}/rest/v1/subscribers?email=eq.${encodeURIComponent(
      email,
    )}&select=id,email,status,unsubscribe_token,segments&limit=1`,
    {
      headers: getSupabaseHeaders(serviceRoleKey),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw await getSupabaseResponseError(response, "Could not fetch subscriber.");
  }

  const rows = (await response.json()) as SupabaseSubscriberRow[];
  const row = rows[0];

  return row
    ? {
        id: row.id,
        email: row.email,
        status: row.status ?? "active",
        unsubscribeToken: row.unsubscribe_token ?? null,
        segments: normaliseSegments(row.segments),
      }
    : null;
}

export async function upsertSubscriber(input: UpsertSubscriberInput): Promise<Subscriber> {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const now = new Date().toISOString();
  const unsubscribeToken = randomUUID();
  const response = await fetchSupabase(`${url}/rest/v1/subscribers?on_conflict=email`, {
    method: "POST",
    headers: getSupabaseHeaders(serviceRoleKey, {
      Prefer: "resolution=merge-duplicates,return=representation",
    }),
    body: JSON.stringify([
      {
        email: input.email,
        source_page: input.sourcePage ?? "/insights",
        status: "active",
        updated_at: now,
        unsubscribed_at: null,
        unsubscribe_token: unsubscribeToken,
        segments: input.segments ?? defaultSegments,
      },
    ]),
  });

  if (!response.ok) {
    throw await getSupabaseResponseError(response, "Could not save subscriber.");
  }

  const rows = (await response.json()) as SupabaseSubscriberRow[];
  const row = rows[0];

  return {
    id: row?.id ?? "",
    email: row?.email ?? input.email,
    unsubscribeToken: row?.unsubscribe_token ?? unsubscribeToken,
    segments: normaliseSegments(row?.segments ?? input.segments),
  };
}

export async function updateSubscriberSegments(
  email: string,
  segments: IntelligenceSegment[],
) {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const now = new Date().toISOString();
  const response = await fetchSupabase(
    `${url}/rest/v1/subscribers?email=eq.${encodeURIComponent(email)}`,
    {
      method: "PATCH",
      headers: getSupabaseHeaders(serviceRoleKey, {
        Prefer: "return=minimal",
      }),
      body: JSON.stringify({
        segments,
        updated_at: now,
      }),
    },
  );

  if (!response.ok) {
    throw await getSupabaseResponseError(response, "Could not update subscriber segments.");
  }
}

export async function unsubscribeSubscriber(email: string) {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const now = new Date().toISOString();
  const response = await fetchSupabase(
    `${url}/rest/v1/subscribers?email=eq.${encodeURIComponent(email)}`,
    {
      method: "PATCH",
      headers: getSupabaseHeaders(serviceRoleKey, {
        Prefer: "return=minimal",
      }),
      body: JSON.stringify({
        status: "unsubscribed",
        updated_at: now,
        unsubscribed_at: now,
      }),
    },
  );

  if (!response.ok) {
    throw await getSupabaseResponseError(response, "Could not unsubscribe email.");
  }
}

export async function unsubscribeSubscriberByToken(token: string) {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const now = new Date().toISOString();
  const response = await fetchSupabase(
    `${url}/rest/v1/subscribers?unsubscribe_token=eq.${encodeURIComponent(token)}`,
    {
      method: "PATCH",
      headers: getSupabaseHeaders(serviceRoleKey, {
        Prefer: "return=minimal",
      }),
      body: JSON.stringify({
        status: "unsubscribed",
        updated_at: now,
        unsubscribed_at: now,
      }),
    },
  );

  if (!response.ok) {
    throw await getSupabaseResponseError(response, "Could not unsubscribe token.");
  }
}

export async function getActiveSubscribers(): Promise<Subscriber[]> {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const response = await fetchSupabase(
    `${url}/rest/v1/subscribers?status=eq.active&select=id,email,unsubscribe_token,segments`,
    {
      headers: getSupabaseHeaders(serviceRoleKey),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw await getSupabaseResponseError(response, "Could not fetch subscribers.");
  }

  const rows = (await response.json()) as SupabaseSubscriberRow[];
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    unsubscribeToken: row.unsubscribe_token ?? null,
    segments: normaliseSegments(row.segments),
  }));
}

export async function getSubscribersForAdmin(search = "", segment = ""): Promise<AdminSubscriber[]> {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const trimmedSearch = search.trim().toLowerCase();
  const query = new URLSearchParams({
    select: "email,status,created_at,source_page,segments",
    order: "created_at.desc",
  });

  if (trimmedSearch) {
    query.set("email", `ilike.*${trimmedSearch}*`);
  }

  if (segment) {
    query.set("segments", `cs.{${segment}}`);
  }

  const response = await fetchSupabase(`${url}/rest/v1/subscribers?${query.toString()}`, {
    headers: getSupabaseHeaders(serviceRoleKey),
    cache: "no-store",
  });

  if (!response.ok) {
    throw await getSupabaseResponseError(response, "Could not fetch admin subscribers.");
  }

  const rows = (await response.json()) as SupabaseSubscriberRow[];

  return rows.map((row) => ({
    email: row.email,
    status: row.status ?? "active",
    createdAt: row.created_at ?? "",
    sourcePage: row.source_page ?? null,
    segments: normaliseSegments(row.segments),
  }));
}

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missingEnv = [
    { name: "NEXT_PUBLIC_SUPABASE_URL", value: url },
    { name: "SUPABASE_SERVICE_ROLE_KEY", value: serviceRoleKey },
  ]
    .filter((entry) => !entry.value)
    .map((entry) => entry.name);

  if (missingEnv.length > 0) {
    throw new SubscriberStoreError("Supabase environment variables are not configured.", {
      code: "missing_supabase_env",
      missingEnv,
    });
  }

  return {
    url: url!.replace(/\/$/, ""),
    serviceRoleKey: serviceRoleKey!,
  };
}

async function fetchSupabase(url: string, init: RequestInit) {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw new SubscriberStoreError("Supabase request could not be completed.", {
      code: "supabase_request_failed",
      details: error instanceof Error ? error.message : undefined,
    });
  }
}

function getSupabaseHeaders(
  serviceRoleKey: string,
  extraHeaders: Record<string, string> = {},
) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };
}

async function getSupabaseResponseError(response: Response, fallback: string) {
  const message = await getSupabaseErrorMessage(response, fallback);

  return new SubscriberStoreError(message, {
    code: "supabase_request_failed",
    status: response.status,
    details: getFriendlySupabaseDetails(message),
  });
}

async function getSupabaseErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as {
      code?: string;
      message?: string;
      details?: string;
      hint?: string;
    };
    return [payload.code, payload.message, payload.details, payload.hint]
      .filter(Boolean)
      .join(" / ") || fallback;
  } catch {
    return fallback;
  }
}

function getFriendlySupabaseDetails(message: string) {
  const normalised = message.toLowerCase();

  if (normalised.includes("relation") && normalised.includes("subscribers")) {
    return "The Supabase subscribers table is missing or unavailable.";
  }

  if (normalised.includes("column")) {
    return "The Supabase subscribers table schema does not match the application.";
  }

  return undefined;
}
