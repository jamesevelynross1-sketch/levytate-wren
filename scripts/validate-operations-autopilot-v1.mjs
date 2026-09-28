import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { analyseOperationsAutopilot, buildOperationsBrief, reconcileAutopilotSignals, validateAutopilotInterpretation } from "../lib/levytate/autopilot/operations-autopilot.ts";

let passed = 0;
const check = (label, condition) => { assert.ok(condition, label); passed += 1; console.log(`PASS ${label}`); };
const now = "2026-09-28T09:00:00.000Z";
const baseLearner = { learnerRecordId: "learner-1", learnerName: "Alex Morgan", providerId: "provider-1", providerName: "Provider One", programmeId: "programme-1", programmeName: "Data Technician", reviews: [] };
const baseAction = { id: "action-1", learnerRecordId: "learner-1", applicationId: "application-1", employeeId: "employee-1", title: "Confirm support plan", description: "", actionType: "address_progress_exception", ownerType: "Apprenticeship Lead", dueDate: "2026-09-20", status: "open", sourceUrl: "/levytate/app?module=Operations", updatedAt: "2026-09-20T09:00:00Z" };
const analyse = (overrides = {}) => analyseOperationsAutopilot({ organisationId: "org-a", now, learners: [], actions: [], applications: [], ...overrides });

const overdueReview = analyse({ learners: [{ ...baseLearner, reviews: [{ id: "review-overdue", type: "provider_review", nextReviewDate: "2026-09-20", reviewDate: "2026-08-20", status: "recorded" }] }] });
check("overdue review detected", overdueReview.some((signal) => signal.signalType === "review_overdue"));
check("overdue review is ready to action now", overdueReview[0].priority === "action_now" && overdueReview[0].lane === "ready_to_action");
check("review evidence references persisted review", overdueReview[0].evidence[0].sourceId === "review-overdue");

const dueWithAction = analyse({ learners: [{ ...baseLearner, reviews: [{ id: "review-due", type: "l_and_d_check_in", nextReviewDate: "2026-10-03", reviewDate: "2026-09-01", status: "recorded" }] }], actions: [baseAction] });
check("review due with action detected", dueWithAction.some((signal) => signal.signalType === "review_due_with_outstanding_actions"));
check("review due with action is ready to action now", dueWithAction[0].priority === "action_now" && dueWithAction[0].lane === "ready_to_action");
check("related generic action deduplicated", dueWithAction.length === 1);
check("review action evidence included", dueWithAction[0].evidence.some((item) => item.sourceId === "action-1"));

const upcoming = analyse({ learners: [{ ...baseLearner, reviews: [{ id: "review-upcoming", type: "manager_check_in", nextReviewDate: "2026-10-10", reviewDate: "2026-09-10", status: "recorded" }] }] });
check("upcoming review detected", upcoming[0].signalType === "review_upcoming");
check("upcoming review stays upcoming", upcoming[0].lane === "upcoming" && upcoming[0].priority === "upcoming");

const actionOverdue = analyse({ actions: [baseAction] });
check("operational action overdue detected", actionOverdue[0].signalType === "operational_action_overdue");
check("materially overdue action is action now", actionOverdue[0].priority === "action_now");
check("existing action linked rather than duplicated", actionOverdue[0].linkedOperationalActionId === baseAction.id);

const managerOverdue = analyse({ actions: [{ ...baseAction, ownerType: "Line Manager" }] });
check("manager overdue rule takes precedence", managerOverdue.length === 1 && managerOverdue[0].signalType === "manager_action_overdue");
const managerSoon = analyse({ actions: [{ ...baseAction, ownerType: "Line Manager", dueDate: "2026-10-01" }] });
check("manager due-soon rule detected", managerSoon[0].signalType === "manager_action_due_soon");
const providerOverdue = analyse({ actions: [{ ...baseAction, ownerType: "Provider" }] });
check("provider dependency uses waiting lane", providerOverdue[0].signalType === "provider_dependency_overdue" && providerOverdue[0].lane === "waiting_externally");

const managerApplication = analyse({ applications: [{ id: "application-manager", employeeId: "employee-1", employeeName: "Alex Morgan", status: "Awaiting Manager Review", currentOwner: "Line Manager", updatedAt: "2026-09-18T09:00:00Z" }] });
check("awaiting manager detected after five days", managerApplication[0].signalType === "application_awaiting_manager");
check("awaiting manager is ready to action", managerApplication[0].lane === "ready_to_action");
const providerApplication = analyse({ applications: [{ id: "application-provider", employeeId: "employee-1", employeeName: "Alex Morgan", status: "Approved for Enrolment", currentOwner: "Provider Partner", updatedAt: "2026-09-18T09:00:00Z" }] });
check("awaiting provider detected after five days", providerApplication[0].signalType === "application_awaiting_provider");
check("awaiting provider is external", providerApplication[0].lane === "waiting_externally");
const stalledApplication = analyse({ applications: [{ id: "application-stalled", employeeId: "employee-1", employeeName: "Alex Morgan", status: "Awaiting Final Approval", currentOwner: "Apprenticeship Lead", updatedAt: "2026-09-18T09:00:00Z" }] });
check("generic stalled application detected after seven days", stalledApplication[0].signalType === "application_stalled");
check("owner-specific application rule suppresses generic stalled rule", managerApplication.length === 1 && providerApplication.length === 1);
check("recent application not signalled", analyse({ applications: [{ ...managerApplication, id: "recent", employeeId: "e", employeeName: "Recent", status: "Awaiting Manager Review", currentOwner: "Line Manager", updatedAt: "2026-09-26T09:00:00Z" }] }).length === 0);
check("blank organisation produces no signals", analyse().length === 0);

const persisted = overdueReview.map((signal) => ({ ...signal, status: "new" }));
const rescanned = reconcileAutopilotSignals(persisted, overdueReview, now);
check("repeat scan is idempotent", rescanned.length === 1 && rescanned[0].id === persisted[0].id);
const dismissed = [{ ...persisted[0], status: "dismissed", dismissedAt: now, dismissedBy: "user-1", dismissalReason: "Already arranged" }];
check("dismissal persists while evidence is unchanged", reconcileAutopilotSignals(dismissed, overdueReview, now)[0].status === "dismissed");
const changedEvidence = [{ ...overdueReview[0], fingerprint: "material-change", summary: "Changed persisted evidence" }];
check("material change regenerates dismissed signal", reconcileAutopilotSignals(dismissed, changedEvidence, now)[0].status === "new");
const resolved = reconcileAutopilotSignals(persisted, [], now);
check("cleared source condition resolves", resolved[0].status === "resolved" && resolved[0].lane === "recently_resolved");
const brief = buildOperationsBrief([...managerApplication.map((signal) => ({ ...signal, status: "new" })), ...upcoming.map((signal) => ({ ...signal, status: "new" }))]);
check("operations brief counts priority lanes", brief.total === 2 && brief.thisWeek === 1 && brief.upcoming === 1);
const generated = validateAutopilotInterpretation({ headline: "Review is overdue", whyItMatters: "The recorded review date has passed.", suggestedNextStep: "Arrange the review.", draftCommunication: "Please confirm a review date.", evidenceSummary: ["review-overdue"] }, overdueReview[0], "test-model");
check("valid AI wording is accepted", generated.source === "ai" && generated.modelIdentifier === "test-model");
check("AI cannot replace deterministic evidence summary", JSON.stringify(generated.evidenceSummary) === JSON.stringify(overdueReview[0].interpretation.evidenceSummary));
const unsupportedNumber = validateAutopilotInterpretation({ headline: "Review is 99 days overdue", whyItMatters: "It needs attention.", suggestedNextStep: "Arrange the review.", draftCommunication: "", evidenceSummary: ["review-overdue"] }, overdueReview[0], "test-model");
check("unsupported numeric claims fall back safely", unsupportedNumber.source === "deterministic");
const prohibited = validateAutopilotInterpretation({ headline: "High-risk learner", whyItMatters: "A risk score was calculated.", suggestedNextStep: "Arrange the review.", draftCommunication: "", evidenceSummary: ["review-overdue"] }, overdueReview[0], "test-model");
check("prohibited AI language falls back safely", prohibited.source === "deterministic");

const migration = await fs.readFile("supabase/migrations/030_extend_intelligence_signals_for_autopilot.sql", "utf8");
check("migration is additive", !migration.match(/\b(drop table|truncate|delete from)\b/i));
check("migration preserves RLS and policies", !migration.match(/disable row level security|drop policy|revoke all/i));
check("migration adds stable signal identity", migration.includes("signal_key") && migration.includes("org_signal_key_unique"));
check("migration retains legacy signal types", migration.includes("repeated_workplace_blocker") && migration.includes("assessment_or_completion_opportunity"));
check("migration constrains Autopilot lanes", migration.includes("levytate_intelligence_signals_lane_check"));

const server = await fs.readFile("lib/server/levytate-autopilot.ts", "utf8");
const route = await fs.readFile("app/api/levytate-autopilot/route.ts", "utf8");
const panel = await fs.readFile("components/levytate-mvp/AutopilotOperationsPanel.tsx", "utf8");
check("organisation-wide access is role restricted", server.includes('"Employer Admin", "Apprenticeship Lead"') && server.includes("operationalActions:write"));
check("mutations enforce same origin", route.includes('request.headers.get("origin") !== new URL(request.url).origin'));
check("request bodies are bounded", route.includes("readBoundedJson(request, 16 * 1024)"));
check("communication remains an unsent draft", server.includes("communicationSent: false") && panel.includes("Communication draft (not sent)"));
check("human approval is explicit", panel.includes("Human approval required") && panel.includes("Create action"));
check("no automatic scheduling is configured", !server.includes("cron") && !route.includes("schedule"));

const productSources = `${await fs.readFile("lib/levytate/autopilot/operations-autopilot.ts", "utf8")}\n${panel}\n${server}`;
check("no learner risk score language", !productSources.match(/learner risk score|provider quality score|match percentage/i));
check("no provider ranking language", !productSources.match(/ranked provider|provider ranking|top provider/i));
check("deterministic fallback exists", productSources.includes('source: "deterministic"'));
check("AI output is evidence constrained", (await fs.readFile("lib/levytate/autopilot/ai.ts", "utf8")).includes("Use only the supplied deterministic evidence"));
check("existing Operations views remain available", (await fs.readFile("components/levytate-mvp/OperationsCentreModule.tsx", "utf8")).includes("Active work") && (await fs.readFile("components/levytate-mvp/OperationsCentreModule.tsx", "utf8")).includes("Closed actions"));

console.log(`\nOperations Autopilot V1 validation: ${passed}/${passed} checks passed`);
