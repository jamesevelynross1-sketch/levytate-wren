export function logLevyTateServerError(scope: string, error: unknown) {
  console.error(`[LevyTate:${scope}]`, error);
}

export const operationalActionsRefreshError = {
  error: "operational_actions_sync_failed",
  message: "Operational actions could not be refreshed. Please try again.",
} as const;
