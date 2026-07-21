import { NextResponse } from "next/server";
import { LevyTateLearnerLifecyclePermissionError } from "@/lib/server/levytate-learner-lifecycle";
import { LevyTateManagerScopeError } from "@/lib/server/levytate-manager-scope";
import {
  LevyTateManagerOperationalActionAccessError,
  LevyTateOperationalActionConflictError,
  LevyTateOperationalActionError,
} from "@/lib/server/levytate-operational-actions";
import { logLevyTateServerError } from "@/lib/server/levytate-safe-api-error";

export function managerActionErrorResponse(context: string, error: unknown) {
  if (error instanceof LevyTateManagerOperationalActionAccessError
    || error instanceof LevyTateManagerScopeError
    || error instanceof LevyTateLearnerLifecyclePermissionError) {
    return NextResponse.json({ message: "This action is not available in your current direct-report scope." }, { status: 403 });
  }
  if (error instanceof LevyTateOperationalActionConflictError) {
    return NextResponse.json({ message: "This action was updated by someone else. Refresh to view the latest status." }, { status: 409 });
  }
  if (error instanceof LevyTateOperationalActionError) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
  logLevyTateServerError(context, error);
  return NextResponse.json({ error: "manager_action_failed", message: "The action could not be updated. Please try again." }, { status: 500 });
}
