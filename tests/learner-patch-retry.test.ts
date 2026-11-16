import { describe, expect, it, vi } from "vitest";
import { createPinnedClientMutation } from "@/lib/levytate/client-mutation-retry";

describe("learner PATCH recovery transport", () => {
  it("retains the exact PATCH endpoint, revision, body and original identity after a committed response is lost", async () => {
    const calls: Array<{path: string; method: string | undefined; body: string; identity: unknown}> = [];
    const confirmed = vi.fn(), original = { email: "fictional@example.invalid", organisationId: "tenant-a" };
    const input = { expectedActivityVersion: "original-version", note: "Original evidence" };
    const fetcher = vi.fn(async (path: string, init?: RequestInit, identity?: { email: string; organisationId: string }) => {
      calls.push({ path, method: init?.method, body: String(init?.body), identity });
      if (calls.length === 1) throw new TypeError("Connection lost after persistence");
      return Response.json({ confirmed: true });
    });
    const mutation = createPinnedClientMutation(original, "/api/levytate-learners/fictional/pre-enrolment", value => value, fetcher, undefined, "PATCH");
    await expect(mutation.execute(input, confirmed)).rejects.toThrow();
    input.note = "Changed later"; original.email = "replacement@example.invalid";
    await expect(mutation.execute(input)).rejects.toThrow("original update");
    await mutation.retry();
    expect(calls).toHaveLength(2); expect(calls[1]).toEqual(calls[0]);
    expect(calls[1]).toMatchObject({ method: "PATCH", identity: { email: "fictional@example.invalid", organisationId: "tenant-a" } });
    expect(JSON.parse(calls[1].body)).toEqual({ expectedActivityVersion: "original-version", note: "Original evidence" });
    expect(confirmed).toHaveBeenCalledTimes(1); expect(mutation.pending).toBe(false);
  });
});
