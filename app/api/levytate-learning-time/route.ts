import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import type { LearningTimeActivityInput } from "@/lib/levytate/off-the-job/api";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { ClientRequestError, readAuthenticatedJson } from "@/lib/server/levytate-request-boundary";
import {
  addLearningTimePriority,
  createLearningTimePlanDraft,
  getLearningTimeWorkspace,
  LevyTateLearningTimeError,
  publishLearningTimePlan,
  recordLearningTimeConfirmation,
  saveLearningTimeActivity,
  submitLearningTimeActivity,
  transitionLearningTimeActivity,
} from "@/lib/server/levytate-off-the-job";

type LearningTimeAction = {
  action?: string;
  activity?: LearningTimeActivityInput;
  activityId?: string;
  lockVersion?: number;
  idempotencyKey?: string;
  transitionAction?: string;
  note?: string;
  outcome?: string;
  confirmedMinutes?: number;
  sourceType?: string;
  providerId?: string;
  sourceReference?: string;
  sourceDate?: string;
  learnerRecordId?: string;
  originalStartDate?: string;
  practicalStartDate?: string;
  practicalEndDate?: string;
  standardId?: string;
  standardVersion?: string;
  priorLearningReductionMinutes?: number;
  individualMinimumMinutes?: number;
  plannedDeliveryMinutes?: number;
  legacyIndicativeMinimumMinutes?: number | null;
  trainingPlanReference?: string;
  inactivityAttentionDays?: number;
  versionId?: string;
  planVersionId?: string;
  label?: string;
  description?: string;
  ksbReferences?: string[];
  targetDate?: string | null;
};

export async function GET() {
  const session = await authorisedSession();
  if (!session) return reply({ message: "Unauthorised." }, 401);
  try {
    return reply(await getLearningTimeWorkspace(session));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const session = await authorisedSession();
  if (!session) return reply({ message: "Unauthorised." }, 401);
  try {
    const body = await readAuthenticatedJson(request, session.email, 48 * 1024) as LearningTimeAction;
    if (body.action === "save_activity" && body.activity) return reply(await saveLearningTimeActivity(session, body.activity), 201);
    if (body.action === "submit_activity" && body.activityId && isNumber(body.lockVersion) && body.idempotencyKey) {
      return reply({ activity: await submitLearningTimeActivity(session, { activityId: body.activityId, lockVersion: body.lockVersion, idempotencyKey: body.idempotencyKey }) });
    }
    if (body.action === "transition_activity" && body.activityId && body.transitionAction && isNumber(body.lockVersion) && body.idempotencyKey) {
      return reply({ activity: await transitionLearningTimeActivity(session, { activityId: body.activityId, action: body.transitionAction, note: body.note ?? "", lockVersion: body.lockVersion, idempotencyKey: body.idempotencyKey }) });
    }
    if (body.action === "record_confirmation" && body.activityId && body.outcome && isNumber(body.confirmedMinutes) && body.providerId && body.sourceReference && body.sourceDate && body.idempotencyKey) {
      return reply({ confirmation: await recordLearningTimeConfirmation(session, {
        activityId: body.activityId, outcome: body.outcome, confirmedMinutes: body.confirmedMinutes,
        sourceType: body.sourceType ?? "provider_report", providerId: body.providerId,
        sourceReference: body.sourceReference, sourceDate: body.sourceDate, note: body.note ?? "",
        idempotencyKey: body.idempotencyKey,
      }) }, 201);
    }
    if (body.action === "create_plan_draft" && body.learnerRecordId && body.originalStartDate && body.practicalStartDate && body.practicalEndDate && body.standardId && body.standardVersion && isNumber(body.priorLearningReductionMinutes) && isNumber(body.individualMinimumMinutes) && isNumber(body.plannedDeliveryMinutes) && body.providerId && body.trainingPlanReference && body.sourceDate) {
      return reply({ version: await createLearningTimePlanDraft(session, {
        learnerRecordId: body.learnerRecordId, originalStartDate: body.originalStartDate,
        practicalStartDate: body.practicalStartDate, practicalEndDate: body.practicalEndDate,
        standardId: body.standardId, standardVersion: body.standardVersion,
        priorLearningReductionMinutes: body.priorLearningReductionMinutes,
        individualMinimumMinutes: body.individualMinimumMinutes, plannedDeliveryMinutes: body.plannedDeliveryMinutes,
        legacyIndicativeMinimumMinutes: body.legacyIndicativeMinimumMinutes, providerId: body.providerId,
        trainingPlanReference: body.trainingPlanReference, sourceType: body.sourceType ?? "provider_training_plan",
        sourceDate: body.sourceDate, inactivityAttentionDays: body.inactivityAttentionDays, notes: body.note,
      }) }, 201);
    }
    if (body.action === "publish_plan" && body.versionId) return reply({ version: await publishLearningTimePlan(session, { versionId: body.versionId }) });
    if (body.action === "add_priority" && body.learnerRecordId && body.planVersionId && body.label && body.sourceReference) {
      return reply({ priority: await addLearningTimePriority(session, {
        learnerRecordId: body.learnerRecordId, planVersionId: body.planVersionId, label: body.label,
        description: body.description ?? "", ksbReferences: body.ksbReferences,
        sourceType: body.sourceType ?? "provider_training_plan", sourceReference: body.sourceReference,
        targetDate: body.targetDate,
      }) }, 201);
    }
    return reply({ message: "Unsupported Learning Time action." }, 400);
  } catch (error) {
    if (error instanceof ClientRequestError) return reply({ message: error.message }, error.status);
    return failure(error);
  }
}

async function authorisedSession() {
  const store = await cookies();
  return readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value);
}

function failure(error: unknown) {
  const status = error instanceof LevyTateLearningTimeError ? error.status : 500;
  if (!(error instanceof LevyTateLearningTimeError)) console.error("Learning Time route failed", error instanceof Error ? error.name : "unknown");
  return reply({ message: error instanceof LevyTateLearningTimeError ? error.message : "Learning Time is temporarily unavailable." }, status);
}

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" } });
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
