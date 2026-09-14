type SendEmailInput = {
  from?: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
};

const verifiedDomainFrom = "MPR Consulting <updates@mprconsulting.co.uk>";
const resendFallbackFrom = "MPR Consulting <onboarding@resend.dev>";

export async function sendEmail({ from: requestedFrom, to, subject, html, text, idempotencyKey }: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Resend API key is not configured.");
  }

  const from = requestedFrom ?? process.env.RESEND_FROM_EMAIL ?? verifiedDomainFrom;
  const response = await sendResendRequest({
    apiKey,
    from,
    to,
    subject,
    html,
    text,
    idempotencyKey,
  });

  if (response.ok) {
    return getResendMessageId(response);
  }

  if (!requestedFrom && !process.env.RESEND_FROM_EMAIL && from !== resendFallbackFrom) {
    const fallbackResponse = await sendResendRequest({
      apiKey,
      from: resendFallbackFrom,
      to,
      subject,
      html,
      text,
      idempotencyKey,
    });

    if (fallbackResponse.ok) {
      return getResendMessageId(fallbackResponse);
    }

    throw new Error(await getResendError(fallbackResponse));
  }

  throw new Error(await getResendError(response));
}

async function sendResendRequest({
  apiKey,
  from,
  to,
  subject,
  html,
  text,
  idempotencyKey,
}: Omit<SendEmailInput, "from"> & { apiKey: string; from: string }) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
    }),
  });
}

async function getResendMessageId(response: Response) {
  try {
    const payload = (await response.json()) as { id?: unknown };
    return typeof payload.id === "string" ? payload.id : undefined;
  } catch {
    return undefined;
  }
}

async function getResendError(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string; error?: string };
    return payload.message ?? payload.error ?? "Resend email request failed.";
  } catch {
    return "Resend email request failed.";
  }
}
