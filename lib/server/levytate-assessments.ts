import { randomUUID } from "node:crypto";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import type {
  AssessmentAction,
  AssessmentCampaignView,
  AssessmentReviewView,
  AssessmentView,
  AssessmentWorkspace,
} from "@/lib/levytate/assessments/api";
import {
  aggregateAssessmentResults,
  interpretWorkforceAssessment,
  validateAssessmentAnswers,
  type AssessmentAnswerMap,
  type WorkforceAssessmentResult,
} from "@/lib/levytate/assessments/domain";
import {
  assessmentFrameworkDisclosure,
  workforceAssessmentFrameworkKey,
  workforceAssessmentInterpretationVersion,
  workforceAssessmentQuestionnaireVersion,
  workforceAssessmentQuestions,
} from "@/lib/levytate/assessments/framework";
import { normaliseMvpUserRole, type MvpUserRole } from "@/lib/levytate/mvp/rbac";
import type { MvpApplication } from "@/lib/levytate/mvp/workspace";
import { getLearnerLifecycleServerContext } from "@/lib/server/levytate-learner-lifecycle";
import {
  getLevyTateSupabaseConfig,
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
} from "@/lib/server/levytate-supabase";
import { applyWorkspaceMutationForSession } from "@/lib/server/levytate-workspace";

type EmployeeRow = { id: string; name: string; email: string; job_title: string; department: string; manager_id: string; status: string };
type CampaignRow = {
  id: string; title: string; purpose: string; business_objectives: unknown; departments: unknown; status: AssessmentCampaignView["status"];
  questionnaire_version: string; interpretation_version: string; owner_user_id: string; closing_date: string | null;
  sharing_policy: AssessmentCampaignView["sharingPolicy"]; created_at: string;
};
type ParticipantRow = { id: string; campaign_id: string; employee_id: string; employee_name_snapshot: string; department_snapshot: string; role_title_snapshot: string; audience_change_type: string };
type AssessmentRow = {
  id: string; employee_id: string; campaign_id: string | null; status: AssessmentView["status"]; visibility: AssessmentView["visibility"];
  questionnaire_version: string; interpretation_version: string; questionnaire_snapshot: unknown; role_context: string;
  current_revision: number; active_submission_revision: number | null; baseline_assessment_id: string | null; created_at: string; updated_at: string;
};
type RevisionRow = { id: string; assessment_id: string; revision_number: number; status: "draft" | "submitted" | "superseded"; answers: unknown; role_context: string; submitted_at: string | null; updated_at: string };
type ResultRow = { assessment_id: string; revision_number: number; result_snapshot: unknown; created_at: string };
type ShareRow = { assessment_id: string; shared_with: string; shared_with_employee_id: string; active: boolean; shared_at: string };
type ReviewRow = {
  id: string; assessment_id: string; status: AssessmentReviewView["status"]; business_context: string; support_available: string;
  constraints: string; recommended_action: string; manager_comment: string; reviewed_at: string;
};
type LinkRow = { assessment_id: string; application_id: string; created_at: string };
type UserRow = { id: string; display_name: string; email: string };

export class LevyTateAssessmentError extends Error {
  constructor(message: string, public readonly status: 400 | 403 | 404 | 409 | 413 | 503 = 400) {
    super(message);
    this.name = "LevyTateAssessmentError";
  }
}

const tables = {
  campaigns: "levytate_assessment_campaigns",
  participants: "levytate_assessment_participants",
  assessments: "levytate_workforce_assessments",
  revisions: "levytate_assessment_revisions",
  results: "levytate_assessment_results",
  shares: "levytate_assessment_shares",
  reviews: "levytate_assessment_reviews",
  actions: "levytate_assessment_actions",
  links: "levytate_assessment_application_links",
  events: "levytate_assessment_events",
} as const;

export async function getAssessmentWorkspaceForSession(session: LevyTateBetaSession): Promise<AssessmentWorkspace> {
  const context = await getLearnerLifecycleServerContext(session);
  const role = normaliseMvpUserRole(context.user.role);
  if (role === "Platform Admin") throw new LevyTateAssessmentError("Platform Admin cannot access employer assessment records.", 403);
  const config = requireConfig();
  const employees = await supabaseSelect<EmployeeRow>(config, "levytate_employees", new URLSearchParams({
    select: "id,name,email,job_title,department,manager_id,status",
    organisation_id: `eq.${context.organisation.id}`,
    status: "eq.Active",
    order: "name.asc",
    limit: "1000",
  }));
  const currentEmployee = employees.find((employee) => employee.email.trim().toLowerCase() === context.user.email.trim().toLowerCase()) ?? null;
  if ((role === "Employee" || role === "Line Manager") && !currentEmployee) {
    throw new LevyTateAssessmentError("Your user account is not linked to an active employee record.", 403);
  }

  const allCampaigns = await selectRows<CampaignRow>(tables.campaigns, context.organisation.id, { order: "created_at.desc" });
  const allParticipants = await selectRows<ParticipantRow>(tables.participants, context.organisation.id, { order: "created_at.asc" });
  const directReportIds = new Set(role === "Line Manager" && currentEmployee ? employees.filter((employee) => employee.manager_id === currentEmployee.id).map((employee) => employee.id) : []);
  const visibleCampaignIds = role === "Employee" && currentEmployee
    ? new Set(allParticipants.filter((participant) => participant.employee_id === currentEmployee.id).map((participant) => participant.campaign_id))
    : role === "Line Manager"
      ? new Set(allParticipants.filter((participant) => directReportIds.has(participant.employee_id)).map((participant) => participant.campaign_id))
      : new Set(allCampaigns.map((campaign) => campaign.id));
  const campaigns = allCampaigns.filter((campaign) => visibleCampaignIds.has(campaign.id) || role === "Apprenticeship Lead" || role === "Employer Admin");

  const allAssessments = await selectRows<AssessmentRow>(tables.assessments, context.organisation.id, { order: "updated_at.desc" });
  const allShares = role === "Line Manager"
    ? await selectByIds<ShareRow>(tables.shares, context.organisation.id, "assessment_id", allAssessments.map((assessment) => assessment.id))
    : [];
  const visibleAssessments = allAssessments.filter((assessment) => {
    if (role === "Employee") return assessment.employee_id === currentEmployee?.id;
    if (role === "Line Manager") {
      if (!directReportIds.has(assessment.employee_id)) return false;
      if (assessment.visibility === "manager_shared") return allShares.some((share) => share.assessment_id === assessment.id && share.shared_with_employee_id === currentEmployee?.id && share.active);
      const campaign = assessment.campaign_id ? allCampaigns.find((item) => item.id === assessment.campaign_id) : null;
      return assessment.visibility === "campaign_shared" && campaign?.sharing_policy === "manager_and_campaign_owner";
    }
    return assessment.visibility === "campaign_shared";
  });
  const assessmentIds = visibleAssessments.map((assessment) => assessment.id);
  const [revisions, results, shares, reviews, links, ownerRows] = await Promise.all([
    selectByIds<RevisionRow>(tables.revisions, context.organisation.id, "assessment_id", assessmentIds),
    selectByIds<ResultRow>(tables.results, context.organisation.id, "assessment_id", assessmentIds),
    role === "Line Manager" ? Promise.resolve(allShares.filter((share) => assessmentIds.includes(share.assessment_id))) : selectByIds<ShareRow>(tables.shares, context.organisation.id, "assessment_id", assessmentIds),
    selectByIds<ReviewRow>(tables.reviews, context.organisation.id, "assessment_id", assessmentIds),
    selectByIds<LinkRow>(tables.links, context.organisation.id, "assessment_id", assessmentIds),
    selectByIds<UserRow>("levytate_users", context.organisation.id, "id", campaigns.map((campaign) => campaign.owner_user_id), "id,display_name,email"),
  ]);
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const campaignById = new Map(allCampaigns.map((campaign) => [campaign.id, campaign]));
  const assessments = visibleAssessments.map<AssessmentView>((assessment) => {
    const employee = employeeById.get(assessment.employee_id);
    const visibleRevisionNumber = role === "Employee" ? assessment.current_revision : assessment.active_submission_revision;
    const revision = revisions.find((item) => item.assessment_id === assessment.id && item.revision_number === visibleRevisionNumber);
    const result = results.find((item) => item.assessment_id === assessment.id && item.revision_number === assessment.active_submission_revision);
    const review = [...reviews].filter((item) => item.assessment_id === assessment.id).sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at))[0];
    return {
      id: assessment.id,
      employeeId: assessment.employee_id,
      employeeName: employee?.name ?? "Employee",
      department: employee?.department ?? "",
      roleTitle: employee?.job_title ?? assessment.role_context,
      campaignId: assessment.campaign_id,
      campaignTitle: assessment.campaign_id ? campaignById.get(assessment.campaign_id)?.title ?? "Campaign" : null,
      status: assessment.status,
      visibility: assessment.visibility,
      currentRevision: assessment.current_revision,
      activeSubmittedRevision: assessment.active_submission_revision,
      answers: object<AssessmentAnswerMap>(revision?.answers),
      result: result ? object<WorkforceAssessmentResult>(result.result_snapshot) : null,
      sharedWithManager: shares.some((share) => share.assessment_id === assessment.id && share.shared_with === "line_manager" && share.active),
      review: review ? reviewView(review) : null,
      applicationId: links.find((link) => link.assessment_id === assessment.id)?.application_id ?? null,
      updatedAt: assessment.updated_at,
    };
  });

  const ownerById = new Map(ownerRows.map((owner) => [owner.id, owner.display_name || owner.email]));
  const campaignViews = campaigns.map<AssessmentCampaignView>((campaign) => {
    const participants = allParticipants.filter((participant) => participant.campaign_id === campaign.id && participant.audience_change_type !== "removed" && (
      role === "Employee" ? participant.employee_id === currentEmployee?.id : role === "Line Manager" ? directReportIds.has(participant.employee_id) : true
    ));
    const submitted = visibleAssessments.filter((assessment) => assessment.campaign_id === campaign.id && assessment.active_submission_revision !== null).length;
    return {
      id: campaign.id,
      title: campaign.title,
      purpose: campaign.purpose,
      businessObjectives: strings(campaign.business_objectives),
      departments: strings(campaign.departments),
      status: campaign.status,
      closingDate: campaign.closing_date,
      ownerName: ownerById.get(campaign.owner_user_id) ?? "Campaign owner",
      sharingPolicy: campaign.sharing_policy,
      invited: participants.length,
      submitted,
      participationPercent: participants.length ? Math.round((submitted / participants.length) * 100) : 0,
      participantEmployeeIds: participants.map((participant) => participant.employee_id),
      createdAt: campaign.created_at,
    };
  });
  const reporting = role === "Apprenticeship Lead" || role === "Employer Admin" || role === "Line Manager"
    ? campaignViews.map((campaign) => ({
        campaignId: campaign.id,
        ...aggregateAssessmentResults({
          invited: campaign.participantEmployeeIds,
          submissions: assessments.filter((assessment) => assessment.campaignId === campaign.id && assessment.result).map((assessment) => ({
            employeeId: assessment.employeeId,
            department: assessment.department,
            roleTitle: assessment.roleTitle,
            result: assessment.result!,
          })),
        }),
      }))
    : [];

  return {
    generatedAt: new Date().toISOString(),
    role,
    currentEmployeeId: currentEmployee?.id ?? null,
    questions: [...workforceAssessmentQuestions],
    questionnaireVersion: workforceAssessmentQuestionnaireVersion,
    interpretationVersion: workforceAssessmentInterpretationVersion,
    disclosure: assessmentFrameworkDisclosure,
    assessments,
    campaigns: campaignViews,
    availableEmployees: (role === "Apprenticeship Lead" || role === "Employer Admin" ? employees : employees.filter((employee) => directReportIds.has(employee.id))).map((employee) => ({ id: employee.id, name: employee.name, department: employee.department, jobTitle: employee.job_title })),
    reporting,
  };
}

export async function applyAssessmentActionForSession(session: LevyTateBetaSession, input: unknown) {
  const action = parseAction(input);
  const context = await getLearnerLifecycleServerContext(session);
  const role = normaliseMvpUserRole(context.user.role);
  if (role === "Platform Admin") throw new LevyTateAssessmentError("Platform Admin cannot perform employer assessment actions.", 403);
  const config = requireConfig();
  const duplicate = await supabaseSelect<{ id: string }>(config, tables.events, new URLSearchParams({
    select: "id", organisation_id: `eq.${context.organisation.id}`, actor_user_id: `eq.${context.user.id}`,
    idempotency_key: `eq.${action.idempotencyKey}`, limit: "1",
  }));
  if (duplicate.length) return getAssessmentWorkspaceForSession(session);

  const employee = await currentEmployee(context.organisation.id, context.user.email);
  switch (action.action) {
    case "start_assessment": {
      assertRole(role, ["Employee"]);
      if (!employee) throw new LevyTateAssessmentError("Your active employee record could not be found.", 403);
      const campaignId = action.campaignId || null;
      if (campaignId) await assertCampaignAssignment(context.organisation.id, campaignId, employee.id, true);
      const query: Record<string, string> = { employee_id: `eq.${employee.id}`, campaign_id: campaignId ? `eq.${campaignId}` : "is.null", limit: "1" };
      const existing = await selectRows<AssessmentRow>(tables.assessments, context.organisation.id, query);
      if (!existing.length) {
        const assessmentId = randomUUID();
        await supabaseInsert(config, tables.assessments, [{
          id: assessmentId, organisation_id: context.organisation.id, employee_id: employee.id, campaign_id: campaignId,
          framework_key: workforceAssessmentFrameworkKey, questionnaire_version: workforceAssessmentQuestionnaireVersion,
          interpretation_version: workforceAssessmentInterpretationVersion, questionnaire_snapshot: workforceAssessmentQuestions,
          role_context: employee.job_title, status: "draft", visibility: "private", current_revision: 1,
          active_submission_revision: null, baseline_assessment_id: null, created_by: context.user.id,
        }]);
        await supabaseInsert(config, tables.revisions, [{
          id: randomUUID(), organisation_id: context.organisation.id, assessment_id: assessmentId, revision_number: 1,
          status: "draft", answers: {}, role_context: employee.job_title, created_by: context.user.id,
        }]);
        await recordEvent(context, action, assessmentId, campaignId, "assessment.started");
      } else await recordEvent(context, action, existing[0].id, campaignId, "assessment.start_retried");
      break;
    }
    case "start_reassessment": {
      assertRole(role, ["Employee"]);
      if (!employee) throw new LevyTateAssessmentError("Your active employee record could not be found.", 403);
      const baseline = await ownAssessment(context.organisation.id, action.baselineAssessmentId, employee.id);
      if (!baseline.active_submission_revision) throw new LevyTateAssessmentError("Only a submitted assessment can be used as a baseline.", 409);
      const existing = (await selectRows<AssessmentRow>(tables.assessments, context.organisation.id, { baseline_assessment_id: `eq.${baseline.id}`, status: "eq.draft", limit: "1" }))[0];
      if (!existing) {
        const assessmentId = randomUUID();
        await supabaseInsert(config, tables.assessments, [{
          id: assessmentId, organisation_id: context.organisation.id, employee_id: employee.id, campaign_id: null,
          framework_key: workforceAssessmentFrameworkKey, questionnaire_version: workforceAssessmentQuestionnaireVersion,
          interpretation_version: workforceAssessmentInterpretationVersion, questionnaire_snapshot: workforceAssessmentQuestions,
          role_context: employee.job_title, status: "draft", visibility: "private", current_revision: 1,
          active_submission_revision: null, baseline_assessment_id: baseline.id, created_by: context.user.id,
        }]);
        await supabaseInsert(config, tables.revisions, [{
          id: randomUUID(), organisation_id: context.organisation.id, assessment_id: assessmentId, revision_number: 1,
          status: "draft", answers: {}, role_context: employee.job_title, created_by: context.user.id,
        }]);
        await recordEvent(context, action, assessmentId, null, "assessment.reassessment_started");
      } else await recordEvent(context, action, existing.id, null, "assessment.reassessment_retried");
      break;
    }
    case "save_answers": {
      assertRole(role, ["Employee"]);
      const assessment = await ownAssessment(context.organisation.id, action.assessmentId, employee?.id);
      const current = await revision(context.organisation.id, assessment.id, assessment.current_revision);
      let revisionNumber = assessment.current_revision;
      if (current.status !== "draft") {
        revisionNumber += 1;
        await supabaseInsert(config, tables.revisions, [{
          id: randomUUID(), organisation_id: context.organisation.id, assessment_id: assessment.id, revision_number: revisionNumber,
          status: "draft", answers: sanitiseAnswers(action.answers), role_context: bounded(action.roleContext || assessment.role_context, 300), created_by: context.user.id,
        }]);
      } else {
        await supabaseUpdate(config, tables.revisions, scope(context.organisation.id, { assessment_id: assessment.id, revision_number: revisionNumber }), {
          answers: sanitiseAnswers(action.answers), role_context: bounded(action.roleContext || current.role_context, 300), updated_at: new Date().toISOString(),
        });
      }
      await supabaseUpdate(config, tables.assessments, scope(context.organisation.id, { id: assessment.id }), {
        current_revision: revisionNumber, role_context: bounded(action.roleContext || assessment.role_context, 300), status: "draft", updated_at: new Date().toISOString(),
      });
      await recordEvent(context, action, assessment.id, assessment.campaign_id, "assessment.draft_saved");
      break;
    }
    case "submit": {
      assertRole(role, ["Employee"]);
      const assessment = await ownAssessment(context.organisation.id, action.assessmentId, employee?.id);
      if (assessment.campaign_id) await assertCampaignAssignment(context.organisation.id, assessment.campaign_id, assessment.employee_id, true);
      const current = await revision(context.organisation.id, assessment.id, assessment.current_revision);
      if (current.status === "submitted" && assessment.active_submission_revision === current.revision_number) {
        await recordEvent(context, action, assessment.id, assessment.campaign_id, "assessment.submit_retried");
        break;
      }
      const answers = object<AssessmentAnswerMap>(current.answers);
      const validation = validateAssessmentAnswers(answers);
      if (!validation.valid) throw new LevyTateAssessmentError(validation.message, 400);
      const result = interpretWorkforceAssessment(answers);
      const submittedAt = new Date().toISOString();
      await supabaseUpdate(config, tables.revisions, scope(context.organisation.id, { assessment_id: assessment.id, revision_number: current.revision_number }), { status: "submitted", submitted_at: submittedAt, updated_at: submittedAt });
      await supabaseInsert(config, tables.results, [{ id: randomUUID(), organisation_id: context.organisation.id, assessment_id: assessment.id, revision_number: current.revision_number, result_snapshot: result, interpretation_version: workforceAssessmentInterpretationVersion, created_by: context.user.id }], { prefer: "resolution=ignore-duplicates,return=representation", query: "on_conflict=organisation_id,assessment_id,revision_number" });
      await supabaseUpdate(config, tables.assessments, scope(context.organisation.id, { id: assessment.id }), {
        active_submission_revision: current.revision_number,
        status: "submitted",
        visibility: assessment.campaign_id ? "campaign_shared" : assessment.visibility,
        submitted_at: submittedAt,
        updated_at: submittedAt,
      });
      await recordEvent(context, action, assessment.id, assessment.campaign_id, "assessment.submitted");
      break;
    }
    case "share_with_manager": {
      assertRole(role, ["Employee"]);
      const assessment = await ownAssessment(context.organisation.id, action.assessmentId, employee?.id);
      if (!assessment.active_submission_revision) throw new LevyTateAssessmentError("Submit the assessment before sharing findings.", 409);
      if (!employee?.manager_id) throw new LevyTateAssessmentError("No active line manager is linked to this employee.", 409);
      await supabaseInsert(config, tables.shares, [{ id: randomUUID(), organisation_id: context.organisation.id, assessment_id: assessment.id, shared_with: "line_manager", shared_with_employee_id: employee.manager_id, active: true, shared_by: context.user.id }], { prefer: "resolution=merge-duplicates,return=representation", query: "on_conflict=organisation_id,assessment_id,shared_with" });
      await supabaseUpdate(config, tables.assessments, scope(context.organisation.id, { id: assessment.id }), { visibility: "manager_shared", updated_at: new Date().toISOString() });
      await recordEvent(context, action, assessment.id, assessment.campaign_id, "assessment.shared_with_manager");
      break;
    }
    case "create_campaign": {
      assertRole(role, ["Apprenticeship Lead", "Employer Admin"]);
      const employees = await activeEmployees(context.organisation.id);
      const chosen = employees.filter((item) => action.employeeIds.includes(item.id));
      if (!chosen.length || chosen.length !== new Set(action.employeeIds).size) throw new LevyTateAssessmentError("Select only active employees in this organisation.", 400);
      const campaignId = randomUUID();
      await supabaseInsert(config, tables.campaigns, [{
        id: campaignId, organisation_id: context.organisation.id, title: boundedRequired(action.title, 180, "Campaign title"),
        purpose: boundedRequired(action.purpose, 2000, "Campaign purpose"), business_objectives: boundedArray(action.businessObjectives, 10, 300),
        departments: boundedArray(action.departments, 50, 120), framework_key: workforceAssessmentFrameworkKey,
        questionnaire_version: workforceAssessmentQuestionnaireVersion, interpretation_version: workforceAssessmentInterpretationVersion,
        owner_user_id: context.user.id, closing_date: action.closingDate || null, sharing_policy: action.sharingPolicy, status: "draft",
      }]);
      await supabaseInsert(config, tables.participants, chosen.map((item) => ({
        id: randomUUID(), organisation_id: context.organisation.id, campaign_id: campaignId, employee_id: item.id,
        employee_name_snapshot: item.name, department_snapshot: item.department, role_title_snapshot: item.job_title,
        audience_change_type: "initial", recorded_by: context.user.id,
      })));
      await recordEvent(context, action, null, campaignId, "campaign.created");
      break;
    }
    case "open_campaign":
    case "close_campaign":
    case "reopen_campaign": {
      assertRole(role, ["Apprenticeship Lead", "Employer Admin"]);
      const campaign = await campaignRecord(context.organisation.id, action.campaignId);
      const next = action.action === "close_campaign" ? "closed" : "open";
      if (action.action === "open_campaign" && campaign.status !== "draft") throw new LevyTateAssessmentError("Only a draft campaign can be opened.", 409);
      if (action.action === "close_campaign" && campaign.status !== "open") throw new LevyTateAssessmentError("Only an open campaign can be closed.", 409);
      if (action.action === "reopen_campaign" && campaign.status !== "closed") throw new LevyTateAssessmentError("Only a closed campaign can be reopened.", 409);
      await supabaseUpdate(config, tables.campaigns, scope(context.organisation.id, { id: campaign.id }), { status: next, updated_at: new Date().toISOString(), ...(next === "closed" ? { closed_at: new Date().toISOString() } : { closed_at: null }) });
      await recordEvent(context, action, null, campaign.id, `campaign.${next}`);
      break;
    }
    case "review": {
      assertRole(role, ["Line Manager", "Apprenticeship Lead", "Employer Admin"]);
      const assessment = await reviewableAssessment(context.organisation.id, action.assessmentId, role, employee);
      if (!assessment.active_submission_revision) throw new LevyTateAssessmentError("Only a submitted assessment can be reviewed.", 409);
      const reviewId = randomUUID();
      await supabaseInsert(config, tables.reviews, [{
        id: reviewId, organisation_id: context.organisation.id, assessment_id: assessment.id,
        submission_revision: assessment.active_submission_revision, reviewer_user_id: context.user.id, reviewer_role: role,
        status: action.status, business_context: bounded(action.businessContext, 3000), support_available: bounded(action.supportAvailable, 3000),
        constraints: bounded(action.constraints, 3000), recommended_action: bounded(action.recommendedAction, 2000),
        manager_comment: boundedRequired(action.managerComment, 3000, "Review comment"),
      }]);
      if (action.recommendedAction.trim()) {
        await supabaseInsert(config, tables.actions, [{
          id: randomUUID(), organisation_id: context.organisation.id, assessment_id: assessment.id, review_id: reviewId,
          action_text: bounded(action.recommendedAction, 2000), owner_user_id: context.user.id, status: "proposed",
        }]);
      }
      await supabaseUpdate(config, tables.assessments, scope(context.organisation.id, { id: assessment.id }), { status: action.status === "clarification_requested" ? "needs_clarification" : "reviewed", updated_at: new Date().toISOString() });
      await recordEvent(context, action, assessment.id, assessment.campaign_id, `assessment.review_${action.status}`);
      break;
    }
    case "create_application_draft": {
      assertRole(role, ["Employee"]);
      const assessment = await ownAssessment(context.organisation.id, action.assessmentId, employee?.id);
      if (!assessment.active_submission_revision) throw new LevyTateAssessmentError("Submit the assessment before preparing an application.", 409);
      const existing = await selectRows<LinkRow>(tables.links, context.organisation.id, { assessment_id: `eq.${assessment.id}`, limit: "1" });
      if (!existing.length) {
        const resultRow = (await selectRows<ResultRow>(tables.results, context.organisation.id, { assessment_id: `eq.${assessment.id}`, revision_number: `eq.${assessment.active_submission_revision}`, limit: "1" }))[0];
        const result = object<WorkforceAssessmentResult>(resultRow?.result_snapshot);
        const applicationId = `assessment-${assessment.id}`;
        const now = new Date().toISOString();
        const application: MvpApplication = {
          id: applicationId,
          employeeId: assessment.employee_id,
          apprenticeshipStandardId: boundedRequired(action.apprenticeshipStandardId, 180, "Apprenticeship standard"),
          status: "Draft",
          currentOwner: "Employee",
          reason: bounded(`Assessment opportunity: ${result.practicalOpportunity || "Development opportunity to discuss."}\nSource assessment: ${assessment.id}`, 3000),
          careerGoal: bounded(result.developmentNeeds?.join("; ") || "Development objective to confirm", 3000),
          supportRequired: bounded(result.workplaceConstraints?.join("; ") || "Support requirements to confirm with manager", 3000),
          managerNote: "Prepared from an employee-approved assessment handoff. Assessment submission did not approve this application.",
          submittedAt: now,
          updatedAt: now,
          history: [{ id: randomUUID(), status: "Draft", owner: "Employee", note: "Employee created a draft from a submitted assessment.", createdAt: now }],
        };
        try {
          await applyWorkspaceMutationForSession(session, { type: "saveApplication", application });
        } catch (error) {
          throw new LevyTateAssessmentError(error instanceof Error ? error.message : "The application draft could not be created.", 409);
        }
        await supabaseInsert(config, tables.links, [{ id: randomUUID(), organisation_id: context.organisation.id, assessment_id: assessment.id, application_id: applicationId, source_revision: assessment.active_submission_revision, created_by: context.user.id, idempotency_key: action.idempotencyKey }], { prefer: "resolution=ignore-duplicates,return=representation", query: "on_conflict=organisation_id,assessment_id" });
      }
      await recordEvent(context, action, assessment.id, assessment.campaign_id, "assessment.application_draft_created");
      break;
    }
  }
  return getAssessmentWorkspaceForSession(session);
}

async function ownAssessment(organisationId: string, assessmentId: string, employeeId?: string) {
  if (!employeeId) throw new LevyTateAssessmentError("Your active employee record could not be found.", 403);
  const row = (await selectRows<AssessmentRow>(tables.assessments, organisationId, { id: `eq.${assessmentId}`, employee_id: `eq.${employeeId}`, limit: "1" }))[0];
  if (!row) throw new LevyTateAssessmentError("Assessment was not found in your scope.", 404);
  return row;
}

async function reviewableAssessment(organisationId: string, assessmentId: string, role: MvpUserRole, manager: EmployeeRow | null) {
  const assessment = (await selectRows<AssessmentRow>(tables.assessments, organisationId, { id: `eq.${assessmentId}`, limit: "1" }))[0];
  if (!assessment) throw new LevyTateAssessmentError("Assessment was not found.", 404);
  if (role === "Line Manager") {
    if (!manager) throw new LevyTateAssessmentError("Your active manager record could not be found.", 403);
    const report = (await selectRows<EmployeeRow>("levytate_employees", organisationId, { id: `eq.${assessment.employee_id}`, manager_id: `eq.${manager.id}`, status: "eq.Active", limit: "1" }))[0];
    if (!report) throw new LevyTateAssessmentError("You cannot review this employee's assessment.", 403);
    if (assessment.visibility === "private") throw new LevyTateAssessmentError("This assessment has not been shared for manager review.", 403);
    if (assessment.visibility === "campaign_shared") {
      const campaign = assessment.campaign_id ? await campaignRecord(organisationId, assessment.campaign_id) : null;
      if (campaign?.sharing_policy !== "manager_and_campaign_owner") throw new LevyTateAssessmentError("This campaign does not disclose individual findings to managers.", 403);
    }
  } else if (assessment.visibility !== "campaign_shared") throw new LevyTateAssessmentError("Private personal assessments are not visible to employer reporting roles.", 403);
  return assessment;
}

async function assertCampaignAssignment(organisationId: string, campaignId: string, employeeId: string, mustBeOpen: boolean) {
  const campaign = await campaignRecord(organisationId, campaignId);
  if (mustBeOpen && campaign.status !== "open") throw new LevyTateAssessmentError("This campaign is not open for submissions.", 409);
  if (campaign.closing_date && campaign.closing_date < new Date().toISOString().slice(0, 10)) throw new LevyTateAssessmentError("This campaign has reached its closing date.", 409);
  const participant = (await selectRows<ParticipantRow>(tables.participants, organisationId, { campaign_id: `eq.${campaignId}`, employee_id: `eq.${employeeId}`, audience_change_type: "neq.removed", limit: "1" }))[0];
  if (!participant) throw new LevyTateAssessmentError("You are not assigned to this campaign.", 403);
}

async function campaignRecord(organisationId: string, campaignId: string) {
  const row = (await selectRows<CampaignRow>(tables.campaigns, organisationId, { id: `eq.${campaignId}`, limit: "1" }))[0];
  if (!row) throw new LevyTateAssessmentError("Campaign was not found.", 404);
  return row;
}

async function revision(organisationId: string, assessmentId: string, revisionNumber: number) {
  const row = (await selectRows<RevisionRow>(tables.revisions, organisationId, { assessment_id: `eq.${assessmentId}`, revision_number: `eq.${revisionNumber}`, limit: "1" }))[0];
  if (!row) throw new LevyTateAssessmentError("Assessment revision was not found.", 404);
  return row;
}

async function currentEmployee(organisationId: string, email: string) {
  return (await selectRows<EmployeeRow>("levytate_employees", organisationId, { email: `eq.${email.trim().toLowerCase()}`, status: "eq.Active", limit: "1" }))[0] ?? null;
}

async function activeEmployees(organisationId: string) {
  return selectRows<EmployeeRow>("levytate_employees", organisationId, { status: "eq.Active", order: "name.asc", limit: "1000" }, "id,name,email,job_title,department,manager_id,status");
}

async function recordEvent(context: Awaited<ReturnType<typeof getLearnerLifecycleServerContext>>, action: AssessmentAction, assessmentId: string | null, campaignId: string | null, eventType: string) {
  await supabaseInsert(requireConfig(), tables.events, [{
    id: randomUUID(), organisation_id: context.organisation.id, assessment_id: assessmentId, campaign_id: campaignId,
    event_type: eventType, actor_user_id: context.user.id, actor_role: normaliseMvpUserRole(context.user.role),
    idempotency_key: action.idempotencyKey, safe_summary: eventType.replace(/[._]/g, " "), metadata: {},
  }], { prefer: "resolution=ignore-duplicates,return=representation", query: "on_conflict=organisation_id,actor_user_id,idempotency_key" });
}

async function selectRows<T>(table: string, organisationId: string, params: Record<string, string>, select = "*") {
  return supabaseSelect<T>(requireConfig(), table, new URLSearchParams({ select, organisation_id: `eq.${organisationId}`, ...params }));
}

async function selectByIds<T>(table: string, organisationId: string, key: string, ids: string[], select = "*") {
  if (!ids.length) return [];
  return selectRows<T>(table, organisationId, { [key]: `in.(${ids.map(encodeURIComponent).join(",")})`, limit: "5000" }, select);
}

function requireConfig() {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new LevyTateAssessmentError("Assessments are temporarily unavailable.", 503);
  return config;
}

function scope(organisationId: string, values: Record<string, string | number>) {
  const params = new URLSearchParams({ organisation_id: `eq.${organisationId}` });
  Object.entries(values).forEach(([key, value]) => params.set(key, `eq.${value}`));
  return params.toString();
}

function parseAction(value: unknown): AssessmentAction {
  if (!value || typeof value !== "object") throw new LevyTateAssessmentError("A valid assessment action is required.");
  const action = value as Record<string, unknown>;
  if (typeof action.action !== "string" || typeof action.idempotencyKey !== "string" || !/^[a-zA-Z0-9:_-]{8,128}$/.test(action.idempotencyKey)) throw new LevyTateAssessmentError("A valid assessment action and idempotency key are required.");
  const allowed = new Set(["start_assessment", "start_reassessment", "save_answers", "submit", "share_with_manager", "create_campaign", "open_campaign", "close_campaign", "reopen_campaign", "review", "create_application_draft"]);
  if (!allowed.has(action.action)) throw new LevyTateAssessmentError("Assessment action is not supported.");
  return value as AssessmentAction;
}

function sanitiseAnswers(value: AssessmentAnswerMap) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new LevyTateAssessmentError("Assessment answers must be an object.");
  const next: AssessmentAnswerMap = {};
  for (const question of workforceAssessmentQuestions) {
    const answer = value[question.id];
    if (answer === null || answer === undefined) next[question.id] = null;
    else if (question.type === "multi_choice") {
      if (!Array.isArray(answer)) throw new LevyTateAssessmentError(`Answer for ${question.id} must be a list.`);
      const allowed = new Set(question.options?.map((option) => option.value) ?? []);
      next[question.id] = [...new Set(answer.filter((item): item is string => typeof item === "string" && allowed.has(item)))].slice(0, 20);
    } else if (question.type === "single_choice") {
      if (typeof answer !== "string" || !question.options?.some((option) => option.value === answer)) throw new LevyTateAssessmentError(`Answer for ${question.id} is invalid.`);
      next[question.id] = answer;
    } else {
      if (typeof answer !== "string") throw new LevyTateAssessmentError(`Answer for ${question.id} must be text.`);
      next[question.id] = bounded(answer, 4000);
    }
  }
  return next;
}

function assertRole(role: MvpUserRole, allowed: MvpUserRole[]) {
  if (!allowed.includes(role)) throw new LevyTateAssessmentError(`${role} cannot perform this assessment action.`, 403);
}

function bounded(value: string, length: number) { return value.trim().slice(0, length); }
function boundedRequired(value: string, length: number, label: string) { const next = bounded(value || "", length); if (!next) throw new LevyTateAssessmentError(`${label} is required.`); return next; }
function boundedArray(value: string[], max: number, length: number) { return [...new Set((Array.isArray(value) ? value : []).filter((item): item is string => typeof item === "string").map((item) => bounded(item, length)).filter(Boolean))].slice(0, max); }
function strings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function object<T>(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as T : {} as T; }
function reviewView(row: ReviewRow): AssessmentReviewView { return { id: row.id, status: row.status, businessContext: row.business_context, supportAvailable: row.support_available, constraints: row.constraints, recommendedAction: row.recommended_action, managerComment: row.manager_comment, reviewedAt: row.reviewed_at }; }
