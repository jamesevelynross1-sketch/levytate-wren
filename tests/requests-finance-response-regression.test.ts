import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeFinanceMutationResponse, decodeRequestsMutationResponse } from "@/lib/levytate/client-module-responses";
import { createPinnedClientMutation } from "@/lib/levytate/client-mutation-retry";
import { calculateLevyFinance } from "@/lib/levytate/finance/calculations";
import { createRequestsAcceptanceFixture } from "@/lib/levytate/requests/test-fixtures";
import { addProviderMembershipForTest, askProviderClarification, compareSubmittedResponses, completeWorkspaceHandover, confirmAgreement, createEmptyServiceRequestStore, createServiceRequestDraft, employerRequestMetrics, inviteProviders, progressProviderToAgreement, publishServiceRequest, recordInvitationDelivery, resolveProviderMembership, saveProviderResponseDraft, submitProviderResponse } from "@/lib/levytate/requests/workflow";
import { decodeFinanceReadResponse, decodeRequestsReadResponse } from "@/lib/levytate/client-employer-module-reads";

// Inject only the mounted container's first state, exactly where a confirmed
// response is published. Projection/calculation/rendering remain the real code.
// This is component fault injection, not browser or genuine Auth acceptance.
const renderState = vi.hoisted(() => ({ next: false, value: null as unknown }));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => {
    const state = actual.useState(initial);
    if (renderState.next) { renderState.next = false; return [renderState.value, state[1]]; }
    return state;
  } };
});
vi.mock("@/components/levytate-mvp/MvpWorkspaceStore", () => ({ useMvpWorkspace: () => ({ meta: { userEmail: "lead@example.invalid", organisationId: "tenant-a" } }) }));
vi.mock("@/components/levytate-mvp/usePinnedClientMutation", () => ({ usePinnedClientMutation: () => ({ locked: false, working: false, pending: false, reconciled: 0, error: "", execute: vi.fn(), retry: vi.fn() }) }));
import { EmployerRequestsContainer } from "@/components/levytate-mvp/EmployerRequestsContainer";
import { LevyFinanceModule } from "@/components/levytate-mvp/LevyFinanceModule";

const identity = { email: "lead@example.invalid", organisationId: "tenant-a" };
const requests = () => ({ ok: true, workspace: { requestsEnabled: true, organisation: { id: "tenant-a", name: "Fictional employer" }, metrics: { openRequests: 0, responsesReceived: 0, requestsInDecision: 0, progressedToAgreement: 0 }, requests: [], providerOptions: [], programmeOptions: [] } });
const finance = () => ({ ok: true, state: { version: 1, mode: "persistent", transactions: [{ transactionId: "synthetic-transaction", transactionDate: "2026-11-09", description: "Fictional levy contribution", category: "levy_in", amountPence: 10000, sourceRow: 2, fingerprint: "synthetic-fingerprint" }], imports: [{ id: "synthetic-import", importedAt: "2026-11-09T12:00:00Z", fileName: "fictional.csv", sourceRows: 1, newTransactions: 1, duplicateRows: 0, reviewRows: 0, dateRange: { from: "2026-11-09", to: "2026-11-09" } }] } });
function render(value: unknown, element: ReactElement) { renderState.value = value; renderState.next = true; try { return renderToStaticMarkup(element); } finally { renderState.next = false; } }
const requestElement = () => createElement(EmployerRequestsContainer, {});
const financeElement = () => createElement(LevyFinanceModule, { organisationId: "tenant-a", demoMode: true });
beforeEach(() => { renderState.next = false; renderState.value = null; });

function completeFictionalRequest() {
  const fixture = createRequestsAcceptanceFixture(), store = createEmptyServiceRequestStore(fixture.capabilities), actor = fixture.employerActors.leadA;
  const now = "2026-09-11T09:10:00.000Z", step = (idempotencyKey: string) => ({ idempotencyKey, now });
  for (const membership of fixture.providerMemberships) addProviderMembershipForTest(store, membership);
  const request = createServiceRequestDraft(store, actor, { content: fixture.requestContent, ...step("request") });
  publishServiceRequest(store, actor, request.id, { organisationName: "Fictional employer", ...step("publish") });
  const invitation = inviteProviders(store, actor, request.id, [fixture.providers[0].providerId], step("invite"))[0];
  invitation.invitedProviderMembershipId = fixture.providerMemberships[0].id;
  recordInvitationDelivery(store, actor, invitation.id, { accepted: true, providerMessageId: "synthetic-only", ...step("delivery") });
  const provider = resolveProviderMembership(store, { authSubject: fixture.ids.providerAAuthSubject, email: fixture.providerMemberships[0].email });
  const response = saveProviderResponseDraft(store, provider, invitation.id, fixture.providerResponses.providerA, step("response"));
  if (!("invitationId" in response)) throw new Error("Fictional response fixture unexpectedly declined");
  const version = submitProviderResponse(store, provider, response.id, step("submit"));
  askProviderClarification(store, actor, invitation.id, { question: "Fictional clarification", ...step("question") });
  progressProviderToAgreement(store, actor, request.id, response.id, step("progress"));
  confirmAgreement(store, actor, request.id, provider.providerId, step("agreement"));
  completeWorkspaceHandover(store, actor, request.id, { addProvider: true, addProgramme: true, ...step("handover") });
  // Actual domain-generated records, shaped as the service's employer projection.
  const withName = <T extends object>(rows: T[]) => rows.map(item => ({ ...item, providerName: "Fictional provider" }));
  const view = { ...request, versions: store.requestVersions, invitations: withName(store.invitations), responses: [{ id: response.id, requestId: response.requestId, invitationId: response.invitationId, organisationId: response.organisationId, providerId: response.providerId, providerName: "Fictional provider", requestVersion: version.requestVersion, currentVersion: response.currentVersion, submittedAt: version.submittedAt, submittedContent: version.submittedContent }], responseVersions: store.responseVersions, clarifications: withName(store.clarifications), decisions: withName(store.decisions), agreementSnapshots: store.agreementSnapshots, handovers: store.handovers, comparison: compareSubmittedResponses(store, actor, request.id) };
  return { ok: true, workspace: { requestsEnabled: true, organisation: { id: actor.organisationId, name: "Fictional employer" }, metrics: employerRequestMetrics(store, actor), requests: [view], providerOptions: [{ providerId: provider.providerId, providerName: "Fictional provider", deliveryModels: ["Blended"], regions: ["England"], programmeIds: [fixture.programme.programmeId], relationshipStatus: "existing", providerAccessReady: true }], programmeOptions: [{ programmeId: fixture.programme.programmeId, providerId: provider.providerId, programmeName: "Fictional programme", level: 4, fundingBandMaximumPence: 1500000 }] } };
}

describe("Requests and Finance malformed success must not consume the original command", () => {
  it("accepts complete fictional contracts and renders them without substituting live fixture data", () => {
    const a = requests(), b = finance();
    expect(decodeRequestsMutationResponse(a, identity.organisationId)).toBe(a.workspace);
    expect(decodeFinanceMutationResponse(b)).toBe(b.state);
    expect(render(a.workspace, requestElement())).toContain("Requests");
    expect(render(b.state, financeElement())).toContain("Levy position");
  });
  it("accepts domain-generated publication, provider response, clarification, agreement and handover in both read and write paths", () => {
    const value = completeFictionalRequest();
    expect(decodeRequestsReadResponse(value, value.workspace.organisation.id)).toBe(value.workspace);
    expect(decodeRequestsMutationResponse(value, value.workspace.organisation.id)).toBe(value.workspace);
    expect(render(value.workspace, requestElement())).toContain("Requests");
  });
  it.each(["delivery", "response", "snapshot", "comparison", "other-tenant", "other-request"])("rejects malformed populated Request %s before read or write state publication", field => {
    const value = structuredClone(completeFictionalRequest()), item = value.workspace.requests[0];
    if (field === "delivery") Object.assign(item.responses[0].submittedContent.deliveryApproach, { models: null });
    if (field === "response") Object.assign(item.responses[0], { submittedContent: null });
    if (field === "snapshot") Object.assign(item.versions[0], { publishedSnapshot: {} });
    if (field === "comparison") Object.assign(item.comparison, { pointsToResolve: {} });
    if (field === "other-tenant") item.invitations[0].organisationId = "other-tenant";
    if (field === "other-request") item.handovers[0].requestId = "other-request";
    expect(() => decodeRequestsReadResponse(value, value.workspace.organisation.id)).toThrow();
    expect(() => decodeRequestsMutationResponse(value, value.workspace.organisation.id)).toThrow();
  });
  it("uses the same complete Finance decoder for initial reads and writes, preserving real timestamp formats", () => {
    const value = { ...finance(), state: { ...finance().state, manualBalancePence: 10000, manualBalanceConfirmedAt: "2026-11-09T12:30:00+00:00" } };
    expect(decodeFinanceReadResponse(value)).toBe(value.state); expect(decodeFinanceMutationResponse(value)).toBe(value.state);
    expect(() => decodeFinanceReadResponse({ ...value, state: { ...value.state, imports: [{}] } })).toThrow();
  });
  it.each([
    { ...requests(), workspace: { ...requests().workspace, providerOptions: [{}] } },
    { ...requests(), workspace: { ...requests().workspace, requests: [{}] } },
    { ...requests(), workspace: { ...requests().workspace, metrics: true } },
    { ...requests(), workspace: { ...requests().workspace, metrics: { ...requests().workspace.metrics, openRequests: "0" } } },
    { ...requests(), workspace: { ...requests().workspace, organisation: { id: "tenant-a" } } },
  ])("rejects incomplete Requests HTTP200 before publishing malformed render data", payload => {
    expect(() => decodeRequestsMutationResponse(payload, identity.organisationId)).toThrow();
  });
  it("shows why Requests array-only validation is material: the actual container projection crashes", () => {
    expect(() => render({ ...requests().workspace, providerOptions: [{}] }, requestElement())).toThrow(TypeError);
    expect(() => render({ ...requests().workspace, requests: [{}] }, requestElement())).toThrow(TypeError);
  });
  it.each([
    { ...finance(), state: { ...finance().state, transactions: [{}] } },
    { ...finance(), state: { ...finance().state, transactions: [{ ...finance().state.transactions[0], amountPence: "not-money" }] } },
    { ...finance(), state: { ...finance().state, transactions: [{ ...finance().state.transactions[0], transactionDate: "not-a-date" }] } },
    { ...finance(), state: { ...finance().state, transactions: [{ ...finance().state.transactions[0], category: "unrecognised" }] } },
    { ...finance(), state: { ...finance().state, imports: [{}] } },
    { ...finance(), state: { ...finance().state, manualBalancePence: "not-money", manualBalanceConfirmedAt: "2026-11-09" } },
  ])("rejects incomplete Finance HTTP200 before clearing retained import or balance input", payload => {
    expect(() => decodeFinanceMutationResponse(payload)).toThrow();
  });
  it("shows actual Finance render failure and untruthful non-finite totals from accepted malformed rows", () => {
    expect(() => render({ ...finance().state, transactions: [{}] }, financeElement())).toThrow(TypeError);
    const malformed = { ...finance().state, transactions: [{ ...finance().state.transactions[0], amountPence: "not-money" }] };
    expect(calculateLevyFinance(malformed as never).latest?.levyReceivedPence).toBeNaN();
    expect(render(malformed, financeElement())).toContain("NaN");
  });
  it.each(["requests", "finance"] as const)("retains the exact %s command after malformed200 then confirms only the valid retry", async family => {
    const bodies: string[] = [], confirmed = vi.fn();
    const valid = family === "requests" ? requests() : finance();
    const invalid = family === "requests" ? { ...requests(), workspace: { ...requests().workspace, requests: [{}] } } : { ...finance(), state: { ...finance().state, transactions: [{}] } };
    const decode = (value: unknown) => family === "requests" ? decodeRequestsMutationResponse(value, identity.organisationId) : decodeFinanceMutationResponse(value);
    const controller = createPinnedClientMutation(identity, `/api/levytate-${family}`, decode, async (_path, init) => { bodies.push(String(init?.body)); return Response.json(bodies.length === 1 ? invalid : valid); });
    const original = { action: family === "requests" ? "create_draft" : "balance", idempotencyKey: "original-key", amountPence: 10000 };
    await expect(controller.execute(original, confirmed)).rejects.toThrow();
    expect(controller.pending).toBe(true); expect(confirmed).not.toHaveBeenCalled();
    original.amountPence = 99999; await controller.retry();
    expect(bodies[1]).toBe(bodies[0]); expect(controller.pending).toBe(false); expect(confirmed).toHaveBeenCalledTimes(1);
  });
});
