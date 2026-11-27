/** Guided setup is computed from persisted employer evidence. Nothing is marked
 * complete by localStorage, a click, or a presentation-only flag. */
export type SetupFinanceStatus = "checking" | "pending" | "complete" | "unavailable";
export type EmployerSetupKey = "organisation" | "priorities" | "managers" | "employees" | "providers" | "programmes" | "learners" | "finance";
export type EmployerSetupStep = {
  key: EmployerSetupKey;
  label: string;
  complete: boolean;
  target: string;
  optional?: boolean;
  detail: string;
};
type SetupEmployee = { id?: string; status: string; platformRole?: string; managerId?: string };
type SetupEvidence = {
  profile: {
    employerName: string;
    primaryContact: string;
    contactEmail: string;
    sites: ReadonlyArray<string>;
    departments: ReadonlyArray<string>;
    priorities: ReadonlyArray<unknown>;
  };
  employees: ReadonlyArray<SetupEmployee>;
  organisationProviders: ReadonlyArray<{ status: string; providerId?: string }>;
  organisationProgrammes: ReadonlyArray<{ status: string; programmeId?: string; providerId?: string }>;
  learnerRecords: ReadonlyArray<unknown>;
};

export function isEmployerSetupRole(role?: string) {
  return role === "Apprenticeship Lead" || role === "Employer Admin";
}

export function financeSetupStatus(state: { mode: string; imports: ReadonlyArray<unknown>; transactions: ReadonlyArray<unknown> }): SetupFinanceStatus {
  if (state.mode !== "persistent") return "unavailable";
  return state.imports.length > 0 && state.transactions.length > 0 ? "complete" : "pending";
}

export function buildEmployerSetupSteps(data: SetupEvidence, finance: SetupFinanceStatus): EmployerSetupStep[] {
  const { profile } = data;
  const organisationReady = Boolean(
    profile.employerName.trim() &&
    profile.primaryContact.trim() &&
    /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(profile.contactEmail.trim()) &&
    profile.contactEmail.trim().toLowerCase() !== "hello@levytate.co.uk" &&
    profile.sites.some((site) => site.trim()) &&
    profile.departments.some((department) => department.trim())
  );
  const activePeople = data.employees.filter((person) => person.status === "Active");
  const managerIds = new Set(activePeople.filter((person) => person.platformRole === "Line Manager" && person.id).map((person) => person.id));
  const assignedPeople = activePeople.filter((person) => person.platformRole === "Employee" && person.managerId && managerIds.has(person.managerId));
  const providerIds = new Set(data.organisationProviders.filter((provider) => provider.status === "Active" && provider.providerId).map((provider) => provider.providerId));
  const published = data.organisationProgrammes.filter((programme) => programme.status === "Active" && programme.programmeId && programme.providerId && providerIds.has(programme.providerId));

  return [
    { key: "organisation", label: "Organisation", complete: organisationReady, target: "Settings", detail: organisationReady ? "Company, contacts, sites and departments saved" : "Add company, main contact, sites and departments" },
    { key: "priorities", label: "Business priorities", complete: profile.priorities.length > 0, target: "Settings", detail: profile.priorities.length ? "Priorities saved" : "Choose the development priorities for your people" },
    { key: "managers", label: "Line managers", complete: managerIds.size > 0, target: "Employees", detail: managerIds.size ? managerIds.size + " active line manager" + (managerIds.size === 1 ? "" : "s") : "Create at least one active Line Manager record" },
    { key: "employees", label: "Employees", complete: assignedPeople.length > 0, target: "Employees", detail: assignedPeople.length ? assignedPeople.length + " active employee" + (assignedPeople.length === 1 ? "" : "s") + " assigned to a manager" : "Add employees and assign a line manager" },
    { key: "providers", label: "Provider partners", complete: providerIds.size > 0, target: "Marketplace", detail: providerIds.size ? providerIds.size + " provider" + (providerIds.size === 1 ? "" : "s") + " selected" : "Choose the providers your organisation works with" },
    { key: "programmes", label: "Apprenticeship programmes", complete: published.length > 0, target: "Marketplace", detail: published.length ? published.length + " programme" + (published.length === 1 ? "" : "s") + " published" : "Publish at least one programme linked to a selected provider" },
    { key: "learners", label: "Existing learners", complete: data.learnerRecords.length > 0, target: "Learners", optional: true, detail: data.learnerRecords.length ? "Existing learner records available" : "Optional: import learners when you have their details" },
    { key: "finance", label: "DAS finance data", complete: finance === "complete", target: "Finance", optional: true,
      detail: finance === "checking" ? "Checking saved finance evidence…" : finance === "unavailable" ? "Finance verification unavailable — retry when ready" : finance === "complete" ? "Saved DAS import and transactions available" : "Optional: import DAS transactions or plan future starts" },
  ];
}

export function employerSetupComplete(steps: ReadonlyArray<EmployerSetupStep>) {
  const required = steps.filter((step) => !step.optional);
  return required.length > 0 && required.every((step) => step.complete);
}
