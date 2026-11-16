type Employee = { key: string; membershipId: string; personId: string };
type Tenant = { id: string; key: string; users: Employee[] };
type ScopedRecord = { organisation_id: string; employee_id: string; application_id: string };
export function confirmExistingCoreLearner(input: {
  id: string;
  manifest: { synthetic: boolean; environment: string; run: string; tenants: Tenant[] };
  tenant: Tenant;
  employee: Employee;
  learners: Array<ScopedRecord & { id: string; record_status: string; lifecycle_status: string }>;
  applications: Array<{ id: string; organisation_id: string; employee_id: string; status: string }>;
  enrolments: Array<ScopedRecord & { status: string }>;
}): string;
