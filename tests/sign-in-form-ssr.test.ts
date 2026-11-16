import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LevyTateLoginClient } from "@/components/levytate-mvp/LevyTateLoginClient";
import { ProviderLoginClient } from "@/components/levytate-provider/ProviderLoginClient";
import { isSignInRequestAcknowledgement } from "@/lib/levytate/sign-in-form";

describe.each([
  ["Employer", () => createElement(LevyTateLoginClient, { internalLoginEnabled: false })],
  ["Provider", () => createElement(ProviderLoginClient, {})],
] as const)("%s server-rendered sign-in", (_name, element) => {
  it("keeps input and submit inert until their real handler is attached", () => {
    const html = renderToStaticMarkup(element());
    expect(html).toMatch(/<fieldset[^>]*disabled=""/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
    expect(html).toContain('name="email"');
    expect(html).toContain("Preparing secure sign-in");
    expect(html).toContain("Enable JavaScript and reload");
  });
});
it.each([null, {}, [], { ok: true }, { ok: false, message: "Unavailable" }, { ok: true, message: "" }, { ok: true, message: "x".repeat(513) }, { ok: true, message: "Generic", accountExists: true }, { ok: "true", message: "Generic" }])("rejects malformed successful sign-in acknowledgement %#", body => {
  expect(isSignInRequestAcknowledgement(body)).toBe(false);
});
it("accepts only the generic acknowledgement without asserting delivery or membership", () => {
  expect(isSignInRequestAcknowledgement({ ok: true, message: "If authorised, you will receive a sign-in link." })).toBe(true);
});
