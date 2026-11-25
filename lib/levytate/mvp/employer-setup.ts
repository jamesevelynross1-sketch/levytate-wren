/** Setup is derived from the employer's persisted operational evidence, never from a non-empty workspace flag. */
export type SetupFinanceStatus = "checking" | "pending" | "complete" | "unavailable";
export type EmployerSetupStep = { label: string; complete: boolean; target: string; optional?: boolean; detail?: string };
type SetupEvidence = {
  employees: ReadonlyArray<{ status: string }>;
  organisationProviders: ReadonlyArray<{ status: string }>;
  organisationProgrammes: ReadonlyArray<{ status: string }>;
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
  return [
    { label: "Add your first employee", complete: data.employees.some((item) => item.status === "Active"), target: "Employees" },
    { label: "Add a provider", complete: data.organisationProviders.some((item) => item.status === "Active"), target: "Marketplace" },
    { label: "Publish a programme", complete: data.organisationProgrammes.some((item) => item.status === "Active"), target: "Marketplace" },
    { label: "Import an existing learner", complete: data.learnerRecords.length > 0, target: "Learners", optional: true },
    { label: "Bring in DAS finance data", complete: finance === "complete", target: "Finance", optional: true,
      detail: finance === "checking" ? "Checking saved finance data…" : finance === "unavailable" ? "Could not verify saved finance data" : undefined },
  ];
}

export function employerSetupComplete(steps: ReadonlyArray<EmployerSetupStep>) {
  return steps.length > 0 && steps.every((step) => step.complete);
}
