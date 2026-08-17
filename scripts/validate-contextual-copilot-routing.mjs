import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { resolveContextualCopilotIntent } from "../lib/levytate/contextual-copilot-intent.ts";

const checks = [];
function check(label, run) {
  run();
  checks.push(label);
  console.log(`PASS ${label}`);
}

const operations = "Operations Centre";
const resolve = (message) => resolveContextualCopilotIntent({ message, currentSection: operations });

check("learner attention command resolves contextually", () => assert.equal(resolve("Show me the learners needing attention")?.intent, "learners_needing_attention"));
check("learner attention command cannot reach programme matching", () => assert.notEqual(resolve("Show me the learners needing attention")?.intent, "programme_directory"));
check("highest-risk command resolves contextually", () => assert.equal(resolve("Summarise today's highest-risk actions")?.intent, "highest_risk_actions"));
check("priority command resolves contextually", () => assert.equal(resolve("What should I prioritise first?")?.intent, "highest_risk_actions"));
check("overdue reviews resolve contextually", () => assert.equal(resolve("Show overdue reviews")?.intent, "overdue_reviews"));
check("ready-to-enrol resolves contextually", () => assert.equal(resolve("Who is ready to enrol?")?.intent, "ready_to_enrol"));
check("active breaks resolve contextually", () => assert.equal(resolve("Who is on a break?")?.intent, "active_breaks"));
check("context rules do not capture unrelated modules", () => assert.equal(resolveContextualCopilotIntent({ message: "Show me the learners needing attention", currentSection: "Providers" }), null));

const tools = await readFile(new URL("../lib/server/levytate-copilot-tools.ts", import.meta.url), "utf8");
const drawer = await readFile(new URL("../components/levytate-mvp/AskLevyTateAiWorkspace.tsx", import.meta.url), "utf8");
const shell = await readFile(new URL("../components/levytate-mvp/PersistentCopilot.tsx", import.meta.url), "utf8");

check("attention results use Operations Centre server source", () => assert.match(tools, /getOrganisationOperationsSummary\(session, \{ queue: "urgent", status: "open" \}\)/));
check("zero state is explicit and honest", () => assert.match(tools, /No learners currently meet the “needs attention” criteria/));
check("drawer exposes no write permission", () => assert.doesNotMatch(`${drawer}\n${shell}`, /settings:write|providers:write|applications:write|learners:write/));
check("drawer suggestions are limited to three", () => assert.match(drawer, /activePrompts\.slice\(0, 3\)/));
check("standalone Copilot presentation remains", () => assert.match(drawer, /presentation === "drawer"/));

console.log(`\nContextual Copilot routing validation: ${checks.length}/${checks.length} checks passed`);
