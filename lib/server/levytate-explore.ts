import { createHash } from "node:crypto";
import { escapeHtml } from "@/lib/email/shared";
import { type ExploreStandard } from "@/lib/levytate/explore/catalogue";
import {
  EXPLORE_GUIDANCE_CONSENT_TEXT, EXPLORE_GUIDANCE_CONSENT_VERSION,
  EXPLORE_MANAGER_CONSENT_TEXT, EXPLORE_MANAGER_CONSENT_VERSION,
  type ExploreRequesterType,
  type ExploreEnquiryStatus, type ExploreRevenueRoute,
} from "@/lib/levytate/explore/policy";
import { getLevyTateRateLimitEnvironment } from "@/lib/server/levytate-auth-rate-limit-config";
import {
  getLevyTateSupabaseConfig, supabaseInsert, supabaseSelect,
  supabaseUpdate, supabaseFetchJson,
} from "@/lib/server/levytate-supabase";
import { sendEmail } from "@/lib/server/resend";

const ENQUIRIES_TABLE = "levytate_explore_enquiries";

type ExploreEnvironment = "local" | "preview" | "production";

export type ExploreEnquiryRow = {
  id: string;
  environment_namespace: ExploreEnvironment;
  requester_type: ExploreRequesterType;
  full_name: string;
  email: string;
  organisation: string;
  job_title: string;
  employee_note: string;
  standard_code: string;
  standard_title: string;
  source_url: string;
  source_version: string;
  source_last_verified: string | null;
  consent_version: string;
  consent_text: string;
  consent_given_at: string;
  manager_contact_authorised: false;
  status: ExploreEnquiryStatus;
  commercial_route: ExploreRevenueRoute;
  internal_notes: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

type OutboxClaim = {
  notification_id: string;
  enquiry_id: string;
  claim_token: string;
};

export type ExploreEnquiryInput = {
  requesterType: ExploreRequesterType;
  fullName: string;
  email: string;
  organisation: string;
  jobTitle: string;
  note: string;
};

export class ExploreStoreUnavailable extends Error {
  constructor() {
    super("Explore enquiries are temporarily unavailable.");
    this.name = "ExploreStoreUnavailable";
  }
}

function requireConfig() {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new ExploreStoreUnavailable();
  return config;
}

function environment(): ExploreEnvironment {
  return getLevyTateRateLimitEnvironment();
}

export function makeExploreDedupeKey(email: string, code: string, requesterType: ExploreRequesterType, now = new Date(), namespace = environment()) {
  return createHash("sha256")
    .update(["explore-v1", namespace, requesterType, email.trim().toLowerCase(), code.toUpperCase(), now.toISOString().slice(0, 10)].join("\u0000"))
    .digest("hex");
}

export async function saveExploreEnquiry(input: ExploreEnquiryInput, standard: ExploreStandard) {
  const config = requireConfig();
  const namespace = environment();
  const record = {
    environment_namespace: namespace,
    dedupe_key: makeExploreDedupeKey(input.email, standard.code, input.requesterType),
    requester_type: input.requesterType,
    full_name: input.fullName,
    email: input.email,
    organisation: input.organisation,
    job_title: input.jobTitle,
    employee_note: input.note,
    standard_code: standard.code,
    standard_title: standard.title,
    source_url: standard.officialUrl,
    source_version: standard.version,
    source_last_verified: /^\d{4}-\d{2}-\d{2}$/.test(standard.sourceVerified) ? standard.sourceVerified : null,
    consent_version: input.requesterType === "manager" ? EXPLORE_MANAGER_CONSENT_VERSION : EXPLORE_GUIDANCE_CONSENT_VERSION,
    consent_text: input.requesterType === "manager" ? EXPLORE_MANAGER_CONSENT_TEXT : EXPLORE_GUIDANCE_CONSENT_TEXT,
  };

  try {
    // The database AFTER INSERT trigger atomically creates the private outbox entry.
    // A same-day duplicate does not create another lead or email.
    const onConflict = new URLSearchParams({ on_conflict: "environment_namespace,dedupe_key" }).toString();
    const rows = await supabaseInsert<Pick<ExploreEnquiryRow, "id">>(config, ENQUIRIES_TABLE, record, {
      query: onConflict,
      prefer: "resolution=ignore-duplicates,return=representation",
    });
    if (!Array.isArray(rows)) throw new ExploreStoreUnavailable();
    return { created: Boolean(rows[0]?.id), id: rows[0]?.id || null };
  } catch {
    // No email-only fallback; never claim acceptance without durable storage.
    throw new ExploreStoreUnavailable();
  }
}

export async function listExploreEnquiries(status?: ExploreEnquiryStatus, limit = 80) {
  const config = requireConfig();
  const query = new URLSearchParams({
    select: "id,environment_namespace,requester_type,full_name,email,organisation,job_title,employee_note,standard_code,standard_title,source_url,source_version,source_last_verified,consent_version,consent_text,consent_given_at,manager_contact_authorised,status,commercial_route,internal_notes,updated_by,created_at,updated_at",
    environment_namespace: "eq." + environment(),
    order: "created_at.desc",
    limit: String(Math.max(1, Math.min(limit, 100))),
  });
  if (status) query.set("status", "eq." + status);
  return supabaseSelect<ExploreEnquiryRow>(config, ENQUIRIES_TABLE, query);
}

export async function updateExploreEnquiry(
  id: string,
  expectedUpdatedAt: string,
  status: ExploreEnquiryStatus,
  commercialRoute: ExploreRevenueRoute,
  internalNotes: string,
  administrator: string,
) {
  const config = requireConfig();
  const query = new URLSearchParams({
    id: "eq." + id,
    environment_namespace: "eq." + environment(),
    updated_at: "eq." + expectedUpdatedAt,
    select: "id,environment_namespace,requester_type,full_name,email,organisation,job_title,employee_note,standard_code,standard_title,source_url,source_version,source_last_verified,consent_version,consent_text,consent_given_at,manager_contact_authorised,status,commercial_route,internal_notes,updated_by,created_at,updated_at",
  });
  // Optimistic concurrency prevents one administrator silently overwriting another.
  const rows = await supabaseUpdate<ExploreEnquiryRow>(config, ENQUIRIES_TABLE, query.toString(), {
    status,
    commercial_route: commercialRoute,
    internal_notes: internalNotes,
    updated_by: administrator,
  });
  return rows[0] ?? null;
}

function emailBody(lead: ExploreEnquiryRow) {
  const facts: Array<[string, string]> = [
    ["Enquiry initiated by", lead.requester_type === "manager" ? "Line manager" : "Employee"],
    ["Name", lead.full_name],
    ["Work email", lead.email],
    ["Organisation", lead.organisation],
    ["Role", lead.job_title || "Not provided"],
    ["Programme", lead.standard_title + " (" + lead.standard_code + ")"],
    ["Official source", lead.source_url],
    ["Enquiry note", lead.employee_note || "General apprenticeship guidance requested"],
    ["Consent version", lead.consent_version],
    ["Consent time", lead.consent_given_at],
  ];
  const plain = facts.map(([key, value]) => key + ": " + value).join("\n");
  const table = facts.map(([key, value]) =>
    "<tr><th style=\"text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid #e4ebe8\">" +
    escapeHtml(key) +
    "</th><td style=\"padding:10px;white-space:pre-wrap;border-bottom:1px solid #e4ebe8\">" +
    escapeHtml(value) + "</td></tr>",
  ).join("");
  return {
    subject: "LevyTate Explore enquiry · " + lead.organisation,
    text: "New " + lead.requester_type + "-initiated Explore enquiry\n\n" + plain +
      "\n\nThe named requester chose to contact MPR. Do not contact any other employee or employer representative without a separate agreed step.",
    html: "<!doctype html><html lang=\"en\"><body style=\"font-family:Arial,sans-serif;color:#102c3d;background:#f5f6f2;padding:22px\"><div style=\"margin:auto;max-width:680px;background:#fff;padding:25px;border-radius:18px\"><h1>New Explore enquiry</h1><p>The named requester has asked for LevyTate/MPR guidance. Unsolicited third-party outreach is not authorised.</p><table style=\"border-collapse:collapse;width:100%\">" +
      table + "</table><p style=\"font-weight:bold\">Do not contact anyone other than the named requester without separate permission.</p></div></body></html>",
  };
}

export async function dispatchExploreNotifications({
  limit = 5,
  enquiryId = null,
}: {
  limit?: number;
  enquiryId?: string | null;
} = {}) {
  const config = requireConfig();
  const namespace = environment();

  const claims = await supabaseFetchJson<OutboxClaim[]>(config, "rpc/levytate_claim_explore_notifications", {
    method: "POST",
    body: JSON.stringify({
      p_environment_namespace: namespace,
      p_limit: Math.max(1, Math.min(limit, 25)),
      p_enquiry_id: enquiryId,
    }),
  });
  if (!Array.isArray(claims)) throw new ExploreStoreUnavailable();

  const summary = { claimed: claims.length, sent: 0, deferred: 0 };

  for (const claim of claims) {
    let succeeded = false;
    let errorCode = "delivery_failed";
    try {
      const query = new URLSearchParams({
        select: "id,environment_namespace,requester_type,full_name,email,organisation,job_title,employee_note,standard_code,standard_title,source_url,source_version,source_last_verified,consent_version,consent_text,consent_given_at,manager_contact_authorised,status,commercial_route,internal_notes,updated_by,created_at,updated_at",
        environment_namespace: "eq." + namespace,
        id: "eq." + claim.enquiry_id,
        limit: "1",
      });
      const leads = await supabaseSelect<ExploreEnquiryRow>(config, ENQUIRIES_TABLE, query);
      const lead = leads[0];
      if (!lead) {
        errorCode = "enquiry_not_found";
      } else {
        const to = process.env.LEVYTATE_EXPLORE_NOTIFY_EMAIL?.trim() || "hello@levytate.co.uk";
        await sendEmail({
          from: "LevyTate <hello@levytate.co.uk>",
          to,
          ...emailBody(lead),
          idempotencyKey: "levytate-explore-" + claim.notification_id,
        });
        succeeded = true;
      }
    } catch {
      errorCode = "email_or_store_unavailable";
    }

    // If completing a lease fails, it is safely eligible for re-claim
    // after 15 minutes, using the same email-provider idempotency key.
    const committed = await supabaseFetchJson<boolean>(config, "rpc/levytate_complete_explore_notification", {
      method: "POST",
      body: JSON.stringify({
        p_notification_id: claim.notification_id,
        p_claim_token: claim.claim_token,
        p_success: succeeded,
        p_error_code: succeeded ? "" : errorCode,
      }),
    });
    if (committed !== true) {
      throw new ExploreStoreUnavailable();
    }
    if (succeeded) summary.sent += 1;
    else summary.deferred += 1;
  }
  return summary;
}
