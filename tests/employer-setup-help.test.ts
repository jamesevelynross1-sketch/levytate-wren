import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SetupContextHelp, employerSetupGuidance, employeeFieldGuidance, workspaceFieldGuidance } from "@/components/levytate-mvp/SetupContextHelp";

describe("guided setup contextual help", () => {
  it("explains all eight setup sections with meaningful descriptions", () => {
    const labels = ["organisation", "priorities", "managers", "employees", "providers", "programmes", "learners", "finance"] as const;
    expect(Object.keys(employerSetupGuidance).sort()).toEqual([...labels].sort());
    for (const label of labels) expect(employerSetupGuidance[label].length).toBeGreaterThan(35);
  });

  it("distinguishes physical sites from website addresses everywhere they appear", () => {
    for (const description of [workspaceFieldGuidance.sites, workspaceFieldGuidance.defaultSite, employeeFieldGuidance.site]) {
      expect(description.toLowerCase()).toMatch(/physical/);
      expect(description.toLowerCase()).toMatch(/website/);
    }
    expect(workspaceFieldGuidance.departments).toMatch(/Sales/);
    expect(employeeFieldGuidance.lineManager).toMatch(/apprenticeship application/);
  });

  it("offers a focusable, button-based explanation with a linked tooltip", () => {
    const html = renderToStaticMarkup(createElement(SetupContextHelp, { label: "Sites", description: workspaceFieldGuidance.sites }));
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="Help: Sites"');
    expect(html).toContain('aria-describedby="');
    expect(html).toContain('role="tooltip"');
    expect(html).toContain("Not website addresses.");
    expect(html).toContain("group-hover:visible");
    expect(html).toContain("group-focus-within:visible");
  });
});
