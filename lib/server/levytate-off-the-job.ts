import { randomUUID } from "node:crypto";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import type {
  LearningTimeActivityInput,
  LearningTimeActivityView,
  LearningTimeConfirmationView,
  LearningTimeLearnerView,
  LearningTimePlanView,
  LearningTimePriorityView,
  LearningTimeWorkspace,
} from "@/lib/levytate/off-the-job/api";
import {
  assessCandidateOffTheJobActivity,
  calculateLearningTimeTotals,
  deriveActivityDurationMinutes,
  eligibleActivityCategories,
  excludedActivityCategories,
  policyRegimeForOriginalStartDate,
  type OtjActivityCategory,
  type OtjWorkingHoursBasis,
} from "@/lib/levytate/off-the-job/domain";
import { normaliseMvpUserRole, type MvpUserRole } from "@/lib/levytate/mvp/rbac";
import { getLearnerLifecycleServerContext } from "@/lib/server/levytate-learner-lifecycle";
import { isOffTheJobAssistantEnabledForOrganisation } from "@/lib/server/levytate-off-the-job-capability";
import {
  getLevyTateSupabaseConfig,
  supabaseFetchJson,
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
} from "@/lib/server/levytate-supabase";

const regulatoryNotice = "LevyTate helps you prepare and organise learning evidence. Your training provider remains responsible for confirming the evidence used for off-the-job training.";
const activityCategories = new Set<string>([...eligibleActivityCategories, ...excludedActivityCategories]);
const workingHoursBases = new Set<string>(["within_normal_working_hours", "paid_exception", "time_off_in_lieu_exception", "outside_working_hours_uncompensated", "not_confirmed"]);
const planSourceTypes = new Set(["provider_training_plan", "provider_email", "provider_review", "mis_lms_import", "provider_api", "other_documented_source"]);
const prioritySourceTypes = new Set(["provider_training_plan", "provider_review", "employer_priority", "learner_goal", "manager_workplace_opportunity", "mis_lms_import"]);
const confirmationSourceTypes = new Set(["provider_report", "provider_email", "provider_review", "mis_lms_import", "provider_api", "other_documented_provider_evidence"]);
const confirmationOutcomes = new Set(["confirmed", "partially_confirmed", "not_confirmed", "superseded"]);
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

type EmployeeRow = { id: string; name: string; email: string; job_title: string; department: string; site: string; manager_id: string; status: string };
type LearnerRow = { id: string; employee_id: string; programme_id: string; provider_id: string; lifecycle_status: string; actual_start_date: string | null; expected_start_date: string | null; expected_end_date: string | null; record_status: string };
type PlanRow = { id: string; learner_record_id: string; status: LearningTimePlanView["status"]; current_published_version_id: string | null };
type PlanVersionRow = {
  id: string; plan_id: string; version_number: number; policy_regime: LearningTimePlanView["policyRegime"];
  original_apprenticeship_start_date: string; practical_period_start_date: string; practical_period_end_date: string;
  standard_id: string; standard_version: string; published_standard_minimum_minutes: number | null;
  legacy_indicative_minimum_minutes: number | null; prior_learning_reduction_minutes: number;
  individual_minimum_minutes: number; planned_delivery_minutes: number; provider_id: string;
  training_plan_reference: string; source_type: string; source_date: string; inactivity_attention_days: number;
  notes: string; status: "draft" | "published" | "superseded"; published_at: string | null; created_at: string;
};
type PriorityRow = { id: string; learner_record_id: string; plan_version_id: string; label: string; description: string; ksb_references: unknown; source_type: string; source_reference: string; target_date: string | null; status: LearningTimePriorityView["status"] };
type ActivityRow = {
  id: string; learner_record_id: string; plan_version_id: string; activity_date: string; started_at: string; ended_at: string;
  break_minutes: number; duration_minutes: number; timezone: string; category: OtjActivityCategory; title: string; description: string;
  what_was_new: string; standard_relevance: string; reflection: string; working_hours_basis: OtjWorkingHoursBasis;
  compensation_note: string; separate_from_productive_work: boolean | null; ksb_references: unknown; evidence_reference: string;
  deterministic_outcome: LearningTimeActivityView["deterministicOutcome"]; deterministic_reasons: unknown;
  status: LearningTimeActivityView["status"]; created_by_user_id: string; submitted_at: string | null;
  lock_version: number; created_at: string; updated_at: string;
};
type ConfirmationRow = { id: string; activity_id: string; outcome: LearningTimeConfirmationView["outcome"]; confirmed_minutes: number; confirmation_source_type: string; provider_id: string; source_reference: string; source_date: string; recorded_by: string; recorded_at: string; note: string };
type BreakRow = { learner_record_id: string; start_date: string; actual_return_date: string | null; status: string };
type ProgrammeRow = { id: string; programme_name: string; apprenticeship_standard_id: string; linked_standard_id: string | null };
type ProviderRow = { provider_id: string; provider_name: string };
type UserLabelRow = { id: string; display_name: string; email: string };
type RequirementRow = { id: string; standard_id: string; standard_version: string; minimum_minutes: number; source_url: string; source_updated_at: string | null; source_status: string };

export class LevyTateLearningTimeError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "LevyTateLearningTimeError";
  }
}

export async function getLearningTimeWorkspace(session: LevyTateBetaSession): Promise<LearningTimeWorkspace> {
  const { organisation, user } = await authorisedContext(session);
  const config = requireConfig();
  const role = normaliseMvpUserRole(user.role);
  const employees = await supabaseSelect<EmployeeRow>(config, "levytate_employees", new URLSearchParams({
    select: "id,name,email,job_title,department,site,manager_id,status",
    organisation_id: `eq.${organisation.id}`,
    status: "eq.Active",
    order: "name.asc",
    limit: "1000",
  }));
  const visibleEmployees = scopedEmployees(role, user.email, employees);
  const employeeIds = visibleEmployees.map((employee) => employee.id);
  if (!employeeIds.length) return emptyWorkspace(role);

  const learnerRows = await supabaseSelect<LearnerRow>(config, "levytate_learner_records", new URLSearchParams({
    select: "id,employee_id,programme_id,provider_id,lifecycle_status,actual_start_date,expected_start_date,expected_end_date,record_status",
    organisation_id: `eq.${organisation.id}`,
    employee_id: inFilter(employeeIds),
    record_status: "eq.Active",
    order: "updated_at.desc",
    limit: "1000",
  }));
  if (!learnerRows.length) return emptyWorkspace(role);
  const learnerIds = learnerRows.map((learner) => learner.id);

  const [plans, breaks, activities, programmes, providers] = await Promise.all([
    selectByLearners<PlanRow>("levytate_otj_plans", organisation.id, learnerIds, "id,learner_record_id,status,current_published_version_id"),
    selectByLearners<BreakRow>("levytate_learner_breaks_in_learning", organisation.id, learnerIds, "learner_record_id,start_date,actual_return_date,status"),
    selectByLearners<ActivityRow>("levytate_otj_activities", organisation.id, learnerIds, activitySelect),
    selectByIds<ProgrammeRow>("levytate_provider_programmes", "id", learnerRows.map((learner) => learner.programme_id).filter(Boolean), "id,programme_name,apprenticeship_standard_id,linked_standard_id"),
    selectByIds<ProviderRow>("levytate_providers", "provider_id", learnerRows.map((learner) => learner.provider_id).filter(Boolean), "provider_id,provider_name"),
  ]);
  const planIds = plans.map((plan) => plan.id);
  const planVersions = await selectByIds<PlanVersionRow>("levytate_otj_plan_versions", "plan_id", planIds, planVersionSelect, organisation.id);
  const versionIds = planVersions.map((version) => version.id);
  const priorities = await selectByIds<PriorityRow>("levytate_otj_learning_priorities", "plan_version_id", versionIds, prioritySelect, organisation.id);
  const visibleActivities = activities.filter((activity) => role === "Employee" || activity.status !== "draft");
  const confirmations = await selectByIds<ConfirmationRow>("levytate_otj_activity_confirmations", "activity_id", visibleActivities.map((activity) => activity.id), confirmationSelect, organisation.id);
  const recorderIds = [...new Set(confirmations.map((confirmation) => confirmation.recorded_by))];
  const recorderLabels = await selectByIds<UserLabelRow>("levytate_users", "id", recorderIds, "id,display_name,email", organisation.id);

  const employeeById = new Map(visibleEmployees.map((employee) => [employee.id, employee]));
  const programmeById = new Map(programmes.map((programme) => [programme.id, programme]));
  const providerById = new Map(providers.map((provider) => [provider.provider_id, provider]));
  const planByLearner = new Map(plans.map((plan) => [plan.learner_record_id, plan]));
  const versionById = new Map(planVersions.map((version) => [version.id, version]));
  const recorderById = new Map(recorderLabels.map((entry) => [entry.id, entry.display_name || entry.email]));
  const latestConfirmationByActivity = latestConfirmations(confirmations);

  const learners = learnerRows.flatMap<LearningTimeLearnerView>((learner) => {
    const employee = employeeById.get(learner.employee_id);
    if (!employee) return [];
    const planRecord = planByLearner.get(learner.id);
    const currentVersion = planRecord?.current_published_version_id
      ? versionById.get(planRecord.current_published_version_id)
      : (role === "Apprenticeship Lead" || role === "Employer Admin") && planRecord
        ? planVersions.filter((version) => version.plan_id === planRecord.id && version.status === "draft").sort((left, right) => right.version_number - left.version_number)[0]
        : undefined;
    const plan = planRecord && currentVersion ? planView(planRecord, currentVersion) : null;
    const learnerPriorities = currentVersion
      ? priorities.filter((priority) => priority.learner_record_id === learner.id && priority.plan_version_id === currentVersion.id).map(priorityView)
      : [];
    const learnerActivities = visibleActivities
      .filter((activity) => activity.learner_record_id === learner.id)
      .sort((left, right) => right.activity_date.localeCompare(left.activity_date) || right.created_at.localeCompare(left.created_at))
      .map((activity) => activityView(activity, latestConfirmationByActivity.get(activity.id), recorderById));
    const totals = calculateLearningTimeTotals({
      individualMinimumMinutes: plan?.individualMinimumMinutes ?? 0,
      activities: learnerActivities.map((activity) => ({ id: activity.id, durationMinutes: activity.durationMinutes, status: activity.status })),
      confirmations: confirmations.filter((confirmation) => learnerActivities.some((activity) => activity.id === confirmation.activity_id)).map((confirmation) => ({
        activityId: confirmation.activity_id,
        outcome: confirmation.outcome,
        confirmedMinutes: confirmation.confirmed_minutes,
        recordedAt: confirmation.recorded_at,
      })),
    });
    const activeBreak = breaks.some((record) => record.learner_record_id === learner.id && record.status === "active");
    const attention = deriveAttention(plan, learnerActivities, activeBreak);
    const programme = programmeById.get(learner.programme_id);
    return [{
      learnerRecordId: learner.id,
      employeeId: learner.employee_id,
      learnerName: employee.name,
      jobTitle: employee.job_title,
      department: employee.department,
      site: employee.site,
      programmeId: learner.programme_id,
      programmeName: programme?.programme_name || "Programme not confirmed",
      standardId: programme?.linked_standard_id || programme?.apprenticeship_standard_id || currentVersion?.standard_id || "",
      providerId: learner.provider_id,
      providerName: providerById.get(learner.provider_id)?.provider_name || "Provider not confirmed",
      lifecycleStatus: learner.lifecycle_status,
      activeBreak,
      plan,
      priorities: learnerPriorities,
      activities: learnerActivities,
      totals,
      attention,
      lastActivityDate: learnerActivities.find((activity) => activity.status !== "draft")?.activityDate ?? null,
    }];
  });

  return {
    generatedAt: new Date().toISOString(),
    role,
    capabilityEnabled: true,
    canManagePlans: role === "Apprenticeship Lead" || role === "Employer Admin",
    canReviewActivities: role === "Apprenticeship Lead" || role === "Employer Admin",
    canCreateActivities: role === "Employee",
    learners,
    portfolio: {
      activeLearnerPlans: learners.filter((learner) => learner.plan?.status === "published").length,
      providerConfirmedMinutes: learners.reduce((sum, learner) => sum + learner.totals.providerConfirmedMinutes, 0),
      candidateMinutesAwaitingCheck: learners.flatMap((learner) => learner.activities).filter((activity) => activity.status === "submitted").reduce((sum, activity) => sum + activity.durationMinutes, 0),
      activitiesAwaitingProviderConfirmation: learners.flatMap((learner) => learner.activities).filter((activity) => activity.status === "employer_checked" && !activity.confirmation).length,
      plansNeedingSetup: learners.filter((learner) => !learner.plan).length,
      operationalAttention: learners.reduce((sum, learner) => sum + learner.attention.length, 0),
    },
    regulatoryNotice,
  };
}

export async function saveLearningTimeActivity(session: LevyTateBetaSession, input: LearningTimeActivityInput) {
  const { organisation, user } = await authorisedContext(session);
  if (normaliseMvpUserRole(user.role) !== "Employee") throw new LevyTateLearningTimeError("Only an employee may create their own learning-time activity.", 403);
  assertActivityInput(input);
  const config = requireConfig();
  const employee = (await supabaseSelect<EmployeeRow>(config, "levytate_employees", new URLSearchParams({
    select: "id,name,email,job_title,department,site,manager_id,status", organisation_id: `eq.${organisation.id}`,
    email: `eq.${user.email.toLowerCase()}`, status: "eq.Active", limit: "1",
  })))[0];
  if (!employee) throw new LevyTateLearningTimeError("Your active employee record could not be found.", 403);
  const learner = (await supabaseSelect<LearnerRow>(config, "levytate_learner_records", new URLSearchParams({
    select: "id,employee_id,programme_id,provider_id,lifecycle_status,actual_start_date,expected_start_date,expected_end_date,record_status",
    organisation_id: `eq.${organisation.id}`, id: `eq.${input.learnerRecordId}`, employee_id: `eq.${employee.id}`, record_status: "eq.Active", limit: "1",
  })))[0];
  if (!learner) throw new LevyTateLearningTimeError("The learner record was not found in your scope.", 404);
  const plan = (await supabaseSelect<PlanRow>(config, "levytate_otj_plans", new URLSearchParams({
    select: "id,learner_record_id,status,current_published_version_id", organisation_id: `eq.${organisation.id}`,
    learner_record_id: `eq.${learner.id}`, status: "eq.published", limit: "1",
  })))[0];
  if (!plan?.current_published_version_id) throw new LevyTateLearningTimeError("Your agreed learning-time plan has not been configured yet.", 409);
  const version = (await supabaseSelect<PlanVersionRow>(config, "levytate_otj_plan_versions", new URLSearchParams({
    select: planVersionSelect, organisation_id: `eq.${organisation.id}`, id: `eq.${plan.current_published_version_id}`, status: "eq.published", limit: "1",
  })))[0];
  if (!version) throw new LevyTateLearningTimeError("The published learning-time plan is unavailable.", 409);
  const activeBreak = (await supabaseSelect<BreakRow>(config, "levytate_learner_breaks_in_learning", new URLSearchParams({
    select: "learner_record_id,start_date,actual_return_date,status", organisation_id: `eq.${organisation.id}`,
    learner_record_id: `eq.${learner.id}`, status: "eq.active", limit: "1",
  })))[0];
  const sameDay = await supabaseSelect<ActivityRow>(config, "levytate_otj_activities", new URLSearchParams({
    select: activitySelect, organisation_id: `eq.${organisation.id}`, learner_record_id: `eq.${learner.id}`,
    activity_date: `eq.${input.activityDate}`, status: "not.in.(withdrawn,not_counted)", limit: "100",
  }));
  const overlap = sameDay.some((activity) => activity.id !== input.activityId && timesOverlap(input.startedAt, input.endedAt, activity.started_at, activity.ended_at));
  const assessment = assessCandidateOffTheJobActivity({
    lifecycleStatus: learner.lifecycle_status,
    activityDate: input.activityDate,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    breakMinutes: input.breakMinutes,
    category: input.category,
    whatWasNew: input.whatWasNew,
    standardRelevance: input.standardRelevance,
    workingHoursBasis: input.workingHoursBasis,
    compensationNote: input.compensationNote,
    separateFromProductiveWork: input.separateFromProductiveWork,
    evidenceReference: input.evidenceReference,
    practicalPeriodStartDate: version.practical_period_start_date,
    practicalPeriodEndDate: version.practical_period_end_date,
    activeBreakStartDate: activeBreak?.start_date,
    activeBreakEndDate: activeBreak?.actual_return_date,
    overlappingActivity: overlap,
  });
  const nonCounted = assessment.outcome === "likely_ineligible" && input.saveAsNonCounted === true;
  if (assessment.outcome === "likely_ineligible" && !nonCounted) {
    throw new LevyTateLearningTimeError("This activity is likely ineligible. Save it explicitly as a non-counted learning note if you want to retain it.", 422);
  }
  const row = {
    organisation_id: organisation.id,
    learner_record_id: learner.id,
    plan_version_id: version.id,
    activity_date: input.activityDate,
    started_at: input.startedAt,
    ended_at: input.endedAt,
    break_minutes: input.breakMinutes,
    duration_minutes: Math.max(1, assessment.durationMinutes),
    timezone: bounded(input.timezone || "Europe/London", 80),
    category: input.category,
    title: boundedRequired(input.title, 180, "Activity title"),
    description: boundedRequired(input.description, 4000, "Activity description"),
    what_was_new: bounded(input.whatWasNew, 3000),
    standard_relevance: bounded(input.standardRelevance, 3000),
    reflection: bounded(input.reflection, 3000),
    working_hours_basis: input.workingHoursBasis,
    compensation_note: bounded(input.compensationNote || "", 1000),
    separate_from_productive_work: input.separateFromProductiveWork,
    ksb_references: boundedStringArray(input.ksbReferences, 30, 80),
    evidence_reference: bounded(input.evidenceReference || "", 1000),
    deterministic_outcome: assessment.outcome,
    deterministic_reasons: assessment.reasons.slice(0, 20).map((reason) => bounded(reason, 500)),
    status: nonCounted ? "not_counted" : "draft",
    created_by_user_id: user.id,
    created_by_email: user.email.toLowerCase(),
    submitted_at: nonCounted ? new Date().toISOString() : null,
    lock_version: 0,
    updated_at: new Date().toISOString(),
  };
  if (input.activityId) {
    const existing = (await supabaseSelect<ActivityRow>(config, "levytate_otj_activities", new URLSearchParams({
      select: activitySelect, organisation_id: `eq.${organisation.id}`, id: `eq.${input.activityId}`,
      created_by_user_id: `eq.${user.id}`, status: "in.(draft,needs_information)", limit: "1",
    })))[0];
    if (!existing) throw new LevyTateLearningTimeError("Only your private draft or returned activity can be edited.", 409);
    const [updated] = await supabaseUpdate<ActivityRow>(config, "levytate_otj_activities", `organisation_id=eq.${organisation.id}&id=eq.${existing.id}&status=in.(draft,needs_information)&lock_version=eq.${existing.lock_version}`, {
      ...row, status: existing.status, submitted_at: existing.submitted_at,
      created_by_user_id: existing.created_by_user_id, created_by_email: user.email.toLowerCase(), lock_version: existing.lock_version + 1,
    });
    if (!updated) throw new LevyTateLearningTimeError("The draft changed; refresh before trying again.", 409);
    return { activity: updated, assessment };
  }
  const [created] = await supabaseInsert<ActivityRow>(config, "levytate_otj_activities", [{ id: randomUUID(), ...row }]);
  if (!created) throw new LevyTateLearningTimeError("The learning activity could not be saved.", 503);
  await supabaseInsert(config, "levytate_otj_activity_events", [{
    id: randomUUID(), organisation_id: organisation.id, activity_id: created.id,
    event_type: nonCounted ? "marked_not_counted" : "draft_created", actor_user_id: user.id, actor_role: user.role,
    previous_state: null, new_state: created.status,
    safe_summary: nonCounted ? "Ineligible activity retained as a non-counted learning note." : "Private learner draft created.",
    idempotency_key: randomUUID(),
  }], { prefer: "return=minimal" });
  return { activity: created, assessment };
}

export async function submitLearningTimeActivity(session: LevyTateBetaSession, input: { activityId: string; lockVersion: number; idempotencyKey: string }) {
  const { organisation, user } = await authorisedContext(session);
  const [activity] = await supabaseSelect<Pick<ActivityRow, "id" | "lock_version" | "deterministic_reasons">>(
    requireConfig(),
    "levytate_otj_activities",
    new URLSearchParams({
      select: "id,lock_version,deterministic_reasons",
      organisation_id: `eq.${organisation.id}`,
      id: `eq.${input.activityId}`,
      created_by_user_id: `eq.${user.id}`,
      status: "in.(draft,needs_information)",
      limit: "1",
    }),
  );
  if (activity?.lock_version === input.lockVersion && stringArray(activity.deterministic_reasons).some((reason) => reason.toLowerCase().includes("overlaps another learning activity"))) {
    throw new LevyTateLearningTimeError("Overlapping activity requires resolution before submission.", 409);
  }
  return rpc<ActivityRow>("levytate_submit_otj_activity", {
    p_organisation_id: organisation.id, p_activity_id: input.activityId, p_actor_user_id: user.id,
    p_idempotency_key: idempotency(input.idempotencyKey), p_expected_lock_version: input.lockVersion,
  });
}

export async function transitionLearningTimeActivity(session: LevyTateBetaSession, input: { activityId: string; action: string; note: string; lockVersion: number; idempotencyKey: string }) {
  const { organisation, user } = await authorisedContext(session);
  return rpc<ActivityRow>("levytate_transition_otj_activity", {
    p_organisation_id: organisation.id, p_activity_id: input.activityId, p_actor_user_id: user.id,
    p_action: input.action, p_safe_summary: bounded(input.note, 1000), p_idempotency_key: idempotency(input.idempotencyKey),
    p_expected_lock_version: input.lockVersion,
  });
}

export async function recordLearningTimeConfirmation(session: LevyTateBetaSession, input: {
  activityId: string; outcome: string; confirmedMinutes: number; sourceType: string; providerId: string;
  sourceReference: string; sourceDate: string; note: string; idempotencyKey: string;
}) {
  const { organisation, user } = await authorisedContext(session);
  if (!confirmationOutcomes.has(input.outcome)) throw new LevyTateLearningTimeError("A valid provider-confirmation outcome is required.");
  if (!confirmationSourceTypes.has(input.sourceType)) throw new LevyTateLearningTimeError("A valid attributable provider source type is required.");
  if (!Number.isInteger(input.confirmedMinutes) || input.confirmedMinutes < 0) throw new LevyTateLearningTimeError("Confirmed minutes must be a non-negative whole number.");
  assertIsoDate(input.sourceDate, "Provider source date");
  return rpc<ConfirmationRow>("levytate_record_otj_confirmation", {
    p_organisation_id: organisation.id, p_activity_id: input.activityId, p_actor_user_id: user.id,
    p_outcome: input.outcome, p_confirmed_minutes: input.confirmedMinutes, p_source_type: input.sourceType,
    p_provider_id: boundedRequired(input.providerId, 200, "Provider"),
    p_source_reference: boundedRequired(input.sourceReference, 1000, "Provider source reference"),
    p_source_date: input.sourceDate, p_note: bounded(input.note, 2000), p_idempotency_key: idempotency(input.idempotencyKey),
  });
}

export async function createLearningTimePlanDraft(session: LevyTateBetaSession, input: {
  learnerRecordId: string; originalStartDate: string; practicalStartDate: string; practicalEndDate: string;
  standardId: string; standardVersion: string; priorLearningReductionMinutes: number; individualMinimumMinutes: number;
  plannedDeliveryMinutes: number; legacyIndicativeMinimumMinutes?: number | null; providerId: string;
  trainingPlanReference: string; sourceType: string; sourceDate: string; inactivityAttentionDays?: number; notes?: string;
}) {
  const { organisation, user } = await authorisedContext(session);
  assertPlanManager(user.role);
  assertIsoDate(input.originalStartDate, "Original apprenticeship start date");
  assertIsoDate(input.practicalStartDate, "Practical-period start date");
  assertIsoDate(input.practicalEndDate, "Practical-period end date");
  assertIsoDate(input.sourceDate, "Training-plan source date");
  if (input.practicalEndDate < input.practicalStartDate) throw new LevyTateLearningTimeError("Practical-period end date cannot be before its start date.");
  if (!planSourceTypes.has(input.sourceType)) throw new LevyTateLearningTimeError("A valid training-plan source type is required.");
  if (input.inactivityAttentionDays !== undefined && (!Number.isInteger(input.inactivityAttentionDays) || input.inactivityAttentionDays < 7 || input.inactivityAttentionDays > 365)) throw new LevyTateLearningTimeError("The inactivity review threshold must be between 7 and 365 days.");
  const config = requireConfig();
  const learner = (await supabaseSelect<LearnerRow>(config, "levytate_learner_records", new URLSearchParams({
    select: "id,employee_id,programme_id,provider_id,lifecycle_status,actual_start_date,expected_start_date,expected_end_date,record_status",
    organisation_id: `eq.${organisation.id}`, id: `eq.${input.learnerRecordId}`, record_status: "eq.Active", limit: "1",
  })))[0];
  if (!learner) throw new LevyTateLearningTimeError("Learner was not found in this organisation.", 404);
  const regime = policyRegimeForOriginalStartDate(input.originalStartDate);
  const requirement = regime === "standard_minimum" ? (await supabaseSelect<RequirementRow>(config, "levytate_standard_otj_requirements", new URLSearchParams({
    select: "id,standard_id,standard_version,minimum_minutes,source_url,source_updated_at,source_status",
    standard_id: `eq.${boundedRequired(input.standardId, 40, "Standard")}`,
    standard_version: `eq.${boundedRequired(input.standardVersion, 40, "Standard version")}`,
    source_status: "eq.verified", order: "policy_effective_from.desc", limit: "1",
  })))[0] : undefined;
  if (regime === "standard_minimum" && !requirement) throw new LevyTateLearningTimeError("Official minimum unavailable for this exact standard version.", 409);
  if (!Number.isInteger(input.individualMinimumMinutes) || input.individualMinimumMinutes < 0) throw new LevyTateLearningTimeError("Individual minimum minutes must be non-negative.");
  if (!Number.isInteger(input.priorLearningReductionMinutes) || input.priorLearningReductionMinutes < 0) throw new LevyTateLearningTimeError("Prior-learning reduction minutes must be non-negative.");
  if (requirement && input.priorLearningReductionMinutes > requirement.minimum_minutes) throw new LevyTateLearningTimeError("Prior-learning reduction cannot exceed the published standard minimum.");
  const adjustedFloor = requirement ? Math.max(11_220, requirement.minimum_minutes - input.priorLearningReductionMinutes) : 0;
  if (regime === "standard_minimum" && input.individualMinimumMinutes < adjustedFloor) throw new LevyTateLearningTimeError("The individual minimum cannot be below the applicable standard minimum after prior-learning reduction or the current 187-hour floor.");
  if (regime === "legacy_percentage" && !Number.isInteger(input.legacyIndicativeMinimumMinutes)) throw new LevyTateLearningTimeError("A legacy indicative minimum from the agreed training plan is required.");
  if (!Number.isInteger(input.plannedDeliveryMinutes) || input.plannedDeliveryMinutes < input.individualMinimumMinutes) throw new LevyTateLearningTimeError("Planned delivery cannot be below the individual minimum.");
  let plan = (await supabaseSelect<PlanRow>(config, "levytate_otj_plans", new URLSearchParams({
    select: "id,learner_record_id,status,current_published_version_id", organisation_id: `eq.${organisation.id}`,
    learner_record_id: `eq.${learner.id}`, limit: "1",
  })))[0];
  if (!plan) {
    [plan] = await supabaseInsert<PlanRow>(config, "levytate_otj_plans", [{ id: randomUUID(), organisation_id: organisation.id, learner_record_id: learner.id, status: "draft", created_by: user.id }]);
  }
  if (!plan) throw new LevyTateLearningTimeError("The learning-time plan could not be created.", 503);
  const versions = await supabaseSelect<PlanVersionRow>(config, "levytate_otj_plan_versions", new URLSearchParams({
    select: planVersionSelect, organisation_id: `eq.${organisation.id}`, plan_id: `eq.${plan.id}`, order: "version_number.desc", limit: "100",
  }));
  if (versions.some((version) => version.status === "draft")) throw new LevyTateLearningTimeError("A draft plan version already exists.", 409);
  const [version] = await supabaseInsert<PlanVersionRow>(config, "levytate_otj_plan_versions", [{
    id: randomUUID(), organisation_id: organisation.id, plan_id: plan.id, version_number: (versions[0]?.version_number ?? 0) + 1,
    policy_regime: regime, original_apprenticeship_start_date: input.originalStartDate,
    practical_period_start_date: input.practicalStartDate, practical_period_end_date: input.practicalEndDate,
    standard_id: boundedRequired(input.standardId, 40, "Standard"), standard_version: boundedRequired(input.standardVersion, 40, "Standard version"),
    standard_requirement_id: requirement?.id ?? null, published_standard_minimum_minutes: requirement?.minimum_minutes ?? null,
    legacy_indicative_minimum_minutes: regime === "legacy_percentage" ? input.legacyIndicativeMinimumMinutes ?? null : null,
    prior_learning_reduction_minutes: input.priorLearningReductionMinutes, individual_minimum_minutes: input.individualMinimumMinutes,
    planned_delivery_minutes: input.plannedDeliveryMinutes, provider_id: boundedRequired(input.providerId, 200, "Provider"),
    training_plan_reference: boundedRequired(input.trainingPlanReference, 500, "Training-plan reference"), source_type: input.sourceType,
    source_date: input.sourceDate, inactivity_attention_days: input.inactivityAttentionDays ?? 28,
    notes: bounded(input.notes || "", 4000), status: "draft", created_by: user.id,
  }]);
  await supabaseUpdate(config, "levytate_otj_plans", `organisation_id=eq.${organisation.id}&id=eq.${plan.id}`, { status: "draft", updated_at: new Date().toISOString() }, { prefer: "return=minimal" });
  return version;
}

export async function publishLearningTimePlan(session: LevyTateBetaSession, input: { versionId: string }) {
  const { organisation, user } = await authorisedContext(session);
  assertPlanManager(user.role);
  return rpc<PlanVersionRow>("levytate_publish_otj_plan", { p_organisation_id: organisation.id, p_version_id: input.versionId, p_actor_user_id: user.id });
}

export async function addLearningTimePriority(session: LevyTateBetaSession, input: {
  learnerRecordId: string; planVersionId: string; label: string; description: string; ksbReferences?: string[];
  sourceType: string; sourceReference: string; targetDate?: string | null;
}) {
  const { organisation, user } = await authorisedContext(session);
  assertPlanManager(user.role);
  if (!prioritySourceTypes.has(input.sourceType)) throw new LevyTateLearningTimeError("A valid learning-priority source type is required.");
  if (input.targetDate) assertIsoDate(input.targetDate, "Priority target date");
  const config = requireConfig();
  const [priority] = await supabaseInsert<PriorityRow>(config, "levytate_otj_learning_priorities", [{
    id: randomUUID(), organisation_id: organisation.id, learner_record_id: input.learnerRecordId,
    plan_version_id: input.planVersionId, label: boundedRequired(input.label, 180, "Priority label"),
    description: bounded(input.description, 2000), ksb_references: boundedStringArray(input.ksbReferences, 30, 80),
    source_type: input.sourceType, source_reference: boundedRequired(input.sourceReference, 500, "Priority source"),
    target_date: input.targetDate || null, status: "active", created_by: user.id,
  }]);
  return priority;
}

async function authorisedContext(session: LevyTateBetaSession) {
  const context = await getLearnerLifecycleServerContext(session);
  if (!(await isOffTheJobAssistantEnabledForOrganisation(context.organisation.id))) {
    throw new LevyTateLearningTimeError("Learning Time is not enabled for this organisation.", 404);
  }
  if (normaliseMvpUserRole(context.user.role) === "Platform Admin") {
    throw new LevyTateLearningTimeError("Platform Admin cannot access employer learning evidence.", 403);
  }
  return context;
}

function scopedEmployees(role: MvpUserRole, email: string, employees: EmployeeRow[]) {
  if (role === "Apprenticeship Lead" || role === "Employer Admin") return employees;
  const current = employees.find((employee) => employee.email.trim().toLowerCase() === email.trim().toLowerCase());
  if (!current) return [];
  if (role === "Line Manager") return employees.filter((employee) => employee.manager_id === current.id);
  return [current];
}

function emptyWorkspace(role: MvpUserRole): LearningTimeWorkspace {
  return {
    generatedAt: new Date().toISOString(), role, capabilityEnabled: true,
    canManagePlans: role === "Apprenticeship Lead" || role === "Employer Admin",
    canReviewActivities: role === "Apprenticeship Lead" || role === "Employer Admin",
    canCreateActivities: role === "Employee", learners: [],
    portfolio: { activeLearnerPlans: 0, providerConfirmedMinutes: 0, candidateMinutesAwaitingCheck: 0, activitiesAwaitingProviderConfirmation: 0, plansNeedingSetup: 0, operationalAttention: 0 },
    regulatoryNotice,
  };
}

function planView(plan: PlanRow, version: PlanVersionRow): LearningTimePlanView {
  return {
    planId: plan.id, versionId: version.id, versionNumber: version.version_number, status: plan.status,
    policyRegime: version.policy_regime, originalApprenticeshipStartDate: version.original_apprenticeship_start_date,
    practicalPeriodStartDate: version.practical_period_start_date, practicalPeriodEndDate: version.practical_period_end_date,
    standardId: version.standard_id, standardVersion: version.standard_version,
    publishedStandardMinimumMinutes: version.published_standard_minimum_minutes,
    legacyIndicativeMinimumMinutes: version.legacy_indicative_minimum_minutes,
    priorLearningReductionMinutes: version.prior_learning_reduction_minutes,
    individualMinimumMinutes: version.individual_minimum_minutes, plannedDeliveryMinutes: version.planned_delivery_minutes,
    providerId: version.provider_id, trainingPlanReference: version.training_plan_reference, sourceType: version.source_type,
    sourceDate: version.source_date, inactivityAttentionDays: version.inactivity_attention_days, notes: version.notes,
    publishedAt: version.published_at,
  };
}

function priorityView(row: PriorityRow): LearningTimePriorityView {
  return { id: row.id, learnerRecordId: row.learner_record_id, label: row.label, description: row.description,
    ksbReferences: stringArray(row.ksb_references), sourceType: row.source_type, sourceReference: row.source_reference,
    targetDate: row.target_date, status: row.status };
}

function activityView(row: ActivityRow, confirmation: ConfirmationRow | undefined, recorders: Map<string, string>): LearningTimeActivityView {
  return {
    id: row.id, learnerRecordId: row.learner_record_id, activityDate: row.activity_date,
    startedAt: row.started_at.slice(0, 5), endedAt: row.ended_at.slice(0, 5), breakMinutes: row.break_minutes,
    durationMinutes: row.duration_minutes, category: row.category, title: row.title, description: row.description,
    whatWasNew: row.what_was_new, standardRelevance: row.standard_relevance, reflection: row.reflection,
    workingHoursBasis: row.working_hours_basis, compensationNote: row.compensation_note,
    separateFromProductiveWork: row.separate_from_productive_work, ksbReferences: stringArray(row.ksb_references),
    evidenceReference: row.evidence_reference, deterministicOutcome: row.deterministic_outcome,
    deterministicReasons: stringArray(row.deterministic_reasons), status: row.status, submittedAt: row.submitted_at,
    lockVersion: row.lock_version, confirmation: confirmation ? confirmationView(confirmation, recorders.get(confirmation.recorded_by)) : null,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function confirmationView(row: ConfirmationRow, recorder?: string): LearningTimeConfirmationView {
  return { id: row.id, activityId: row.activity_id, outcome: row.outcome, confirmedMinutes: row.confirmed_minutes,
    sourceType: row.confirmation_source_type, providerId: row.provider_id, sourceReference: row.source_reference,
    sourceDate: row.source_date, recordedAt: row.recorded_at, recordedByLabel: recorder || "Authorised employer actor", note: row.note };
}

function deriveAttention(plan: LearningTimePlanView | null, activities: LearningTimeActivityView[], activeBreak: boolean) {
  const attention: LearningTimeLearnerView["attention"] = [];
  if (!plan) attention.push({ type: "otj_plan_missing", label: "Plan setup required", detail: "Configure and publish the agreed learning-time plan." });
  if (activities.some((activity) => activity.status === "needs_information")) attention.push({ type: "otj_activity_needs_information", label: "More information required", detail: "A submitted activity needs learner clarification." });
  if (activities.some((activity) => activity.status === "submitted")) attention.push({ type: "otj_submission_awaiting_employer_check", label: "Submission awaiting check", detail: "Candidate evidence is ready for employer review." });
  if (activities.some((activity) => activity.status === "employer_checked" && !activity.confirmation)) attention.push({ type: "otj_provider_confirmation_pending", label: "Provider confirmation pending", detail: "Employer-checked candidate time has no attributable provider confirmation." });
  if (activities.some((activity) => activity.workingHoursBasis === "not_confirmed" || ["paid_exception", "time_off_in_lieu_exception"].includes(activity.workingHoursBasis))) attention.push({ type: "otj_working_hours_clarification", label: "Working-hours clarification required", detail: "Check the paid-hours basis and any documented exception." });
  if (!activeBreak && plan) {
    const submittedDates = activities.filter((activity) => activity.status !== "draft" && activity.status !== "withdrawn").map((activity) => activity.activityDate).sort().reverse();
    const referenceDate = submittedDates[0] ?? plan.practicalPeriodStartDate;
    if (daysSince(referenceDate) > plan.inactivityAttentionDays) attention.push({ type: "otj_no_recent_activity", label: "Learning activity recently absent", detail: `No submitted activity is recorded within the configured ${plan.inactivityAttentionDays}-day review threshold.` });
  }
  return attention;
}

function latestConfirmations(rows: ConfirmationRow[]) {
  const result = new Map<string, ConfirmationRow>();
  [...rows].sort((left, right) => left.recorded_at.localeCompare(right.recorded_at)).forEach((row) => result.set(row.activity_id, row));
  return result;
}

async function selectByLearners<T>(table: string, organisationId: string, learnerIds: string[], select: string) {
  if (!learnerIds.length) return [];
  const config = requireConfig();
  return supabaseSelect<T>(config, table, new URLSearchParams({ select, organisation_id: `eq.${organisationId}`, learner_record_id: inFilter(learnerIds), limit: "5000" }));
}

async function selectByIds<T>(table: string, field: string, ids: string[], select: string, organisationId?: string) {
  if (!ids.length) return [];
  const config = requireConfig();
  const query = new URLSearchParams({ select, [field]: inFilter([...new Set(ids)]), limit: "5000" });
  if (organisationId) query.set("organisation_id", `eq.${organisationId}`);
  return supabaseSelect<T>(config, table, query);
}

async function rpc<T>(name: string, body: Record<string, unknown>) {
  const result = await supabaseFetchJson<T[]>(requireConfig(), `rpc/${name}`, { method: "POST", body: JSON.stringify(body) });
  return result[0] ?? null;
}

function assertPlanManager(role: string) {
  const normalised = normaliseMvpUserRole(role);
  if (normalised !== "Apprenticeship Lead" && normalised !== "Employer Admin") throw new LevyTateLearningTimeError("Learning-time plan management requires an authorised employer role.", 403);
}

function requireConfig() {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new LevyTateLearningTimeError("Learning Time storage is not configured.", 503);
  return config;
}

function inFilter(values: string[]) { return `in.(${values.map((value) => value.replace(/[^a-zA-Z0-9_-]/g, "")).filter(Boolean).join(",")})`; }
function stringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 50) : []; }
function bounded(value: string, maximum: number) { return String(value ?? "").trim().slice(0, maximum); }
function boundedRequired(value: string, maximum: number, label: string) { const clean = bounded(value, maximum); if (!clean) throw new LevyTateLearningTimeError(`${label} is required.`); return clean; }
function boundedStringArray(value: string[] | undefined, maximumItems: number, maximumLength: number) { return (value ?? []).filter((item) => typeof item === "string").map((item) => bounded(item, maximumLength)).filter(Boolean).slice(0, maximumItems); }
function idempotency(value: string) { const clean = String(value ?? "").trim(); if (!/^[a-zA-Z0-9:_-]{8,128}$/.test(clean)) throw new LevyTateLearningTimeError("A valid idempotency key is required."); return clean; }
function timesOverlap(start: string, end: string, otherStart: string, otherEnd: string) { return start < otherEnd.slice(0, 5) && end > otherStart.slice(0, 5); }
function daysSince(date: string) { const start = Date.parse(`${date}T00:00:00Z`); return Number.isFinite(start) ? Math.floor((Date.now() - start) / 86_400_000) : 0; }
function assertIsoDate(value: string, label: string) { const parsed = new Date(`${value}T00:00:00Z`); if (!isoDatePattern.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new LevyTateLearningTimeError(`${label} must be a valid date.`); }
function assertActivityInput(input: LearningTimeActivityInput) {
  assertIsoDate(input.activityDate, "Activity date");
  if (!activityCategories.has(input.category)) throw new LevyTateLearningTimeError("A valid learning activity category is required.");
  if (!workingHoursBases.has(input.workingHoursBasis)) throw new LevyTateLearningTimeError("A valid working-hours basis is required.");
  if (!Number.isInteger(input.breakMinutes) || input.breakMinutes < 0) throw new LevyTateLearningTimeError("Break minutes must be a non-negative whole number.");
  if (deriveActivityDurationMinutes(input.startedAt, input.endedAt, input.breakMinutes) <= 0) throw new LevyTateLearningTimeError("Activity start, end and break times must produce a positive duration.");
  if (input.separateFromProductiveWork !== null && typeof input.separateFromProductiveWork !== "boolean") throw new LevyTateLearningTimeError("Confirm whether the activity was separate from productive work.");
}

const activitySelect = "id,learner_record_id,plan_version_id,activity_date,started_at,ended_at,break_minutes,duration_minutes,timezone,category,title,description,what_was_new,standard_relevance,reflection,working_hours_basis,compensation_note,separate_from_productive_work,ksb_references,evidence_reference,deterministic_outcome,deterministic_reasons,status,created_by_user_id,submitted_at,lock_version,created_at,updated_at";
const planVersionSelect = "id,plan_id,version_number,policy_regime,original_apprenticeship_start_date,practical_period_start_date,practical_period_end_date,standard_id,standard_version,published_standard_minimum_minutes,legacy_indicative_minimum_minutes,prior_learning_reduction_minutes,individual_minimum_minutes,planned_delivery_minutes,provider_id,training_plan_reference,source_type,source_date,inactivity_attention_days,notes,status,published_at,created_at";
const prioritySelect = "id,learner_record_id,plan_version_id,label,description,ksb_references,source_type,source_reference,target_date,status";
const confirmationSelect = "id,activity_id,outcome,confirmed_minutes,confirmation_source_type,provider_id,source_reference,source_date,recorded_by,recorded_at,note";
