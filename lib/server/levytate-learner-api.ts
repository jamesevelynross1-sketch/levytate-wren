import { NextResponse } from "next/server";
import {
  LevyTateLearnerLifecycleConflictError,
  LevyTateLearnerLifecycleError,
  LevyTateLearnerLifecyclePermissionError,
  LevyTateLearnerLifecycleValidationError,
} from "@/lib/server/levytate-learner-lifecycle";
import { logLevyTateServerError } from "@/lib/server/levytate-safe-api-error";

export function lifecycleErrorResponse(error: unknown) {
  const status = error instanceof LevyTateLearnerLifecyclePermissionError
    ? 403
    : error instanceof LevyTateLearnerLifecycleValidationError
      ? 400
      : error instanceof LevyTateLearnerLifecycleConflictError
        ? 409
        : error instanceof LevyTateLearnerLifecycleError
          ? 404
          : 500;

  if (status === 500) {
    logLevyTateServerError("learner-lifecycle", error);
    return NextResponse.json({ error: "learner_lifecycle_update_failed", message: "The learner record could not be updated. Please try again." }, { status });
  }

  const message = status === 403
    ? "You do not have permission to update this learner record."
    : error instanceof Error
      ? error.message
      : "Learner lifecycle records are temporarily unavailable.";

  return NextResponse.json({ message }, { status });
}
