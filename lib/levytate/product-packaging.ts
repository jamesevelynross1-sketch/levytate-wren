import type { CoreEarlyAccessModuleKey } from "@/lib/levytate/core-early-access-policy";

// Packaging is separate from availability. Moving a feature into an add-on
// does not revoke existing access, alter permissions, or remove stored data.
export type LevyTateProductSection = "core" | "add-on" | "support";

// External Microsoft integration is not the in-app LevyTate Copilot module.
// Packaging classification does not enable the connector or bypass tenant consent,
// runtime configuration, organisation capabilities or existing role boundaries.
export const levyTateIntegrationSections = {
  microsoft365Copilot: "core",
} as const satisfies Record<"microsoft365Copilot", LevyTateProductSection>;

export function getLevyTateIntegrationSection(integration: keyof typeof levyTateIntegrationSections): LevyTateProductSection {
  return levyTateIntegrationSections[integration];
}

export const levyTateModuleSections = {
  Home: "core",
  "My Programme": "core",
  "My Application": "core",
  "Learning Time": "add-on",
  "My Support": "add-on",
  "Learner Support": "add-on",
  Assessments: "add-on",
  "My Team": "core",
  Approvals: "core",
  Operations: "core",
  Intelligence: "add-on",
  Applications: "core",
  People: "core",
  Learners: "core",
  Providers: "core",
  "My Providers": "core",
  "My Programmes": "core",
  Requests: "add-on",
  Marketplace: "core",
  Insights: "core",
  "Workforce Development": "add-on",
  Finance: "core",
  Programmes: "core",
  Copilot: "add-on",
  Knowledge: "support",
  Reports: "add-on",
  Settings: "support",
  Support: "support",
} as const satisfies Record<CoreEarlyAccessModuleKey, LevyTateProductSection>;

export function getLevyTateProductSection(module: CoreEarlyAccessModuleKey): LevyTateProductSection {
  return levyTateModuleSections[module];
}
