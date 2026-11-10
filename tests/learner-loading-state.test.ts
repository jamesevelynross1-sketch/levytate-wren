import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/components/levytate-mvp/MvpWorkspaceStore", () => ({ useMvpWorkspace: () => ({ can: () => true, meta: { userRole: "Apprenticeship Lead", userEmail: "fictional@example.invalid", organisationId: "fictional-tenant" } }) }));
import { LearnersModule } from "@/components/levytate-mvp/LearnersModule";

describe("learner data availability presentation", () => {
  it("renders loading without inventing a zero-count operational report", () => {
    const html = renderToStaticMarkup(createElement(LearnersModule));
    expect(html).toContain("Loading learner lifecycle records.");
    expect(html).not.toContain("Total records");
    expect(html).not.toContain("Active learners");
    expect(html).not.toContain("No learner records");
  });
});
