export function applyLocalTraceSafety(env: Record<string, string | undefined>): {
  requestTraceRecordingDisabled: true;
  traceUploadDisabled: true;
  telemetryDisabled: true;
};
