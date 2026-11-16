/** Suppress Next development request spans before any local Auth callback. */
export function applyLocalTraceSafety(env) {
  if (Object.entries(env).some(([name, value]) => /^NEXT_TRACE_UPLOAD_/.test(name) && name !== "NEXT_TRACE_UPLOAD_DISABLED" && value)) {
    throw Error("Local acceptance forbids trace-upload configuration");
  }
  env.NEXT_TRACE_SPAN_THRESHOLD_MS = "9007199254740991";
  env.NEXT_TRACE_UPLOAD_DISABLED = "1";
  env.NEXT_TELEMETRY_DISABLED = "1";
  return { requestTraceRecordingDisabled: true, traceUploadDisabled: true, telemetryDisabled: true };
}
