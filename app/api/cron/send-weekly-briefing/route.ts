import { NextResponse } from "next/server";
import { getApprenticeshipNews } from "@/lib/apprenticeship-news";
import { getSiteUrl } from "@/lib/email/shared";
import { buildWeeklyBriefingEmail } from "@/lib/email/weekly-briefing";
import {
  articleMatchesSegment,
  isIntelligenceSegment,
} from "@/lib/segments";
import { sendEmail } from "@/lib/server/resend";
import { getActiveSubscribers } from "@/lib/server/subscribers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const testEmail = url.searchParams.get("testEmail");
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const querySecret = url.searchParams.get("secret");

  if (!secret || (authHeader !== `Bearer ${secret}` && querySecret !== secret)) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }

  try {
    const allSubscribers = await getActiveSubscribers();
    const subscribers = testEmail
      ? allSubscribers.filter((subscriber) => subscriber.email === testEmail.toLowerCase())
      : allSubscribers;
    const articles = await getApprenticeshipNews(8);
    const siteUrl = getSiteUrl();

    let sent = 0;
    let failed = 0;

    for (const subscriber of subscribers) {
      const subscriberArticles = prioritiseArticlesForSegments(articles, subscriber.segments);
      const email = buildWeeklyBriefingEmail({
        articles: subscriberArticles,
        recipientEmail: subscriber.email,
        siteUrl,
        unsubscribeToken: subscriber.unsubscribeToken,
      });

      if (dryRun) {
        continue;
      }

      try {
        await sendEmail({
          to: subscriber.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        });
        sent += 1;
      } catch (error) {
        failed += 1;
        console.error("Weekly briefing send failed", {
          subscriberId: subscriber.id,
          error: error instanceof Error ? error.message : "Unknown email error",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      subscribersFound: allSubscribers.length,
      targetedSubscribers: subscribers.length,
      articles: articles.length,
      emailsSent: sent,
      failedSends: failed,
    });
  } catch (error) {
    console.error("Weekly briefing cron failed", {
      error: error instanceof Error ? error.message : "Unknown cron error",
    });
    return NextResponse.json(
      { message: "Weekly briefing cron failed." },
      { status: 500 },
    );
  }
}

function prioritiseArticlesForSegments<T extends {
  title: string;
  summary: string;
  category: string;
  source: string;
}>(articles: T[], segments: string[]) {
  if (segments.includes("all")) {
    return articles;
  }

  const matching = articles.filter((article) =>
    segments.some((segment) =>
      isIntelligenceSegment(segment) && articleMatchesSegment(article, segment),
    ),
  );
  const nonMatching = articles.filter((article) => !matching.includes(article));

  return [...matching, ...nonMatching].slice(0, 8);
}
