import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { escapeHtml } from "@/lib/email/shared";
import { createExploreCatalogue } from "@/lib/levytate/explore/catalogue";
import { getLevyTateRateLimitEnvironment } from "@/lib/server/levytate-auth-rate-limit-config";
import { networkRateLimitKey, rateLimitKey } from "@/lib/server/levytate-auth-rate-limit";
import { loadLevyTateStandards } from "@/lib/server/levytate-apprenticeship-standards";
import { sendEmail } from "@/lib/server/resend";
import { getLevyTateSupabaseConfig, supabaseFetchJson } from "@/lib/server/levytate-supabase";

export const runtime = "nodejs";

const schema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  organisation: z.string().trim().min(2).max(140),
  jobTitle: z.string().trim().max(120),
  note: z.string().trim().max(800),
  code: z.string().regex(/^ST\d{4}$/i),
  consent: z.literal(true),
  website: z.string().max(300),
}).strict();

type RateResult = { allowed: boolean };

function json(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}

async function checkAbuseLimits(request: Request, email: string) {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new Error("RATE_LIMIT_UNAVAILABLE");

  // Persisted, shared limits across serverless instances. Fail closed on outages.
  const rules = [
    { action: "explore.interest.email.daily", key: rateLimitKey("explore-email", email), window: 86400, limit: 3 },
    { action: "explore.interest.network.hour", key: networkRateLimitKey(request), window: 3600, limit: 15 },
    { action: "explore.interest.global.hour", key: rateLimitKey("explore-global", "all"), window: 3600, limit: 120 },
  ];
  for (const rule of rules) {
    const result = await supabaseFetchJson<RateResult[]>(config, "rpc/levytate_consume_auth_rate_limit", {
      method: "POST",
      body: JSON.stringify({
        p_environment_namespace: getLevyTateRateLimitEnvironment(),
        p_action: rule.action,
        p_key_hash: rule.key,
        p_window_seconds: rule.window,
        p_limit: rule.limit,
        p_route: "/api/levytate-explore/interest",
        p_event_type: "explore_interest_rate_limited",
      }),
    });
    if (!result[0]) throw new Error("RATE_LIMIT_UNAVAILABLE");
    if (!result[0].allowed) return false;
  }
  return true;
}

export async function POST(request: Request) {
  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin || requestOrigin !== new URL(request.url).origin) {
    return json("This request must be submitted from LevyTate Explore.", 403);
  }
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
    return json("Please submit a valid request.", 415);
  }
  if (Number(request.headers.get("content-length") || 0) > 8192) {
    return json("Your request is too large.", 413);
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 8192) return json("Your request is too large.", 413);
    body = JSON.parse(raw);
  } catch {
    return json("Please check your information and try again.", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return json("Please complete your name, work email and organisation and accept the contact statement.", 400);
  const data = parsed.data;

  // Honeypot response is deliberately indistinguishable from success.
  if (data.website.trim()) return json("We've received your request.", 200);

  try {
    const allowed = await checkAbuseLimits(request, data.email);
    if (!allowed) return json("You've sent several requests recently. Please try again later.", 429);
  } catch {
    return json("Requests are temporarily unavailable. Please try again later.", 503);
  }

  const standards = await loadLevyTateStandards({ status: "Approved for delivery", programmeType: "Apprenticeship standard" });
  const standard = createExploreCatalogue(standards.standards).find(item => item.code === data.code.toUpperCase());
  if (!standard) return json("This apprenticeship cannot currently be requested. Please check its official status.", 400);

  const subject = "LevyTate Explore — new employee-led enquiry — " + data.organisation;
  const fields: Array<[string, string]> = [
    ["Employee", data.fullName],
    ["Work email", data.email],
    ["Organisation", data.organisation],
    ["Role", data.jobTitle || "Not supplied"],
    ["Apprenticeship", standard.title + " (" + standard.code + ")"],
    ["Official Skills England source", standard.officialUrl],
    ["Employee's question", data.note || "General guidance requested"],
    ["Contact permission", "Employee explicitly requested LevyTate/MPR contact through Explore"],
  ];
  const lines = fields.map(([label, value]) => label + ": " + value).join("\n");
  const table = fields.map(([label, value]) => "<tr><th style=\"padding:10px 12px;text-align:left;vertical-align:top;border-top:1px solid #e0e9e6\">" + escapeHtml(label) + "</th><td style=\"padding:10px 12px;white-space:pre-wrap;border-top:1px solid #e0e9e6\">" + escapeHtml(value) + "</td></tr>").join("");
  const html = "<!doctype html><html lang=\"en\"><body style=\"font-family:Arial,sans-serif;color:#102c3d;background:#f5f6f2;padding:24px\"><div style=\"max-width:680px;margin:auto;background:white;padding:26px;border-radius:15px\"><h1>Employee-led Explore enquiry</h1><p>The employee asked to be contacted. No manager or employer outreach has been authorised by this request.</p><table style=\"border-collapse:collapse;width:100%\">" + table + "</table><p>Do not share this enquiry with an employer without agreeing that step with the employee.</p></div></body></html>";

  // An email notification is the alpha transport, not a substitute for a persistent CRM/outbox.
  // A shared, deduplicated lead store and delivery retry policy remain release gates.
  const notify = process.env.LEVYTATE_EXPLORE_NOTIFY_EMAIL?.trim() || "hello@levytate.co.uk";
  const idempotencyKey = createHash("sha256").update("explore:" + data.email + ":" + data.code + ":" + new Date().toISOString().slice(0, 10)).digest("hex");

  try {
    await sendEmail({
      from: "LevyTate <hello@levytate.co.uk>",
      to: notify,
      subject,
      text: "New employee-led enquiry\n\n" + lines + "\n\nThe employee has NOT authorised unsolicited contact with their manager.",
      html,
      idempotencyKey,
    });
    return json("Your request has been sent to the LevyTate team. We'll contact you using the email you provided.", 200);
  } catch {
    return json("We couldn't submit your request right now. Please try again later; nothing has been confirmed.", 503);
  }
}
