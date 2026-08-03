export type AuthenticationEmailDeliveryStatus = "requested" | "accepted" | "delivered" | "delayed" | "bounced" | "rejected" | "complained" | "suppressed" | "failed" | "unknown";
export type AuthenticationEmailCorrelationConfidence = "exact" | "bounded" | "uncorrelated";

export type AuthenticationEmailStatusEvidence = {
  canonical_status: AuthenticationEmailDeliveryStatus;
  occurred_at: string;
  received_at?: string;
};

export function mapResendEventType(eventType: string): AuthenticationEmailDeliveryStatus {
  return ({
    "email.sent": "accepted",
    "email.delivered": "delivered",
    "email.delivery_delayed": "delayed",
    "email.bounced": "bounced",
    "email.failed": "failed",
    "email.complained": "complained",
    "email.suppressed": "suppressed",
  } as Record<string, AuthenticationEmailDeliveryStatus>)[eventType] ?? "unknown";
}

export function deriveAuthenticationEmailDeliveryStatus(events: AuthenticationEmailStatusEvidence[]) {
  const ordered = [...events].sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at) || Date.parse(a.received_at ?? a.occurred_at) - Date.parse(b.received_at ?? b.occurred_at));
  let current: AuthenticationEmailDeliveryStatus = "unknown";
  for (const event of ordered) {
    if (event.canonical_status === "complained") current = "complained";
    else if (current === "complained") continue;
    else if (["bounced", "rejected", "suppressed", "failed"].includes(event.canonical_status)) current = event.canonical_status;
    else if (["bounced", "rejected", "suppressed", "failed"].includes(current)) continue;
    else if (event.canonical_status === "delivered") current = "delivered";
    else if (current === "delivered") continue;
    else if (event.canonical_status === "delayed") current = "delayed";
    else if (current !== "delayed" && event.canonical_status === "accepted") current = "accepted";
    else if (["unknown", "requested"].includes(current) && event.canonical_status === "requested") current = "requested";
  }
  return current;
}

