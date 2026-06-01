import { escapeHtml, getUnsubscribeUrl } from "@/lib/email/shared";

type BuildWelcomeEmailInput = {
  recipientEmail: string;
  siteUrl: string;
  unsubscribeToken?: string | null;
};

const briefingThemes = [
  "apprenticeship policy changes",
  "AI, data and workforce capability developments",
  "private provider market intelligence",
  "employer strategy insights",
  "new MPR perspectives",
];

export function buildWelcomeEmail({
  recipientEmail,
  siteUrl,
  unsubscribeToken,
}: BuildWelcomeEmailInput) {
  const unsubscribeUrl = getUnsubscribeUrl(siteUrl, unsubscribeToken, recipientEmail);
  const insightsUrl = `${siteUrl}/insights`;
  const subject = "Welcome to the MPR Intelligence Briefing";
  const listHtml = briefingThemes
    .map(
      (theme) =>
        `<li style="margin: 0 0 8px; color: #536466; font: 400 14px Arial, sans-serif; line-height: 1.65;">${escapeHtml(theme)}</li>`,
    )
    .join("");
  const listText = briefingThemes.map((theme) => `- ${theme}`).join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin: 0; background: #f7f2e8; color: #0f2527;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f7f2e8;">
      <tr>
        <td align="center" style="padding: 34px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 640px; background: #fbf7ef; border: 1px solid #e4dbcf;">
            <tr>
              <td style="padding: 34px;">
                <p style="margin: 0 0 26px; color: #0f2527; font: 700 18px Arial, sans-serif; letter-spacing: 0.02em;">MPR Consulting</p>
                <p style="margin: 0 0 10px; color: #2c8c83; font: 700 11px Arial, sans-serif; letter-spacing: 0.2em; text-transform: uppercase;">MPR Intelligence Briefing</p>
                <h1 style="margin: 0; color: #0f2527; font: 500 32px Georgia, serif; line-height: 1.1;">Welcome to sharper apprenticeship market signals.</h1>
                <p style="margin: 18px 0 0; color: #536466; font: 400 15px Arial, sans-serif; line-height: 1.75;">Thank you for subscribing. Each week, we will send a concise readout designed for employers tracking apprenticeship strategy, provider movement and workforce capability.</p>
                <ul style="margin: 22px 0 24px; padding-left: 20px;">
                  ${listHtml}
                </ul>
                <a href="${insightsUrl}" style="display: inline-block; border-radius: 999px; background: #0f2527; color: #f7f2e8; font: 700 13px Arial, sans-serif; padding: 13px 18px; text-decoration: none;">Explore MPR Insights</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 34px 34px; border-top: 1px solid #e4dbcf;">
                <p style="margin: 0; color: #6b7777; font: 400 12px Arial, sans-serif; line-height: 1.7;">Useful signals only. No noise. <a href="${unsubscribeUrl}" style="color: #0f2527;">Unsubscribe</a>.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `Welcome to the MPR Intelligence Briefing

Thank you for subscribing. Each week, we will send concise apprenticeship market intelligence covering:

${listText}

Explore MPR Insights: ${insightsUrl}

Unsubscribe: ${unsubscribeUrl}`;

  return {
    subject,
    html,
    text,
  };
}
