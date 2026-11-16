import { describe, expect, it, vi } from "vitest";
import { decodeEmployeeDeclarationResponse } from "@/lib/levytate/employee-declaration-response";
import { createPinnedClientMutation } from "@/lib/levytate/client-mutation-retry";
import { createAuthenticatedClientFetch } from "@/lib/levytate/client-session";
const identity = { email: "employee@example.test", organisationId: "fictional-a" };
const learnerId = "fictional-learner";
const response = () => ({ ok: true, organisationId: identity.organisationId, learner: { learnerRecordId: learnerId, updatedAt: "version-1", learner: { id: "employee-record", email: identity.email }, eligibilityDeclaration: { organisationId: identity.organisationId, learnerRecordId: learnerId, confirmed: true, confirmedByEmployee: "employee-record", verificationStatus: "employee_confirmed" } } });
const decode = (value: unknown) => decodeEmployeeDeclarationResponse(value, identity, learnerId, true);
const command = { idempotencyKey: "declaration-original-key", expectedUpdatedAt: "version-1", confirmed: true, expectedEnglandWorkingHoursPercentage: 70 };
describe("personal declaration confirmation and retained request (injected transport)", () => {
  it("accepts only the own learner confirmation and preserves pending employer verification", () => {
    expect(decode(response()).eligibilityDeclaration?.verificationStatus).toBe("employee_confirmed");
    expect(decodeEmployeeDeclarationResponse({ ...response(), learner: { ...response().learner, eligibilityDeclaration: null } }, identity, learnerId).eligibilityDeclaration).toBeNull();
  });
  it.each([
    ["wrong tenant", () => ({ ...response(), organisationId: "fictional-b" })],
    ["wrong learner", () => ({ ...response(), learner: { ...response().learner, learnerRecordId: "peer-learner" } })],
    ["another employee", () => ({ ...response(), learner: { ...response().learner, learner: { id: "peer", email: "peer@example.test" } } })],
    ["unconfirmed declaration", () => ({ ...response(), learner: { ...response().learner, eligibilityDeclaration: null } })],
    ["foreign declaration", () => ({ ...response(), learner: { ...response().learner, eligibilityDeclaration: { ...response().learner.eligibilityDeclaration, organisationId: "fictional-b" } } })],
    ["another declarant", () => ({ ...response(), learner: { ...response().learner, eligibilityDeclaration: { ...response().learner.eligibilityDeclaration, confirmedByEmployee: "peer" } } })],
    ["empty success", () => ({ ok: true })],
  ])("rejects %s before clearing a retained command", async (_label, result) => {
    const mutation = createPinnedClientMutation(identity, "/api/levytate-learners/fictional-learner/employee-declaration", decode, async () => Response.json(result()));
    await expect(mutation.execute(command)).rejects.toThrow("could not be confirmed");
    expect(mutation.pending).toBe(true);
  });
  it("retries the exact original hours, version and request key after a lost response", async () => {
    const posted: string[] = [];
    const transport = vi.fn(async (_path: string, init?: RequestInit) => { posted.push(String(init?.body)); if (posted.length === 1) throw new TypeError("Synthetic network loss"); return Response.json(response()); });
    const mutation = createPinnedClientMutation(identity, "/api/levytate-learners/fictional-learner/employee-declaration", decode, createAuthenticatedClientFetch(transport));
    const input = { ...command }; const confirmed = vi.fn();
    await expect(mutation.execute(input, confirmed)).rejects.toThrow();
    input.expectedEnglandWorkingHoursPercentage = 95; input.idempotencyKey = "changed-key";
    await expect(mutation.execute(input)).rejects.toThrow("original update");
    expect(transport).toHaveBeenCalledTimes(1);
    await mutation.retry();
    expect(posted).toEqual([JSON.stringify(command), JSON.stringify(command)]); expect(confirmed).toHaveBeenCalledTimes(1); expect(mutation.pending).toBe(false);
  });
  it("does not retry a declaration under the account recovered from another tab", async () => {
    const transport = vi.fn(async (path: string) => path === "/api/levytate-auth/session"
      ? Response.json({ identity: { email: "another@example.test", organisationId: "fictional-b" } }) : Response.json({}, { status: 401 }));
    const mutation = createPinnedClientMutation(identity, "/api/levytate-learners/fictional-learner/employee-declaration", decode, createAuthenticatedClientFetch(transport));
    await expect(mutation.execute(command)).rejects.toThrow("different account");
    expect(transport).toHaveBeenCalledTimes(2); expect(mutation.pending).toBe(true);
  });
});
