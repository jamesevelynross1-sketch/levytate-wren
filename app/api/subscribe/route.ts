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

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { message: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    const existingSubscriber = await getSubscriberByEmail(email);

    if (existingSubscriber?.status === "active") {
      await updateSubscriberSegments(email, segments);

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

    return NextResponse.json({
      ok: true,
      reactivated: existingSubscriber?.status === "unsubscribed",
      message: "You're subscribed. Your welcome email may take a moment to arrive.",
    });
  } catch (error) {
    console.error("Subscribe route failed", getSafeSubscribeError(error));

    if (error instanceof SubscriberStoreError) {
      const message =
        error.code === "missing_supabase_env"
          ? "Subscription storage is not configured yet. Please try again later or contact MPR Consulting directly."
          : error.details ??
            "We could not save your subscription because the subscriber database is unavailable.";

      return NextResponse.json(
        {
          code: error.code,
          message,
        },
        { status: error.code === "missing_supabase_env" ? 503 : 502 },
      );
    }

    return NextResponse.json(
      { message: "We could not complete the subscription. Please try again." },
      { status: 500 },
    );
  }
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
    };
  }

  return {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : "Unknown subscribe route failure",
  };
}
