import type { CoreEarlyAccessModuleKey } from "@/lib/levytate/core-early-access-policy";

export type LevyTateCopilotEntityType = "learner" | "application" | "provider" | "employee" | "programme";

export type LevyTateCopilotContext = {
  module: CoreEarlyAccessModuleKey;
  route: string;
  contextLabel: string;
  entityType?: LevyTateCopilotEntityType;
  entityId?: string;
};

const suggestions: Partial<Record<CoreEarlyAccessModuleKey, readonly string[]>> = {
  Home: ["What should I prioritise first?", "Show me the learners needing attention", "Show overdue reviews"],
  Intelligence: ["Summarise today's provider updates", "What changed in AI & Data?", "Show me programme launches", "What should I read first?"],
  Applications: ["Summarise current application workload", "Which applications need attention?", "Explain the current approval status", "What needs to happen next?"],
  Approvals: ["Which applications need my review?", "Summarise the selected application", "What information is missing?", "Help me draft decision notes"],
  Learners: ["Show me overdue reviews", "Why is this learner flagged?", "Summarise this learner's current status", "What needs attention next?"],
  Providers: ["Summarise this provider", "What programmes do they offer here?", "Show outstanding actions", "Explain our current relationship"],
  Programmes: ["Summarise this programme", "Which employees are linked to it?", "What provider delivers it?", "Show current learner activity"],
  People: ["Summarise this employee", "What apprenticeship activity do they have?", "Show current applications", "Explain their current status"],
  "My Team": ["Who needs my support?", "Show direct reports behind target", "Which reviews are overdue?", "Help me draft a check-in"],
  "My Application": ["Explain my current status", "What information is missing?", "What needs to happen next?", "Help me prepare for my manager conversation"],
  "My Programme": ["Explain this programme", "What should I focus on next?", "How does workplace learning work?", "Help me prepare for my next check-in"],
  Knowledge: ["Explain this guidance", "What applies to my role?", "Show related guidance", "Summarise the key actions"],
  Settings: ["Explain these workspace settings", "What can my role change?", "Summarise the current setup"],
};

export function copilotSuggestionsFor(context: LevyTateCopilotContext) {
  if (context.entityType === "learner") return ["Summarise this learner's current status", "Why is this learner flagged?", "What needs attention next?", "Explain this learner's latest review"];
  if (context.entityType === "application") return ["Summarise this application", "What information is missing?", "Explain the current approval status", "What needs to happen next?"];
  if (context.entityType === "provider") return ["Summarise this provider", "What programmes do they offer here?", "Show outstanding actions", "Explain our current relationship"];
  return suggestions[context.module] ?? ["Summarise this page", "What needs attention?", "Explain the next step"];
}

export function copilotPlaceholderFor(context: LevyTateCopilotContext) {
  if (context.entityType === "learner") return "Ask about this learner...";
  if (context.entityType === "application") return "Ask about this application...";
  if (context.entityType === "provider") return "Ask about this provider...";
  if (context.module === "Intelligence") return "Ask about today's apprenticeship market...";
  if (context.module === "Home") return "Ask about today's learner operations...";
  return `Ask about ${context.contextLabel.toLowerCase()}...`;
}
