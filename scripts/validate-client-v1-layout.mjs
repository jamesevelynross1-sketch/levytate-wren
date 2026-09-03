import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const shell = read("components/levytate-mvp/LevyTateMvpApp.tsx");
const dashboard = read("components/levytate-mvp/DashboardSettingsModules.tsx");
const learners = read("components/levytate-mvp/LearnersModule.tsx");
const ui = read("components/levytate-mvp/MvpUi.tsx");
const copilot = read("components/levytate-mvp/PersistentCopilot.tsx");
const portfolio = read("components/levytate-mvp/EmployerPortfolioModules.tsx");

const checks = [];

check("application shell has an explicit shrinkable width boundary", shell.includes('data-testid="levytate-app-shell"') && shell.includes("min-h-screen w-full min-w-0"));
check("shell grid gives main content a minmax zero track", shell.includes("grid-cols-[minmax(0,1fr)]") && shell.includes("lg:grid-cols-[244px_minmax(0,1fr)]"));
check("main content is bounded without body-level overflow clipping", shell.includes('className="w-full min-w-0 max-w-full"') && !shell.includes("overflow-x-hidden"));
check("sidebar is fixed to the compact desktop track", shell.includes('data-testid="levytate-sidebar"') && shell.includes("lg:grid-cols-[244px_minmax(0,1fr)]"));
check("current role remains readable without truncation", shell.includes('data-testid="current-role"') && shell.includes("break-words") && !/data-testid="current-role"[^>]*truncate/.test(shell));
check("connection status uses a concise label", shell.includes('? "Connected" : "Limited mode"'));
check("Home columns opt out of equal-height stretching", dashboard.includes('data-testid="home-attention-grid"') && dashboard.includes("grid items-start gap-4"));
check("Home cards have independent shrinkable wrappers", ["home-urgent-card", "home-employee-card", "home-provider-card"].every((id) => dashboard.includes(`data-testid="${id}"`) && dashboard.includes("min-w-0 self-start")));
check("Home hero retains the compact operating brief", dashboard.includes('data-testid="home-attention-hero"') && dashboard.includes("p-4") && dashboard.includes("sm:p-5"));
check("Learners desktop table owns its horizontal scrolling", learners.includes('testId="learners-table-scroll"') && learners.includes('minimumWidthClass="min-w-[1040px]"') && ui.includes("max-w-full overflow-x-auto"));
check("Learners use mobile cards instead of the desktop table below 768px", learners.includes("hidden min-w-0 md:block") && learners.includes('data-testid="learners-mobile-list"') && learners.includes("md:hidden"));
check("learner desktop columns use deliberate proportions", ["w-[16%]", "w-[20%]", "w-[12%]", "w-[16%]", "w-[13%]", "w-[14%]", "w-[9%]"].every((width) => learners.includes(width)));
check("learner rows expose the density regression hook", learners.includes('data-testid="learner-row"') && learners.includes("px-3 py-2.5"));
check("lifecycle badges are bounded and compact", learners.includes('testId="learner-status-badge"') && ui.includes("inline-flex max-w-full items-center rounded-lg") && ui.includes("leading-4"));
check("learner row actions stay within the 36–40px visual target", learners.includes('testId="learner-open-record"') && ui.includes("min-h-9") && ui.includes("after:-inset-y-1"));
check("learner progress remains compact and information complete", learners.includes("% actual") && learners.includes("Target {learner.latestProgress.targetProgressPercentage}%") && learners.includes("h-1.5 rounded-full"));
check("review dates retain compact one-line labels", learners.includes("Provider ·") && learners.includes("L&amp;D ·"));
check("Copilot remains a fixed overlay with a viewport-bounded drawer", copilot.includes("fixed inset-y-0 right-0") && copilot.includes("sm:w-[min(400px,calc(100vw-3rem))]"));
check("blank employer portfolio states avoid artificial viewport filling", portfolio.includes("min-h-[280px]") && !portfolio.includes("min-h-[360px]"));

console.log(JSON.stringify({ ok: true, checksPassed: checks.length }, null, 2));

function check(label, condition) {
  if (!condition) throw new Error(`FAILED ${label}`);
  checks.push(label);
  console.log(`PASS ${label}`);
}
