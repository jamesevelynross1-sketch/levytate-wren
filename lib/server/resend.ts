type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const verifiedDomainFrom = "MPR Consulting <updates@mprconsulting.co.uk>";
const resendFallbackFrom = "MPR Consulting <onboarding@resend.dev>";

export async function sendEmail({ to, subject, html, text }: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Resend API key is not configured.");
  }

  const from = process.env.RESEND_FROM_EMAIL ?? verifiedDomainFrom;
  const response = await sendResendRequest({
    apiKey,
    from,
    to,
    subject,
    html,
    text,
  });

  if (response.ok) {
    return;
  }

  if (!process.env.RESEND_FROM_EMAIL && from !== resendFallbackFrom) {
    const fallbackResponse = await sendResendRequest({
      apiKey,
      from: resendFallbackFrom,
      to,
      subject,
      html,
      text,
    });

    if (fallbackResponse.ok) {
      return;
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
}: SendEmailInput & { apiKey: string; from: string }) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
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

async function getResendError(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string; error?: string };
    return payload.message ?? payload.error ?? "Resend email request failed.";
  } catch {
    return "Resend email request failed.";
  }
}
