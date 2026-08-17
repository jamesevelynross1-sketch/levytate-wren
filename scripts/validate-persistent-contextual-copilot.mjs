import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { copilotPlaceholderFor, copilotSuggestionsFor } from "../lib/levytate/copilot-context.ts";

let passed = 0;
const check = (label, condition) => { assert.ok(condition, label); passed += 1; console.log(`PASS ${label}`); };

const shell = await fs.readFile("components/levytate-mvp/LevyTateMvpApp.tsx", "utf8");
const persistent = await fs.readFile("components/levytate-mvp/PersistentCopilot.tsx", "utf8");
const workspace = await fs.readFile("components/levytate-mvp/AskLevyTateAiWorkspace.tsx", "utf8");
const learners = await fs.readFile("components/levytate-mvp/LearnersModule.tsx", "utf8");
const applications = await fs.readFile("components/levytate-mvp/ApplicationsModule.tsx", "utf8");

const operations = { module: "Home", route: "/levytate/app", contextLabel: "Operations Centre" };
const intelligence = { module: "Intelligence", route: "/levytate/app?module=Intelligence", contextLabel: "Intelligence" };
const learner = { module: "Learners", route: "/levytate/app?module=Learners", contextLabel: "Learner: Fixture Person", entityType: "learner", entityId: "learner-fixture" };
const application = { module: "Applications", route: "/levytate/app?module=Applications", contextLabel: "Application: Fixture Person", entityType: "application", entityId: "application-fixture" };
const provider = { module: "Providers", route: "/levytate/app?module=Providers", contextLabel: "Provider: Fixture Provider", entityType: "provider", entityId: "provider-fixture" };

check("launcher is gated by copilot:use", shell.includes('can("copilot:use")'));
check("Platform Admin does not receive employer operational drawer", shell.includes('meta?.userRole !== "Platform Admin"'));
check("standalone Copilot destination remains", shell.includes('activeModule === "Copilot"') && shell.includes("<AskLevyTateAiWorkspace"));
check("drawer uses existing Copilot workspace", persistent.includes('presentation="drawer"') && persistent.includes("AskLevyTateAiWorkspace"));
check("drawer supports open and close state", persistent.includes("setOpen(true)") && persistent.includes("setOpen(false)"));
check("module suggestions are contextual", copilotSuggestionsFor(operations)[0] !== copilotSuggestionsFor(intelligence)[0]);
check("learner context is typed and specific", copilotSuggestionsFor(learner)[0].includes("learner") && copilotPlaceholderFor(learner).includes("learner"));
check("application context is typed and specific", copilotSuggestionsFor(application)[0].includes("application") && copilotPlaceholderFor(application).includes("application"));
check("provider context is typed and specific", copilotSuggestionsFor(provider)[0].includes("provider") && copilotPlaceholderFor(provider).includes("provider"));
check("learner selections are emitted", learners.includes("onLearnerSelectionChange") && shell.includes("updateLearnerCopilotSelection"));
check("application selections are emitted", applications.includes("onApplicationSelectionChange?.(selectedId)") && shell.includes("updateApplicationReviewSelection"));
check("context changes preserve mounted conversation", workspace.includes("contextChanges") && persistent.includes("translate-x-full") && !persistent.includes("open &&"));
check("Escape and focus return are implemented", persistent.includes('event.key !== "Escape"') && persistent.includes("launcherRef.current?.focus()") && persistent.includes("closeRef.current?.focus()"));
check("mobile drawer is full width and desktop is 400px", persistent.includes("w-full") && persistent.includes("400px"));
check("contextual input avoids generic ask-anything copy", workspace.includes("copilotPlaceholderFor(context)") && !persistent.includes("Ask me anything"));
check("no new Copilot write permission is introduced", !persistent.includes(":write") && !workspace.includes("copilot:write"));

console.log(`\nPersistent contextual Copilot validation: ${passed}/${passed} checks passed`);
