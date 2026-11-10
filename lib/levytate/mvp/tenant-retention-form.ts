import type { TenantDataClass, TenantRetentionPolicy } from "@/lib/server/levytate-tenant-data-policy";

export const tenantRetentionClasses: Array<{ key: TenantDataClass; label: string }> = [
  { key: "identity", label: "Identity and access" }, { key: "people", label: "People" },
  { key: "applications", label: "Applications" }, { key: "learners", label: "Learner records" },
  { key: "finance", label: "Finance" }, { key: "catalogue", label: "Programmes and providers" },
  { key: "files", label: "Uploaded files" }, { key: "assessments", label: "Assessments" },
  { key: "lift", label: "Lift" }, { key: "support", label: "Private support" }, { key: "audit", label: "Audit evidence" },
];
export type LifecycleOwnerOption = { id: string; label: string };
export type TenantRetentionForm = {
  approvalReference: string; clientNoticeReference: string; supportHandoverReference: string; recoveryBoundaryReference: string;
  dataOwnerUserId: string; serviceOwnerUserId: string; evidenceRetainUntilLocal: string;
  schedules: Record<TenantDataClass, { action: "" | "delete" | "retain"; retainUntilLocal: string; approvalReference: string }>;
};
export function emptyTenantRetentionForm(): TenantRetentionForm {
  return {
    approvalReference: "", clientNoticeReference: "", supportHandoverReference: "", recoveryBoundaryReference: "",
    dataOwnerUserId: "", serviceOwnerUserId: "", evidenceRetainUntilLocal: "",
    schedules: Object.fromEntries(tenantRetentionClasses.map(({ key }) => [key, { action: "", retainUntilLocal: "", approvalReference: "" }])) as TenantRetentionForm["schedules"],
  };
}

/** Native datetime-local values are interpreted in the operator's browser timezone. */
export function tenantLocalTimeToInstant(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  if (year < 1000 || year > 9999) return null;
  const date = new Date(year, month - 1, day, hour, minute);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute) return null;
  return date.toISOString();
}
function approvedReference(value: string, label: string) {
  const reference = value.trim();
  if (reference.length < 5 || reference.length > 500) throw new Error(`Enter the approved ${label} reference (5–500 characters).`);
  return reference;
}
function requiredInstant(value: string, label: string) {
  const instant = tenantLocalTimeToInstant(value);
  if (!instant) throw new Error(`Choose a valid local date and time for ${label}.`);
  return instant;
}
export function buildTenantRetentionPolicy(value: TenantRetentionForm, owners: LifecycleOwnerOption[]): TenantRetentionPolicy {
  if (![value.dataOwnerUserId, value.serviceOwnerUserId].every((id) => owners.some((owner) => owner.id === id))) {
    throw new Error("Choose current authorised data and service owners. Refresh the available owners if access changed.");
  }
  return {
    version: "levytate-offboarding-v1",
    approvalReference: approvedReference(value.approvalReference, "retention policy"),
    clientNoticeReference: approvedReference(value.clientNoticeReference, "client notice"),
    supportHandoverReference: approvedReference(value.supportHandoverReference, "support handover"),
    recoveryBoundaryReference: approvedReference(value.recoveryBoundaryReference, "recovery boundary"),
    dataOwnerUserId: value.dataOwnerUserId, serviceOwnerUserId: value.serviceOwnerUserId,
    evidenceRetainUntil: requiredInstant(value.evidenceRetainUntilLocal, "lifecycle evidence retention"),
    schedules: tenantRetentionClasses.map(({ key, label }) => {
      const schedule = value.schedules[key];
      if (!schedule || !["delete", "retain"].includes(schedule.action)) throw new Error(`Choose the approved retention action for ${label.toLowerCase()}.`);
      return { dataClass: key, action: schedule.action as "delete" | "retain", retainUntil: requiredInstant(schedule.retainUntilLocal, `${label.toLowerCase()} retention`), approvalReference: approvedReference(schedule.approvalReference, `${label.toLowerCase()} schedule`) };
    }),
  };
}
