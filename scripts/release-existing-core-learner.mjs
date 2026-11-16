/** Read-only continuation guard for the already enrolled current fictional run. */
export function confirmExistingCoreLearner({ id, manifest, tenant, employee, learners, applications, enrolments }) {
  if (!/^learner-[a-f0-9-]{36}$/.test(id ?? "") || manifest?.synthetic !== true || manifest.environment !== "local"
    || tenant?.key !== "a" || !manifest.tenants?.some(row => row.id === tenant.id && row.key === "a")
    || employee?.key !== "employee" || !tenant.users?.some(row => row.membershipId === employee.membershipId && row.personId === employee.personId)) throw Error("Exact fictional continuation scope required");
  const reference = `browser-${manifest.run}`;
  const learner = learners?.length === 1 ? learners[0] : null;
  const application = applications?.length === 1 ? applications[0] : null;
  const enrolment = enrolments?.length === 1 ? enrolments[0] : null;
  if (learner?.id !== id || learner.organisation_id !== tenant.id || learner.employee_id !== employee.personId
    || learner.application_id !== reference || learner.record_status !== "Active" || learner.lifecycle_status !== "enrolled"
    || application?.id !== reference || application.organisation_id !== tenant.id || application.employee_id !== employee.personId || application.status !== "Completed"
    || enrolment?.organisation_id !== tenant.id || enrolment.application_id !== reference || enrolment.employee_id !== employee.personId || enrolment.status !== "Live learner") throw Error("Existing core learner must retain exact current-run completed handoff and live enrolment");
  return id;
}
