import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FormActions } from "@/components/levytate-mvp/MvpUi";

describe("recoverable form actions", () => {
  it("blocks submission during recovery without trapping the user in the form", () => {
    const html = renderToStaticMarkup(createElement(FormActions, { onCancel: () => undefined, submissionBlocked: true, error: "Reconnect before saving." }));
    expect(html).toMatch(/type="submit" disabled=""/);
    expect(html).not.toMatch(/type="button" disabled/);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Reconnect before saving.");
  });
  it("unblocks confirmed recovery and works in standalone demo forms", () => {
    const html = renderToStaticMarkup(createElement(FormActions, { onCancel: () => undefined }));
    expect(html).toContain('type="submit"');
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('role="alert"');
  });
});
