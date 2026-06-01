import type { ApprenticeshipNewsArticle } from "@/lib/apprenticeship-news";
import { escapeAttribute, escapeHtml, getUnsubscribeUrl } from "@/lib/email/shared";
import { insightArticles } from "@/lib/insights";

type BuildWeeklyBriefingInput = {
  articles: ApprenticeshipNewsArticle[];
  recipientEmail: string;
  siteUrl: string;
  unsubscribeToken?: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function buildWeeklyBriefingEmail({
  articles,
  recipientEmail,
  siteUrl,
  unsubscribeToken,
}: BuildWeeklyBriefingInput) {
  const unsubscribeUrl = getUnsubscribeUrl(siteUrl, unsubscribeToken, recipientEmail);
  const latestInsight = insightArticles[0];
  const subject = "MPR Weekly Intelligence: Apprenticeship market signals";
  const intro =
    "A concise readout across apprenticeship policy, AI and automation capability, private provider movement, employer workforce strategy and funding signals.";

  const articleHtml = articles.slice(0, 8).map(renderArticleHtml).join("");
  const articleText = articles
    .slice(0, 8)
    .map(
      (article) =>
        `${article.title}\n${article.source} / ${formatArticleDate(article.publishedAt)}\n${article.summary}\n${article.url}`,
    )
    .join("\n\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin: 0; background: #f7f2e8; color: #0f2527;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f7f2e8;">
      <tr>
        <td align="center" style="padding: 34px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 680px; background: #fbf7ef; border: 1px solid #e4dbcf;">
            <tr>
              <td style="padding: 34px 34px 24px;">
                <p style="margin: 0 0 26px; color: #0f2527; font: 700 18px Arial, sans-serif; letter-spacing: 0.02em;">MPR Consulting</p>
                <p style="margin: 0 0 10px; color: #2c8c83; font: 700 11px Arial, sans-serif; letter-spacing: 0.2em; text-transform: uppercase;">MPR Weekly Intelligence Briefing</p>
                <h1 style="margin: 0; color: #0f2527; font: 500 34px Georgia, serif; line-height: 1.08;">Apprenticeship market signals.</h1>
                <p style="margin: 18px 0 0; color: #536466; font: 400 15px Arial, sans-serif; line-height: 1.75;">${intro}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 34px 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${articleHtml}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 34px; background: #102c2d;">
                <p style="margin: 0 0 8px; color: #cfe7df; font: 700 11px Arial, sans-serif; letter-spacing: 0.18em; text-transform: uppercase;">Latest MPR perspective</p>
                <h2 style="margin: 0 0 10px; color: #f7f2e8; font: 500 23px Georgia, serif; line-height: 1.22;">${escapeHtml(latestInsight.title)}</h2>
                <p style="margin: 0 0 16px; color: #d9e2dc; font: 400 14px Arial, sans-serif; line-height: 1.7;">${escapeHtml(latestInsight.summary)}</p>
                <a href="${siteUrl}/insights/${latestInsight.slug}" style="color: #f7f2e8; font: 700 13px Arial, sans-serif; text-decoration: none;">Read MPR insight</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 26px 34px 34px;">
                <p style="margin: 0; color: #6b7777; font: 400 12px Arial, sans-serif; line-height: 1.7;">You are receiving this because you subscribed to MPR Intelligence Briefing. <a href="${unsubscribeUrl}" style="color: #0f2527;">Unsubscribe</a>.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `MPR Weekly Intelligence Briefing

${intro}

${articleText}

Latest MPR perspective
${latestInsight.title}
${latestInsight.summary}
${siteUrl}/insights/${latestInsight.slug}

Unsubscribe: ${unsubscribeUrl}`;

  return {
    subject,
    html,
    text,
  };
}

function renderArticleHtml(article: ApprenticeshipNewsArticle) {
  return `
    <tr>
      <td style="padding: 22px 0; border-top: 1px solid #e4dbcf;">
        <p style="margin: 0 0 8px; color: #2c8c83; font: 700 11px Arial, sans-serif; letter-spacing: 0.16em; text-transform: uppercase;">${escapeHtml(article.category)}</p>
        <h2 style="margin: 0 0 8px; color: #0f2527; font: 600 19px Georgia, serif; line-height: 1.28;">${escapeHtml(article.title)}</h2>
        <p style="margin: 0 0 12px; color: #536466; font: 400 14px Arial, sans-serif; line-height: 1.7;">${escapeHtml(article.summary)}</p>
        <p style="margin: 0 0 14px; color: #6b7777; font: 700 12px Arial, sans-serif;">${escapeHtml(article.source)} / ${formatArticleDate(article.publishedAt)}</p>
        <a href="${escapeAttribute(article.url)}" style="color: #0f2527; font: 700 13px Arial, sans-serif; text-decoration: none;">Read article</a>
      </td>
    </tr>
  `;
}

function formatArticleDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : dateFormatter.format(date);
}
