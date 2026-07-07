import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/email/shared";
import { buildWelcomeEmail } from "@/lib/email/welcome";
import { normaliseSegments } from "@/lib/segments";
import { sendEmail } from "@/lib/server/resend";
import {
  getSubscriberByEmail,
  isValidEmail,
  normaliseEmail,
  SubscriberStoreError,
  updateSubscriberSegments,
  upsertSubscriber,
} from "@/lib/server/subscribers";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: unknown;
      sourcePage?: unknown;
      segments?: unknown;
    };
    const email = normaliseEmail(body.email);
    const segments = normaliseSegments(body.segments);
    const safePayload = {
      emailDomain: email.includes("@") ? email.split("@").at(-1) : "invalid",
      sourcePage: typeof body.sourcePage === "string" ? body.sourcePage : "/insights",
      segments,
    };

    console.info("Subscribe request received", safePayload);

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { message: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    const existingSubscriber = await getSubscriberByEmail(email);

    if (existingSubscriber?.status === "active") {
      await updateSubscriberSegments(email, segments);

      console.info("Subscribe request completed", {
        ...safePayload,
        result: "already_subscribed",
      });

      return NextResponse.json({
        ok: true,
        alreadySubscribed: true,
        message: "You're already subscribed. Your briefing preferences have been updated.",
      });
    }

    const subscriber = await upsertSubscriber({
      email,
      sourcePage: typeof body.sourcePage === "string" ? body.sourcePage : "/insights",
      segments,
    });
    const welcomeEmail = buildWelcomeEmail({
      recipientEmail: subscriber.email,
      siteUrl: getSiteUrl(),
      unsubscribeToken: subscriber.unsubscribeToken,
    });

    try {
      await sendEmail({
        to: subscriber.email,
        subject: welcomeEmail.subject,
        html: welcomeEmail.html,
        text: welcomeEmail.text,
      });
    } catch (emailError) {
      console.error("Welcome email send failed", {
        subscriberId: subscriber.id,
        error: emailError instanceof Error ? emailError.message : "Unknown email error",
      });
    }

    console.info("Subscribe request completed", {
      ...safePayload,
      result: existingSubscriber?.status === "unsubscribed" ? "reactivated" : "created",
      welcomeEmailAttempted: true,
    });

    return NextResponse.json({
      ok: true,
      reactivated: existingSubscriber?.status === "unsubscribed",
      message:
        "Thank you for subscribing. You'll now receive MPR Insights based on your selected interests.",
    });
  } catch (error) {
    console.error("Subscribe route failed", getSafeSubscribeError(error));

    if (error instanceof SubscriberStoreError) {
      const message = getUserFacingSubscribeError(error);

      return NextResponse.json(
        {
          code: error.code,
          message,
        },
        { status: error.code === "missing_supabase_env" ? 503 : 502 },
      );
    }

    return NextResponse.json(
      { message: "Subscription service is temporarily unavailable. Please try again or contact MPR Consulting directly." },
      { status: 500 },
    );
  }
}

function getUserFacingSubscribeError(error: SubscriberStoreError) {
  if (error.code === "missing_supabase_env") {
    return "Subscription service is temporarily unavailable. Please try again or contact MPR Consulting directly.";
  }

  if (error.details?.includes("schema")) {
    return "Subscription service is temporarily unavailable because subscriber storage needs attention.";
  }

  if (error.details?.includes("table")) {
    return "Subscription service is temporarily unavailable because subscriber storage is not available.";
  }

  return "Unable to connect to subscription service. Please try again or contact MPR Consulting directly.";
}

function getSafeSubscribeError(error: unknown) {
  if (error instanceof SubscriberStoreError) {
    return {
      name: error.name,
      code: error.code,
      status: error.status,
      details: error.details,
      missingEnv: error.missingEnv,
      requiredRuntimeEnv: {
        NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
        NEXT_PUBLIC_SITE_URL: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
      },
      runtimeEnvLengths: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, "").length ?? 0,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, "").length ?? 0,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, "").length ?? 0,
        RESEND_API_KEY: process.env.RESEND_API_KEY?.trim().replace(/^["']|["']$/g, "").length ?? 0,
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/^["']|["']$/g, "").length ?? 0,
      },
    };
  }

  return {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : "Unknown subscribe route failure",
  };
}
