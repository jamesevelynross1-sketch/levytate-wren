import { describe, expect, it } from "vitest";
import { applyLocalTraceSafety } from "../scripts/release-local-trace-safety.mjs";
describe("local acceptance trace safety", () => {
  it("sets actual child flags before launch without changing session or rate secrets", () => {
    const env: Record<string,string|undefined> = { LEVYTATE_BETA_SESSION_SECRET:"synthetic-secret",LEVYTATE_AUTH_RATE_LIMIT_SECRET:"synthetic-rate",NEXT_TRACE_SPAN_THRESHOLD_MS:"0",NEXT_TELEMETRY_DISABLED:"0",NEXT_TRACE_UPLOAD_DISABLED:"0" };
    expect(applyLocalTraceSafety(env)).toEqual({requestTraceRecordingDisabled:true,traceUploadDisabled:true,telemetryDisabled:true});
    expect(env).toMatchObject({LEVYTATE_BETA_SESSION_SECRET:"synthetic-secret",LEVYTATE_AUTH_RATE_LIMIT_SECRET:"synthetic-rate",NEXT_TRACE_SPAN_THRESHOLD_MS:"9007199254740991",NEXT_TRACE_UPLOAD_DISABLED:"1",NEXT_TELEMETRY_DISABLED:"1"});
  });
  for (const name of ["NEXT_TRACE_UPLOAD_DEBUG","NEXT_TRACE_UPLOAD_FULL","NEXT_TRACE_UPLOAD_URL"]) it(`rejects inherited ${name} without exposing its value`, () => {
    const env = {[name]:"synthetic-private-value"};
    expect(()=>applyLocalTraceSafety(env)).toThrow("Local acceptance forbids trace-upload configuration");
    expect(env).toEqual({[name]:"synthetic-private-value"});
  });
});
