import { NextResponse } from "next/server";
import { escapeHtml } from "@/lib/email/shared";
import { sendEmail } from "@/lib/server/resend";

type ReviewContext = {
  organisationName?: string;
  sector?: string;
  employeeNumbers?: string;
  levyStatus?: string;
  currentActivity?: string;
  challenges?: string[];
  priorities?: string[];
};

type OpportunityReview = {
  currentPosition?: string[];
  immediateOpportunities?: string[];
  actions30?: string[];
  actions60?: string[];
  actions90?: string[];
  supportServices?: Array<{
    title?: string;
    description?: string;
  }>;
  nextConversation?: string;
};

type SubmissionPayload = {
  contact?: {
    name?: string;
    organisation?: string;
    email?: string;
    telephone?: string;
    consent?: boolean;
  };
  organisationDetails?: ReviewContext;
  review?: OpportunityReview;
  reviewText?: string;
  consent?: {
    given?: boolean;
    statement?: string;
    capturedAt?: string;
  };
};

const destinationEmail = "james@mprconsulting.co.uk";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SubmissionPayload;
    const contact = payload.contact ?? {};
    const organisation = contact.organisation?.trim() || payload.organisationDetails?.organisationName?.trim() || "Organisation not supplied";
    const email = contact.email?.trim().toLowerCase() ?? "";

    if (!contact.name?.trim() || !organisation || !isValidEmail(email) || !contact.consent || !payload.consent?.given) {
      return NextResponse.json(
        { message: "Name, organisation, valid email address and consent are required." },
        { status: 400 },
      );
    }

    const crmReadyPayload = {
      source: "apprenticeship_opportunity_review",
      contact: {
        name: contact.name.trim(),
        organisation,
        email,
        telephone: contact.telephone?.trim() || null,
      },
      organisationDetails: payload.organisationDetails,
      challenges: payload.organisationDetails?.challenges ?? [],
      priorities: payload.organisationDetails?.priorities ?? [],
      review: payload.review,
      consent: payload.consent,
      submittedAt: new Date().toISOString(),
    };

    const emailContent = buildSubmissionEmail({
      payload,
      organisation,
      contactName: contact.name.trim(),
      contactEmail: email,
      telephone: contact.telephone?.trim() || "",
      crmReadyPayload,
    });

    await sendEmail({
      to: destinationEmail,
      subject: `New Apprenticeship Opportunity Review Submission – ${organisation}`,
      html: emailContent.html,
      text: emailContent.text,
    });

    return NextResponse.json({ ok: true, message: "Review submitted." });
  } catch (error) {
    console.error("Opportunity Review submission failed", {
      error: error instanceof Error ? error.message : "Unknown submission error",
    });

    return NextResponse.json(
      { message: "We couldn't submit your review at the moment. Please try again or contact us directly." },
      { status: 500 },
    );
  }
}

function buildSubmissionEmail({
  payload,
  organisation,
  contactName,
  contactEmail,
  telephone,
  crmReadyPayload,
}: {
  payload: SubmissionPayload;
  organisation: string;
  contactName: string;
  contactEmail: string;
  telephone: string;
  crmReadyPayload: unknown;
}) {
  const details = payload.organisationDetails ?? {};
  const review = payload.review ?? {};
  const submittedAt = new Date().toLocaleString("en-GB", {
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
                <h1 style="margin:0;color:#0f2527;font:500 31px Georgia,serif;line-height:1.12;">New Apprenticeship Opportunity Review Submission</h1>
                <p style="margin:16px 0 0;color:#536466;font:400 14px Arial,sans-serif;line-height:1.7;">Submitted ${escapeHtml(submittedAt)}.</p>
              </td>
            </tr>
            ${renderSection("Contact Details", [
              ["Name", contactName],
              ["Organisation", organisation],
              ["Email", contactEmail],
              ["Telephone", telephone || "Not supplied"],
            ])}
            ${renderSection("Organisation Details", [
              ["Organisation name", details.organisationName],
              ["Industry / sector", details.sector],
              ["Employee numbers", details.employeeNumbers],
              ["Levy-paying organisation", details.levyStatus],
              ["Current apprenticeship activity", details.currentActivity],
            ])}
            ${renderListSection("Current Challenges", details.challenges)}
            ${renderListSection("Business Priorities", details.priorities)}
            ${renderListSection("Review Summary", review.currentPosition)}
            ${renderListSection("Immediate Opportunities", review.immediateOpportunities)}
            ${renderActionPlan(review)}
            ${renderSupportServices(review.supportServices)}
            ${renderListSection("Suggested Next Conversation", review.nextConversation ? [review.nextConversation] : [])}
            ${renderListSection("Consent", [
              payload.consent?.statement ?? "Consent statement unavailable.",
              `Captured at: ${payload.consent?.capturedAt ?? "Unavailable"}`,
            ])}
            <tr>
              <td style="padding:24px 34px 34px;">
                <p style="margin:0;color:#6b7777;font:400 12px Arial,sans-serif;line-height:1.7;">CRM-ready payload has been structured server-side for future HubSpot, Pipedrive, Salesforce or Microsoft Dynamics integration.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    "New Apprenticeship Opportunity Review Submission",
    `Submitted: ${submittedAt}`,
    "",
    "Contact Details",
    `Name: ${contactName}`,
    `Organisation: ${organisation}`,
    `Email: ${contactEmail}`,
    `Telephone: ${telephone || "Not supplied"}`,
    "",
    "Organisation Details",
    `Organisation name: ${details.organisationName ?? ""}`,
    `Industry / sector: ${details.sector ?? ""}`,
    `Employee numbers: ${details.employeeNumbers ?? ""}`,
    `Levy-paying organisation: ${details.levyStatus ?? ""}`,
    `Current apprenticeship activity: ${details.currentActivity ?? ""}`,
    "",
    "Current Challenges",
    ...(details.challenges ?? []),
    "",
    "Business Priorities",
    ...(details.priorities ?? []),
    "",
    "Review Summary",
    ...(review.currentPosition ?? []),
    "",
    "Recommended Actions",
    "30-Day Actions",
    ...(review.actions30 ?? []),
    "60-Day Actions",
    ...(review.actions60 ?? []),
    "90-Day Actions",
    ...(review.actions90 ?? []),
    "",
    "Suggested Next Conversation",
    review.nextConversation ?? "",
    "",
    "Consent",
    payload.consent?.statement ?? "",
    `Captured at: ${payload.consent?.capturedAt ?? ""}`,
    "",
    "CRM-ready payload keys",
    Object.keys(crmReadyPayload as Record<string, unknown>).join(", "),
  ].join("\n");

  return { html, text };
}

function renderSection(title: string, rows: Array<[string, string | undefined]>) {
  const renderedRows = rows
    .filter(([, value]) => Boolean(value))
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 0;color:#6b7777;font:700 12px Arial,sans-serif;width:38%;">${escapeHtml(label)}</td>
          <td style="padding:8px 0;color:#0f2527;font:400 14px Arial,sans-serif;line-height:1.6;">${escapeHtml(value ?? "")}</td>
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

function renderListSection(title: string, items: string[] | undefined) {
  const usefulItems = items?.filter(Boolean) ?? [];

  if (!usefulItems.length) {
    return "";
  }

  return `
    <tr>
      <td style="padding:24px 34px;border-top:1px solid #e4dbcf;">
        <h2 style="margin:0 0 12px;color:#0f2527;font:600 20px Georgia,serif;">${escapeHtml(title)}</h2>
        ${usefulItems
          .map((item) => `<p style="margin:0 0 10px;color:#536466;font:400 14px Arial,sans-serif;line-height:1.7;">${escapeHtml(item)}</p>`)
          .join("")}
      </td>
    </tr>`;
}

function renderActionPlan(review: OpportunityReview) {
  return `
    <tr>
      <td style="padding:24px 34px;border-top:1px solid #e4dbcf;">
        <h2 style="margin:0 0 12px;color:#0f2527;font:600 20px Georgia,serif;">Recommended Actions</h2>
        ${renderActionGroup("30-Day Actions", review.actions30)}
        ${renderActionGroup("60-Day Actions", review.actions60)}
        ${renderActionGroup("90-Day Actions", review.actions90)}
      </td>
    </tr>`;
}

function renderActionGroup(title: string, actions: string[] | undefined) {
  const usefulActions = actions?.filter(Boolean) ?? [];

  if (!usefulActions.length) {
    return "";
  }

  return `
    <h3 style="margin:16px 0 8px;color:#2c8c83;font:700 12px Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;">${escapeHtml(title)}</h3>
    ${usefulActions
      .map((action) => `<p style="margin:0 0 10px;color:#536466;font:400 14px Arial,sans-serif;line-height:1.7;">${escapeHtml(action)}</p>`)
      .join("")}`;
}

function renderSupportServices(services: OpportunityReview["supportServices"]) {
  const usefulServices = services?.filter((service) => service.title) ?? [];

  if (!usefulServices.length) {
    return "";
  }

  return `
    <tr>
      <td style="padding:24px 34px;border-top:1px solid #e4dbcf;">
        <h2 style="margin:0 0 12px;color:#0f2527;font:600 20px Georgia,serif;">How MPR Consulting Can Support</h2>
        ${usefulServices
          .map(
            (service) => `
              <div style="padding:14px 0;border-top:1px solid #ede5da;">
                <h3 style="margin:0 0 6px;color:#0f2527;font:700 14px Arial,sans-serif;">${escapeHtml(service.title ?? "")}</h3>
                <p style="margin:0;color:#536466;font:400 14px Arial,sans-serif;line-height:1.7;">${escapeHtml(service.description ?? "")}</p>
              </div>`,
          )
          .join("")}
      </td>
    </tr>`;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
