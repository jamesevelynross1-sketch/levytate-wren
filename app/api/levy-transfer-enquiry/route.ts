import { NextResponse } from "next/server";
import { escapeHtml } from "@/lib/email/shared";
import { sendEmail } from "@/lib/server/resend";

type LevyTransferEnquiryPayload = {
  organisationName?: string;
  contactName?: string;
  email?: string;
  telephone?: string;
  employeeNumbers?: string;
  levyPayer?: string;
  supportInterest?: string;
  consent?: boolean;
};

const destinationEmail = "james@mprconsulting.co.uk";
const consentStatement =
  "I consent to MPR Consulting contacting me regarding apprenticeship levy transfer opportunities and related workforce development support.";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as LevyTransferEnquiryPayload;
    const enquiry = normalisePayload(payload);

    if (
      !enquiry.organisationName ||
      !enquiry.contactName ||
      !isValidEmail(enquiry.email) ||
      !enquiry.employeeNumbers ||
      !enquiry.levyPayer ||
      !enquiry.supportInterest ||
      !enquiry.consent
    ) {
      return NextResponse.json(
        { message: "Please complete the required fields and provide consent." },
        { status: 400 },
      );
    }

    const emailContent = buildLevyTransferEmail(enquiry);

    await sendEmail({
      to: destinationEmail,
      subject: `New Levy Transfer Funding Enquiry – ${enquiry.organisationName}`,
      html: emailContent.html,
      text: emailContent.text,
    });

    return NextResponse.json({ ok: true, message: "Enquiry submitted." });
  } catch (error) {
    console.error("Levy transfer enquiry failed", {
      error: error instanceof Error ? error.message : "Unknown enquiry error",
    });

    return NextResponse.json(
      { message: "We could not submit your enquiry at the moment. Please try again." },
      { status: 500 },
    );
  }
}

function normalisePayload(payload: LevyTransferEnquiryPayload) {
  return {
    organisationName: payload.organisationName?.trim() ?? "",
    contactName: payload.contactName?.trim() ?? "",
    email: payload.email?.trim().toLowerCase() ?? "",
    telephone: payload.telephone?.trim() ?? "",
    employeeNumbers: payload.employeeNumbers?.trim() ?? "",
    levyPayer: payload.levyPayer?.trim() ?? "",
    supportInterest: payload.supportInterest?.trim() ?? "",
    consent: payload.consent === true,
    submittedAt: new Date().toISOString(),
  };
}

function buildLevyTransferEmail(enquiry: ReturnType<typeof normalisePayload>) {
  const submittedAt = new Date(enquiry.submittedAt).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  });

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f7f2e8;color:#0f2527;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f2e8;">
      <tr>
        <td align="center" style="padding:32px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;background:#fbf7ef;border:1px solid #e4dbcf;">
            <tr>
              <td style="padding:34px;">
                <p style="margin:0 0 10px;color:#2c8c83;font:700 11px Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;">MPR Consulting</p>
                <h1 style="margin:0;color:#0f2527;font:500 31px Georgia,serif;line-height:1.12;">New Levy Transfer Funding Enquiry</h1>
                <p style="margin:16px 0 0;color:#536466;font:400 14px Arial,sans-serif;line-height:1.7;">Submitted ${escapeHtml(submittedAt)} from the homepage levy transfer funding section.</p>
              </td>
            </tr>
            ${renderSection("Organisation Details", [
              ["Organisation Name", enquiry.organisationName],
              ["Number of Employees", enquiry.employeeNumbers],
              ["Levy-paying Organisation", enquiry.levyPayer],
            ])}
            ${renderSection("Contact Details", [
              ["Contact Name", enquiry.contactName],
              ["Email Address", enquiry.email],
              ["Telephone Number", enquiry.telephone || "Not supplied"],
            ])}
            <tr>
              <td style="padding:24px 34px;border-top:1px solid #e4dbcf;">
                <h2 style="margin:0 0 12px;color:#0f2527;font:600 20px Georgia,serif;">Support Interest</h2>
                <p style="margin:0;color:#536466;font:400 14px Arial,sans-serif;line-height:1.7;white-space:pre-line;">${escapeHtml(enquiry.supportInterest)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 34px;border-top:1px solid #e4dbcf;">
                <h2 style="margin:0 0 12px;color:#0f2527;font:600 20px Georgia,serif;">Consent</h2>
                <p style="margin:0 0 10px;color:#536466;font:400 14px Arial,sans-serif;line-height:1.7;">${escapeHtml(consentStatement)}</p>
                <p style="margin:0;color:#6b7777;font:400 12px Arial,sans-serif;line-height:1.7;">Captured at ${escapeHtml(submittedAt)}.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    "New Levy Transfer Funding Enquiry",
    `Submitted: ${submittedAt}`,
    "",
    "Organisation Details",
    `Organisation Name: ${enquiry.organisationName}`,
    `Number of Employees: ${enquiry.employeeNumbers}`,
    `Levy-paying Organisation: ${enquiry.levyPayer}`,
    "",
    "Contact Details",
    `Contact Name: ${enquiry.contactName}`,
    `Email Address: ${enquiry.email}`,
    `Telephone Number: ${enquiry.telephone || "Not supplied"}`,
    "",
    "Support Interest",
    enquiry.supportInterest,
    "",
    "Consent",
    consentStatement,
    `Captured at: ${submittedAt}`,
  ].join("\n");

  return { html, text };
}

function renderSection(title: string, rows: Array<[string, string]>) {
  const renderedRows = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 0;color:#6b7777;font:700 12px Arial,sans-serif;width:38%;">${escapeHtml(label)}</td>
          <td style="padding:8px 0;color:#0f2527;font:400 14px Arial,sans-serif;line-height:1.6;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  return `
    <tr>
      <td style="padding:24px 34px;border-top:1px solid #e4dbcf;">
        <h2 style="margin:0 0 12px;color:#0f2527;font:600 20px Georgia,serif;">${escapeHtml(title)}</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${renderedRows}</table>
      </td>
    </tr>`;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
