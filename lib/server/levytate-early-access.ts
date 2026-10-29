import { randomUUID } from "node:crypto";
import {
  isBetaApprovedEarlyAccessStatus,
  isEarlyAccessStatus,
  type EarlyAccessCreateInput,
  type EarlyAccessRequest,
  type EarlyAccessStatus,
} from "@/lib/levytate/early-access/domain";
import { normaliseSupabaseUrl, readRuntimeEnv, supabaseSelectAll } from "@/lib/server/levytate-supabase";

type SupabaseEarlyAccessRow = {
  id: string;
  organisation: string;
  contact_name: string;
  email: string;
  employee_count: string;
  biggest_challenge?: string | null;
  consent?: boolean | null;
  submitted_at?: string | null;
  status?: EarlyAccessStatus | null;
};

const supabaseTableName = "levytate_early_access_requests";

export class EarlyAccessStoreError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 503 = 400) {
    super(message);
    this.name = "EarlyAccessStoreError";
  }
}

export function normaliseEarlyAccessEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidEarlyAccessEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateEarlyAccessInput(input: EarlyAccessCreateInput) {
  if (!input.organisation.trim()) {
    throw new EarlyAccessStoreError("Organisation is required.");
  }

  if (!input.contactName.trim()) {
    throw new EarlyAccessStoreError("Contact name is required.");
  }

  const email = normaliseEarlyAccessEmail(input.email);
  if (!isValidEarlyAccessEmail(email)) {
    throw new EarlyAccessStoreError("Please enter a valid work email.");
  }

  if (!input.employeeCount.trim()) {
    throw new EarlyAccessStoreError("Employee count is required.");
  }

  if (!input.consent) {
    throw new EarlyAccessStoreError("Please confirm that you would like to be considered for early access.");
  }
}

export async function createEarlyAccessRequest(input: EarlyAccessCreateInput) {
  validateEarlyAccessInput(input);

  const request: EarlyAccessRequest = {
    id: randomUUID(),
    organisation: input.organisation.trim(),
    contactName: input.contactName.trim(),
    email: normaliseEarlyAccessEmail(input.email),
    employeeCount: input.employeeCount.trim(),
    biggestChallenge: input.biggestChallenge?.trim() ?? "",
    consent: Boolean(input.consent),
    submittedAt: new Date().toISOString(),
    status: "New",
  };

  const saved = await trySaveToSupabase(requireSupabaseConfig(), request);
  if (!saved) throw new EarlyAccessStoreError("Early access storage is temporarily unavailable.", 503);
  return saved;
}

export async function listEarlyAccessRequests() {
  return tryListFromSupabase(requireSupabaseConfig());
}

export async function getEarlyAccessRequestByEmail(email: string) {
  const normalisedEmail = normaliseEarlyAccessEmail(email);
  if (!normalisedEmail) return null;

  return tryGetByEmailFromSupabase(requireSupabaseConfig(), normalisedEmail);
}

export async function hasApprovedEarlyAccess(email: string) {
  const request = await getEarlyAccessRequestByEmail(email);
  return Boolean(request && isBetaApprovedEarlyAccessStatus(request.status));
}

export async function updateEarlyAccessStatus(id: string, status: EarlyAccessStatus) {
  if (!id.trim()) {
    throw new EarlyAccessStoreError("Lead id is required.");
  }

  if (!isEarlyAccessStatus(status)) {
    throw new EarlyAccessStoreError("Status is not recognised.");
  }

  const updated = await tryUpdateSupabaseStatus(requireSupabaseConfig(), id, status);
  if (!updated) throw new EarlyAccessStoreError("Lead could not be found.", 404);
  return updated;
}

function getSupabaseConfig() {
  const url = normaliseSupabaseUrl(readRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL"));
  const serviceRoleKey = readRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) return null;

  return {
    url,
    serviceRoleKey,
  };
}

function requireSupabaseConfig() {
  const config = getSupabaseConfig();
  if (!config) throw new EarlyAccessStoreError("Early access storage is temporarily unavailable.", 503);
  return config;
}

async function trySaveToSupabase(
  config: { url: string; serviceRoleKey: string },
  request: EarlyAccessRequest,
) {
  const response = await tryFetchSupabase(`${config.url}/rest/v1/${supabaseTableName}`, {
    method: "POST",
    headers: getSupabaseHeaders(config.serviceRoleKey, {
      Prefer: "return=representation",
    }),
    body: JSON.stringify([
      {
        id: request.id,
        organisation: request.organisation,
        contact_name: request.contactName,
        email: request.email,
        employee_count: request.employeeCount,
        biggest_challenge: request.biggestChallenge || null,
        consent: request.consent,
        submitted_at: request.submittedAt,
        status: request.status,
      },
    ]),
  });

  if (!response) throw new EarlyAccessStoreError("Early access storage is temporarily unavailable.", 503);
  if (!response.ok) {
    await readSupabaseError(response);
    throw new EarlyAccessStoreError("Early access storage is temporarily unavailable.", 503);
  }

  const rows = (await response.json()) as SupabaseEarlyAccessRow[];
  const saved = mapSupabaseRow(rows[0]);
  if (!saved || saved.id !== request.id) throw new EarlyAccessStoreError("Early access storage did not confirm this request. Please try again shortly.", 503);
  return saved;
}

async function tryListFromSupabase(config: { url: string; serviceRoleKey: string }) {
  const query = new URLSearchParams({
    select: "id,organisation,contact_name,email,employee_count,biggest_challenge,consent,submitted_at,status",
    order: "submitted_at.desc,id.asc",
  });

  try {
    const rows = await supabaseSelectAll<SupabaseEarlyAccessRow>(config, supabaseTableName, query);
    return rows.map(mapSupabaseRow).filter(Boolean) as EarlyAccessRequest[];
  } catch { throw new EarlyAccessStoreError("Early access leads could not be loaded.", 503); }
}

async function tryGetByEmailFromSupabase(config: { url: string; serviceRoleKey: string }, email: string) {
  const query = new URLSearchParams({
    select: "id,organisation,contact_name,email,employee_count,biggest_challenge,consent,submitted_at,status",
    email: `eq.${email}`,
    limit: "1",
  });

  const response = await tryFetchSupabase(`${config.url}/rest/v1/${supabaseTableName}?${query.toString()}`, {
    headers: getSupabaseHeaders(config.serviceRoleKey),
    cache: "no-store",
  });

  if (!response) throw new EarlyAccessStoreError("Early access lead could not be checked.", 503);
  if (!response.ok) {
    await readSupabaseError(response);
    throw new EarlyAccessStoreError("Early access lead could not be checked.", 503);
  }

  const rows = (await response.json()) as SupabaseEarlyAccessRow[];
  return mapSupabaseRow(rows[0]);
}

async function tryUpdateSupabaseStatus(
  config: { url: string; serviceRoleKey: string },
  id: string,
  status: EarlyAccessStatus,
) {
  const response = await tryFetchSupabase(
    `${config.url}/rest/v1/${supabaseTableName}?id=eq.${encodeURIComponent(id)}&select=id,organisation,contact_name,email,employee_count,biggest_challenge,consent,submitted_at,status`,
    {
      method: "PATCH",
      headers: getSupabaseHeaders(config.serviceRoleKey, {
        Prefer: "return=representation",
      }),
      body: JSON.stringify({ status }),
    },
  );

  if (!response) throw new EarlyAccessStoreError("Early access lead could not be updated.", 503);
  if (!response.ok) {
    await readSupabaseError(response);
    throw new EarlyAccessStoreError("Early access lead could not be updated.", 503);
  }

  const rows = (await response.json()) as SupabaseEarlyAccessRow[];
  const updated = mapSupabaseRow(rows[0]);
  if (!updated) throw new EarlyAccessStoreError("Updated lead data could not be read.", 503);
  return updated;
}

function mapSupabaseRow(row: SupabaseEarlyAccessRow | undefined | null) {
  if (!row) return null;
  if (!row.id || !row.organisation || !row.contact_name || !row.email || !row.employee_count || typeof row.consent !== "boolean"
    || typeof row.submitted_at !== "string" || !Number.isFinite(Date.parse(row.submitted_at)) || !isEarlyAccessStatus(row.status)) {
    throw new EarlyAccessStoreError("Early access data could not be verified.", 503);
  }

  return {
    id: row.id,
    organisation: row.organisation,
    contactName: row.contact_name,
    email: row.email,
    employeeCount: row.employee_count,
    biggestChallenge: row.biggest_challenge ?? "",
    consent: row.consent,
    submittedAt: row.submitted_at,
    status: row.status,
  } satisfies EarlyAccessRequest;
}

async function tryFetchSupabase(url: string, init: RequestInit) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  } catch {
    return null;
  }
}

async function readSupabaseError(response: Response) {
  try {
    const payload = (await response.json()) as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    return [payload.code, payload.message, payload.details, payload.hint]
      .filter(Boolean)
      .join(" / ");
  } catch {
    return "";
  }
}


function getSupabaseHeaders(serviceRoleKey: string, extraHeaders: Record<string, string> = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };
}
