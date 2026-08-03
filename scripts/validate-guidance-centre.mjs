import fs from "node:fs/promises";

const component = await fs.readFile(new URL("../components/levytate-mvp/EmployerGuidanceCentre.tsx", import.meta.url), "utf8");
const shell = await fs.readFile(new URL("../components/levytate-mvp/LevyTateMvpApp.tsx", import.meta.url), "utf8");
const policy = await fs.readFile(new URL("../lib/levytate/core-early-access-policy.ts", import.meta.url), "utf8");
const admin = await fs.readFile(new URL("../components/levytate-mvp/GuidanceCentreModule.tsx", import.meta.url), "utf8");
const copilot = await fs.readFile(new URL("../components/levytate-mvp/AskLevyTateAiWorkspace.tsx", import.meta.url), "utf8");
const requiredTopics = ["Apprenticeship funding","Off-the-job training","Employer responsibilities","Eligibility","Apprenticeship applications","Enrolment and evidence","Progress reviews","Breaks in learning","Assessment and gateway","Completion and achievement","Managers supporting apprentices","Providers and programme delivery"];
const checks = [];
function check(label, condition) { if (!condition) throw new Error(`${label} failed.`); checks.push(label); }
for (const title of requiredTopics) check(`topic present: ${title}`, component.includes(`"${title}"`));
for (const heading of ["What this means","What the employer needs to know","What the employer needs to do","Common questions","Official guidance","Popular questions"]) check(`structure present: ${heading}`, component.includes(heading));
check("role-relevant ordering is shared", component.includes("t.roles.includes(meta?.userRole"));
check("search covers approved guidance content", component.includes("i.body.plainEnglishExplanation") && component.includes("i.body.practicalChecklist"));
check("official sources are secondary and expandable", component.includes("<details") && component.includes("View approved official sources"));
check("canonical employer navigation label", policy.includes('item("Knowledge", "Guidance Centre", "secondary", "help", "supporting")'));
check("topic deep links are supported", shell.includes('target.startsWith("Guidance Centre:")') && component.includes('params.get("topic")'));
check("Copilot guidance opens specific topics", copilot.includes('return `Guidance Centre:${topic}`') && copilot.includes('"off-the-job"') && copilot.includes('"assessment"'));
check("Platform Admin administration remains separated", admin.includes("if (!isPlatformAdmin) return <EmployerGuidanceCentre />") && admin.includes("GuidanceSourceRegistry"));
check("Platform Admin navigation is explicitly administrative", policy.includes('item("Knowledge", "Guidance Administration", "secondary", "secondary", "supporting")'));
check("employer surface excludes internal terminology", !/source registry|source status|Copilot approved|ingestion|review state|source type ID|grounding|confidence score/i.test(component));
console.log(JSON.stringify({ ok: true, checksPassed: checks.length, topics: requiredTopics.length }, null, 2));
