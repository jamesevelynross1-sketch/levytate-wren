import type { ClientIdentity } from "@/lib/levytate/client-session";
import type { LearnerRecordDetail } from "@/lib/levytate/mvp/learner-record-view";

/** Do not confirm a retained personal form with another account's learner data. */
export function decodeEmployeeDeclarationResponse(value: unknown, identity: ClientIdentity, learnerId: string, requireConfirmation = false): LearnerRecordDetail {
  const invalid = () => new Error("Your declaration could not be confirmed for this account. Reload saved state before making another change.");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  const result = value as Record<string, unknown>;
  if (result.ok !== true || result.organisationId !== identity.organisationId || !result.learner || typeof result.learner !== "object" || Array.isArray(result.learner)) throw invalid();
  const detail = result.learner as LearnerRecordDetail;
  if (detail.learnerRecordId !== learnerId || typeof detail.updatedAt !== "string" || !detail.updatedAt
    || typeof detail.learner?.email !== "string" || detail.learner.email.trim().toLowerCase() !== identity.email.trim().toLowerCase()) throw invalid();
  const declaration = detail.eligibilityDeclaration;
  if (declaration && (declaration.organisationId !== identity.organisationId || declaration.learnerRecordId !== learnerId
    || (declaration.confirmed && declaration.confirmedByEmployee !== detail.learner.id))) throw invalid();
  if (requireConfirmation && (declaration?.confirmed !== true || !["employee_confirmed", "employer_verified"].includes(declaration.verificationStatus))) throw invalid();
  return detail;
}
