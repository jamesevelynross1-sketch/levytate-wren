/** Actual component submit logic with fake transport, never Auth/delivery acceptance. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const harness = vi.hoisted(() => ({ cells: [] as unknown[], cursor: 0, ready: true, transport: vi.fn() }));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useState: <T,>(initial: T) => {
    const index = harness.cursor++;
    if (!(index in harness.cells)) harness.cells[index] = initial;
    return [harness.cells[index], (value: T) => { harness.cells[index] = value; }];
  } };
});
vi.mock("@/components/levytate-mvp/useHydratedForm", () => ({ useHydratedForm: () => harness.ready }));
import { LevyTateLoginClient } from "@/components/levytate-mvp/LevyTateLoginClient";
import { ProviderLoginClient } from "@/components/levytate-provider/ProviderLoginClient";
type Element = { type: unknown; props: Record<string, unknown> };
function elements(tree: unknown): Element[] {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  const element = tree as Element;
  return [element, ...elements(element.props?.children)];
}
const email = "fictional-autofill@example.test";
beforeEach(() => {
  harness.cells = []; harness.cursor = 0; harness.ready = true; harness.transport.mockReset();
  vi.stubGlobal("fetch", harness.transport);
  vi.stubGlobal("FormData", class {
    constructor(private form: { email: string }) {}
    get(name: string) { return name === "email" ? this.form.email : null; }
  });
});
afterEach(() => vi.unstubAllGlobals());
describe.each([
  ["Employer", () => LevyTateLoginClient({ internalLoginEnabled: false }), "/api/levytate-auth/request"],
  ["Provider", () => ProviderLoginClient({}), "/api/levytate-provider-auth/request"],
] as const)("%s actual submit logic", (_name, component, endpoint) => {
  function render() { harness.cursor = 0; return component(); }
  async function submit() {
    const form = elements(render()).find(element => element.type === "form")!;
    const preventDefault = vi.fn();
    await (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault, currentTarget: { email } });
    expect(preventDefault).toHaveBeenCalledOnce();
  }
  it("does not send before hydration", async () => {
    harness.ready = false; await submit(); expect(harness.transport).not.toHaveBeenCalled();
  });
  it("uses the actual autofilled form value even when React email state was empty", async () => {
    harness.transport.mockResolvedValue(Response.json({ ok: true, message: "If authorised, you will receive a link." }));
    await submit();
    expect(harness.transport).toHaveBeenCalledExactlyOnceWith(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    expect(elements(render()).some(element => element.type === "h2" && element.props.children === "Check your email")).toBe(true);
  });
  it.each([{}, { ok: false, message: "Unavailable" }, null])("retains the input without a false confirmation for malformed200 %#", async body => {
    harness.transport.mockResolvedValue(Response.json(body)); await submit();
    const tree = elements(render());
    expect(tree.some(element => element.type === "h2" && element.props.children === "Check your email")).toBe(false);
    expect(tree.some(element => element.props.value === email)).toBe(true);
    expect(tree.some(element => element.props.role === "alert")).toBe(true);
  });
  it("retains the actual email after transport failure", async () => {
    harness.transport.mockRejectedValue(new Error("Synthetic network outage")); await submit();
    const tree = elements(render());
    expect(tree.some(element => element.props.value === email)).toBe(true);
    expect(tree.some(element => element.props.role === "alert")).toBe(true);
  });
});
