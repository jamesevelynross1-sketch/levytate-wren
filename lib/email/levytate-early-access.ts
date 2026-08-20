import { escapeHtml } from "@/lib/email/shared";
import type { EarlyAccessRequest } from "@/lib/levytate/early-access/domain";

export const levytateEmailSender = "LevyTate <hello@levytate.co.uk>";
const defaultNotificationEmail = "hello@levytate.co.uk";

export function getEarlyAccessNotificationEmail() {
  return process.env.LEVYTATE_EARLY_ACCESS_NOTIFY_EMAIL?.trim() || defaultNotificationEmail;
}

export function buildEarlyAccessNotificationEmail(lead: EarlyAccessRequest) {
  const submittedAt = formatSubmittedAt(lead.submittedAt);
  const challenge = lead.biggestChallenge || "Not supplied";

  return {
    subject: `New LevyTate Early Access request – ${lead.organisation}`,
    html: emailShell({
      eyebrow: "New early access request",
      heading: lead.organisation,
      intro: `${lead.contactName} has requested access to the LevyTate beta.`,
      body: `
        ${detailsTable([
          ["Contact", lead.contactName],
          ["Work email", lead.email],
          ["Organisation", lead.organisation],
          ["Employee count", lead.employeeCount],
          ["Biggest challenge", challenge],
          ["Submitted", submittedAt],
          ["Status", lead.status],
        ])}
        <p style="margin:24px 0 0;color:#5b6f7c;font:400 13px Arial,sans-serif;line-height:1.7;">This request is also available in the LevyTate beta admin workspace.</p>
      `,
    }),
    text: [
      "New LevyTate Early Access request",
      "",
      `Contact: ${lead.contactName}`,
      `Work email: ${lead.email}`,
      `Organisation: ${lead.organisation}`,
      `Employee count: ${lead.employeeCount}`,
      `Biggest challenge: ${challenge}`,
      `Submitted: ${submittedAt}`,
      `Status: ${lead.status}`,
      "",
      "This request is also available in the LevyTate beta admin workspace.",
    ].join("\n"),
  };
}

export function buildEarlyAccessConfirmationEmail(lead: EarlyAccessRequest) {
  return {
    subject: "We’ve received your LevyTate Early Access request",
    html: emailShell({
      eyebrow: "Request received",
      heading: `Thank you, ${lead.contactName}.`,
      intro: `We’ve received the Early Access request for ${lead.organisation}.`,
      body: `
        <p style="margin:0;color:#5b6f7c;font:400 15px Arial,sans-serif;line-height:1.75;">We are inviting a small number of employers into the LevyTate beta to help shape the platform. We’ll review your request and contact you at ${escapeHtml(lead.email)}.</p>
        <p style="margin:22px 0 0;color:#102c3d;font:600 15px Arial,sans-serif;line-height:1.7;">The LevyTate team</p>
      `,
    }),
    text: [
      `Thank you, ${lead.contactName}.`,
      "",
      `We’ve received the Early Access request for ${lead.organisation}.`,
      "",
      "We are inviting a small number of employers into the LevyTate beta to help shape the platform. We’ll review your request and be in touch shortly.",
      "",
      "The LevyTate team",
    ].join("\n"),
  };
}

function emailShell({ eyebrow, heading, intro, body }: { eyebrow: string; heading: string; intro: string; body: string }) {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f6fbf8;color:#102c3d;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6fbf8;">
      <tr>
        <td align="center" style="padding:32px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:#ffffff;border:1px solid #dfe9e5;border-radius:24px;">
            <tr>
              <td style="padding:34px;">
                <p style="margin:0 0 10px;color:#c95568;font:700 11px Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase;">${escapeHtml(eyebrow)}</p>
                <h1 style="margin:0;color:#102c3d;font:700 30px Arial,sans-serif;line-height:1.18;">${escapeHtml(heading)}</h1>
                <p style="margin:16px 0 0;color:#5b6f7c;font:400 15px Arial,sans-serif;line-height:1.75;">${escapeHtml(intro)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 34px 34px;">${body}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function detailsTable(rows: Array<[string, string]>) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows
    .map(
      ([label, value]) => `<tr>
        <td style="width:34%;padding:11px 12px;border-top:1px solid #e7efec;color:#5b6f7c;font:600 13px Arial,sans-serif;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:11px 12px;border-top:1px solid #e7efec;color:#102c3d;font:400 13px Arial,sans-serif;line-height:1.55;vertical-align:top;white-space:pre-wrap;">${escapeHtml(value)}</td>
      </tr>`,
    )
    .join("")}</table>`;
}

function formatSubmittedAt(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  });
}
