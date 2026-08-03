import { NextResponse } from "next/server";
import {
  AuthenticationEmailDeliveryError,
  processResendDeliveryWebhook,
  recordWebhookSecurityEvent,
  resendWebhookMaxBytes,
} from "@/lib/server/levytate-auth-email-delivery";

const route = "/api/levytate-auth/delivery-events/resend";

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > resendWebhookMaxBytes) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  let rawBody = "";
  try {
    rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > resendWebhookMaxBytes) {
      return NextResponse.json({ ok: false }, { status: 413 });
    }
    const result = await processResendDeliveryWebhook(rawBody, request.headers);
    return NextResponse.json({ ok: true, duplicate: !result.inserted });
  } catch (error) {
    const eventId = request.headers.get("svix-id") ?? "missing";
    if (error instanceof AuthenticationEmailDeliveryError && error.code === "invalid_signature") {
      await recordWebhookSecurityEvent("auth.webhook_signature_rejected", eventId, "invalid_signature");
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    if (error instanceof AuthenticationEmailDeliveryError && error.code === "invalid_payload") {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    await recordWebhookSecurityEvent("auth.webhook_processing_failed", eventId, "processing_failed");
    console.error("LevyTate authentication delivery webhook failed", { route, outcome: "processing_failed" });
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}

