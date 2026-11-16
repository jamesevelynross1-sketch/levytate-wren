import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ClientMutationRecovery } from "@/components/levytate-mvp/ClientMutationRecovery";
import { MvpWorkspaceProvider } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { createEmptyMvpWorkspace } from "@/lib/levytate/mvp/workspace";
import type { LevyTateWorkspaceBootstrap } from "@/lib/levytate/mvp/api";
import { permissionsForMvpRole } from "@/lib/levytate/mvp/rbac";

function workspace(): LevyTateWorkspaceBootstrap {
  return { data: createEmptyMvpWorkspace(), meta: { organisationId: "10000000-0000-4000-8000-000000000001", organisationName: "Fictional workspace", userEmail: "synthetic@example.invalid", userRole: "Employee", permissions: permissionsForMvpRole("Employee"), storageMode: "supabase", warnings: [] } };
}
const mutation = { working: false, pending: true, error: "Your session has ended. Sign in again before retrying.", retry: vi.fn() };
function render(initialWorkspace = workspace(), pending = true, working = false) {
  return renderToStaticMarkup(createElement(MvpWorkspaceProvider, { initialWorkspace } as ComponentProps<typeof MvpWorkspaceProvider>, createElement(ClientMutationRecovery, { mutation: { ...mutation, pending, working } })));
}
describe("actual shared pending-update dialog composition", () => {
  it("keeps sign-in and reconnect inside the native modal for independently fetched module mutations", () => {
    // Generic module fetches need not have set the outer Store recovery banner.
    // The modal makes all sibling controls inert, so its own controls are vital.
    const html = render(), dialog = html.slice(html.indexOf("<dialog"), html.indexOf("</dialog>"));
    expect(dialog).toContain("Sign in in new tab"); expect(dialog).toContain("Reconnect workspace");
    expect(dialog).toContain("Retry original update"); expect(dialog).toContain("Reload saved state");
    expect(html.slice(0, html.indexOf("<dialog"))).not.toContain("Reconnect workspace");
    expect(mutation.retry).not.toHaveBeenCalled();
  });
  it("keeps the confirmed/no-pending view free of sign-in controls", () => {
    expect(render(workspace(), false)).not.toContain("Reconnect workspace");
  });
  it("does not show genuine authentication controls in a demo or outside a workspace", () => {
    const demo = workspace(); demo.meta.storageMode = "local_fallback";
    expect(render(demo)).not.toContain("Sign in in new tab");
    expect(renderToStaticMarkup(createElement(ClientMutationRecovery, { mutation }))).not.toContain("Reconnect workspace");
  });
  it("does not enable session actions while the retained mutation is in flight", () => {
    const html = render(workspace(), true, true);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Sign in in new tab<\/button>/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Reconnect workspace<\/button>/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Retry original update<\/button>/);
  });
});
