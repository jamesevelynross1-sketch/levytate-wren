export function logLevyTateServerError(scope: string, _error: unknown) {
  // Provider errors may contain credential-bearing URLs, request bodies, or
  // personal records. Keep a static event, never the error/message/stack/name.
  void _error;
  const safeScope = /^[a-z][a-z-]{0,63}$/.test(scope) ? scope : "server";
  console.error(`[LevyTate:${safeScope}]`, "dependency_failure");
}

export const operationalActionsRefreshError = {
  error: "operational_actions_sync_failed",
  message: "Operational actions could not be refreshed. Please try again.",
} as const;
