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

  console.info({
    component: "requests-email-preflight",
    hasResendApiKey: Boolean(process.env.RESEND_API_KEY),
    resendApiKeyLengthPresent: Boolean(process.env.RESEND_API_KEY?.length),
    vercelEnv: process.env.VERCEL_ENV ?? "unset",
    gitCommitRef: process.env.VERCEL_GIT_COMMIT_REF ?? "unset",
    senderDomain: "levytate.co.uk",
  });

  if (!apiKey) {
    throw new Error("Resend API key is not configured.");
  }

  const from = requestedFrom ?? process.env.RESEND_FROM_EMAIL ?? verifiedDomainFrom;
  let response: Response;
  try {
    response = await sendResendRequest({
      apiKey,
      from,
      to,
      subject,
      html,
      text,
      idempotencyKey,
    });
  } catch {
    console.error({ component: "requests-email-delivery", category: "network_failure" });
    throw new Error("Resend email request failed.");
  }

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

  console.error({
    component: "requests-email-delivery",
    category: resendErrorCategory(response.status),
    status: response.status,
  });
  throw new Error(await getResendError(response));
}

function resendErrorCategory(status: number) {
  if (status === 401) return "resend_401";
  if (status === 403) return "resend_403";
  if (status === 422) return "resend_422";
  if (status === 429) return "resend_429";
  if (status >= 500) return "resend_5xx";
  return "resend_other";
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
