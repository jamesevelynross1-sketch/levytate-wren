import { NextResponse } from "next/server";
import { BoundedJsonBodyError, readBoundedText } from "@/lib/server/bounded-json";
import { checkDeliveryWebhookLimit } from "@/lib/server/levytate-auth-rate-limit";
import {
  AuthenticationEmailDeliveryError,
  processResendDeliveryWebhook,
  recordWebhookSecurityEvent,
  resendWebhookMaxBytes,
} from "@/lib/server/levytate-auth-email-delivery";

const route = "/api/levytate-auth/delivery-events/resend";

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") return NextResponse.json({ ok: false }, { status: 415 });
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > resendWebhookMaxBytes) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  let rawBody = "";
  try {
    rawBody = await readBoundedText(request, resendWebhookMaxBytes);
    if (!(await checkDeliveryWebhookLimit(request)).allowed) return NextResponse.json({ ok: false }, { status: 429 });
    const result = await processResendDeliveryWebhook(rawBody, request.headers);
    return NextResponse.json({ ok: true, duplicate: !result.inserted });
  } catch (error) {
    if (error instanceof BoundedJsonBodyError) return NextResponse.json({ ok: false }, { status: error.tooLarge ? 413 : 400 });
    const eventId = request.headers.get("svix-id") ?? "missing";
    if (error instanceof AuthenticationEmailDeliveryError && error.code === "invalid_signature") {
      await recordWebhookSecurityEvent("auth.webhook_signature_rejected", eventId, "invalid_signature").catch(() => undefined);
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    if (error instanceof AuthenticationEmailDeliveryError && error.code === "invalid_payload") {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    await recordWebhookSecurityEvent("auth.webhook_processing_failed", eventId, "processing_failed").catch(() => undefined);
    console.error("LevyTate authentication delivery webhook failed", { route, outcome: "processing_failed" });
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}

