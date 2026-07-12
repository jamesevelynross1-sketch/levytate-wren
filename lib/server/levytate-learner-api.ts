import { NextResponse } from "next/server";
import {
  LevyTateLearnerLifecycleConflictError,
  LevyTateLearnerLifecycleError,
  LevyTateLearnerLifecyclePermissionError,
  LevyTateLearnerLifecycleValidationError,
} from "@/lib/server/levytate-learner-lifecycle";

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

  const message = status === 403
    ? "You do not have permission to update this learner record."
    : error instanceof Error
      ? error.message
      : "Learner lifecycle records are temporarily unavailable.";

  return NextResponse.json({ message }, { status });
}
