import { NextResponse } from "next/server";
import { z } from "zod";
import { createExploreCatalogue } from "@/lib/levytate/explore/catalogue";
import { getLevyTateRateLimitEnvironment } from "@/lib/server/levytate-auth-rate-limit-config";
import { networkRateLimitKey, rateLimitKey } from "@/lib/server/levytate-auth-rate-limit";
import { loadLevyTateStandards } from "@/lib/server/levytate-apprenticeship-standards";
import { dispatchExploreNotifications, saveExploreEnquiry } from "@/lib/server/levytate-explore";
import { getLevyTateSupabaseConfig, supabaseFetchJson } from "@/lib/server/levytate-supabase";

export const runtime = "nodejs";

const schema = z.object({
  requesterType: z.enum(["employee", "manager"]).default("employee"),
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

function reply(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}

async function checkAbuseLimits(request: Request, email: string) {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new Error("RATE_LIMIT_UNAVAILABLE");

  // Distributed, persistent rate limits shared by every Vercel instance.
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
  // Deliberate release switch. Public submissions remain unavailable until
  // the isolated lead store and legal/privacy acceptance tests are approved.
  if (process.env.LEVYTATE_EXPLORE_SUBMISSIONS_ENABLED !== "true") {
    return reply("Explore guidance enquiries are not yet available.", 503);
  }
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return reply("This request must come from LevyTate Explore.", 403);
  }
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
    return reply("Please submit a valid request.", 415);
  }
  if (Number(request.headers.get("content-length") || 0) > 8192) {
    return reply("Your request is too large.", 413);
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 8192) return reply("Your request is too large.", 413);
    body = JSON.parse(raw);
  } catch {
    return reply("Please check your information and try again.", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return reply("Please complete your name, work email, organisation and consent.", 400);
  const data = parsed.data;

  // Honeypot: do not disclose detection or save a lead.
  if (data.website.trim()) return reply("Your request has been received.", 200);

  try {
    const allowed = await checkAbuseLimits(request, data.email);
    if (!allowed) return reply("You've sent several requests recently. Please try again later.", 429);
  } catch {
    return reply("Requests are temporarily unavailable. Please try again later.", 503);
  }

  // A public submission can only be linked to a real selectable standard.
  // Never create leads against withdrawn, paused or unit-only records.
  let standard;
  try {
    const standards = await loadLevyTateStandards({
      status: "Approved for delivery",
      programmeType: "Apprenticeship standard",
    });
    standard = createExploreCatalogue(standards.standards).find(item => item.code === data.code.toUpperCase());
  } catch {
    return reply("Programme information is temporarily unavailable. Please try again later.", 503);
  }
  if (!standard) {
    return reply("This apprenticeship cannot currently be requested. Please review its official status.", 400);
  }

  let stored;
  try {
    stored = await saveExploreEnquiry(data, standard);
  } catch {
    return reply("We couldn't safely save your request. Nothing has been submitted; please try again later.", 503);
  }

  // The lead and outbox are already committed atomically. Notification delivery
  // is best-effort here and retryable independently; never claim an email was
  // delivered merely because Supabase accepted the record.
  if (stored.created && stored.id) {
    try {
      await dispatchExploreNotifications({ limit: 1, enquiryId: stored.id });
    } catch {
      console.error("Explore notification deferred", { category: "durable_outbox_unavailable" });
    }
  }

  return reply(
    "Your enquiry has been recorded securely. The LevyTate team can review it and follow up using the email you provided. No other person has been contacted.",
    200,
  );
}
