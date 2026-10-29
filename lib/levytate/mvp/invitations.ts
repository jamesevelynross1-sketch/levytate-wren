export type ClientInvitationStatus = "not_requested" | "sending" | "accepted" | "failed" | "revoked" | "consumed";

export type ClientInvitationFields = {
  invitation_status: ClientInvitationStatus;
  invitation_requested_at: string | null;
  invitation_expires_at: string | null;
  invitation_request_reference: string | null;
  invitation_generation: number;
};

export function invitationAllowsActivation(membership: Partial<ClientInvitationFields> & { auth_binding_status?: string }, now = Date.now()) {
  if (membership.auth_binding_status === "bound") return true;
  return membership.invitation_status === "accepted"
    && typeof membership.invitation_expires_at === "string"
    && Date.parse(membership.invitation_expires_at) > now;
}

export function invitationDisplayState(membership: Partial<ClientInvitationFields> & { active: boolean }, now = Date.now()) {
  if (membership.invitation_status === "revoked") return "revoked";
  if (membership.invitation_status === "accepted" && (!membership.invitation_expires_at || Date.parse(membership.invitation_expires_at) <= now)) return "expired";
  return membership.invitation_status ?? "not_requested";
}
