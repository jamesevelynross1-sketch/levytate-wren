import type {
  DepartmentGuidance,
  EmployeeGuidance,
  LeadGuidance,
  LevyTateAiRequest,
  LevyTateAiResponse,
  LevyTateProviderMatchDraft,
  ManagerGuidance,
  PersonaSummary,
  RequestSummary,
} from "@/lib/levytate-ai/response-schema";

const activeApplicationStatuses = new Set([
  "Draft",
  "Submitted to Line Manager",
  "Awaiting Manager Review",
  "Approved by Line Manager",
  "Submitted to Apprenticeship Lead",
  "Awaiting Final Approval",
  "Approved for Enrolment",
]);

const currentManagerName = "Ryan Booth";

const advisoryMappings: Record<string, LeadGuidance> = {
  maintenance: {
    interpretedRole: "Maintenance Manager",
    workforceNeed: "Technical leadership, maintenance planning, compliance, team supervision and operational improvement.",
    recommendedStandards: [
      { name: "Engineering Technician", level: "Level 3", suitability: 88, why: "Strong fit for technical maintenance capability and engineering competence.", bestFor: "Maintenance capability and engineering evidence.", delivery: "Site evidence, technical workshops and workplace projects." },
      { name: "Operations Manager", level: "Level 5", suitability: 82, why: "Strong fit where the role includes people management, planning and operational accountability.", bestFor: "Maintenance leaders with wider operational ownership.", delivery: "Blended management workshops and business improvement activity." },
      { name: "Improvement Practitioner", level: "Level 4", suitability: 76, why: "Useful where the business wants process improvement and productivity gains.", bestFor: "Maintenance process, downtime and productivity projects.", delivery: "Project-based improvement coaching." },
    ],
    alternativeStandards: ["Level 3 Team Leader", "Level 4 Associate Project Manager"],
    businessRationale: "For a Maintenance Manager, the strongest route depends on whether the priority is technical depth, leadership capability or operational improvement. If the individual already has strong technical skills, a management or improvement pathway may create greater business value.",
    fundingRoute: "Potentially funded through apprenticeship levy or co-investment, subject to eligibility and programme suitability.",
    providerMatchingPrompt: "Review provider fit for engineering delivery, site evidence, leadership coaching and operational improvement priorities.",
  },
  procurement: {
    interpretedRole: "Procurement Lead",
    workforceNeed: "Commercial capability, supplier performance, contract discipline, negotiation and succession readiness.",
    recommendedStandards: [
      { name: "Commercial Procurement and Supply", level: "Level 4", suitability: 92, why: "Direct fit for procurement practice, supplier management and commercial decision making.", bestFor: "Procurement leads and emerging category owners.", delivery: "Blended commercial workshops with live procurement evidence." },
      { name: "Senior Procurement and Supply Chain Professional", level: "Level 6", suitability: 84, why: "Suitable for senior progression where strategic procurement ownership is expected.", bestFor: "Succession planning for senior procurement roles.", delivery: "Longer strategic programme with work-based commercial projects." },
      { name: "Operations Manager", level: "Level 5", suitability: 78, why: "Useful where procurement leadership is linked to wider operational accountability.", bestFor: "Procurement leads moving into broader business leadership.", delivery: "Blended leadership and operational planning." },
    ],
    alternativeStandards: ["Level 3 Procurement and Supply Assistant", "Level 4 Business Analyst"],
    businessRationale: "For procurement succession, LevyTate would usually separate technical procurement capability from broader leadership readiness. The strongest match depends on whether the priority is category expertise, contract discipline or progression into senior operational leadership.",
    fundingRoute: "Potentially levy-funded or supported through co-investment, subject to learner eligibility and the selected standard.",
    providerMatchingPrompt: "Identify providers with procurement depth, commercial tutor strength and delivery models suited to Portakabin locations.",
  },
  customerai: {
    interpretedRole: "Customer Service AI Capability",
    workforceNeed: "Future AI awareness, data confidence, customer insight, automation opportunities and service improvement.",
    recommendedStandards: [
      { name: "Data Technician", level: "Level 3", suitability: 86, why: "Builds practical data handling and reporting confidence for customer service teams.", bestFor: "Customer colleagues starting with data and automation.", delivery: "Remote workshops with customer service data projects." },
      { name: "Data Analyst", level: "Level 4", suitability: 82, why: "Supports stronger insight generation, trend analysis and service performance reporting.", bestFor: "Customer insight and reporting roles.", delivery: "Applied analytics projects and portfolio evidence." },
      { name: "Business Analyst", level: "Level 4", suitability: 80, why: "Useful where the team needs to redesign processes and improve systems adoption.", bestFor: "Service improvement and systems change.", delivery: "Workshops, stakeholder discovery and change documentation." },
      { name: "AI and Automation Workforce Programme", level: "Workforce programme", suitability: 78, why: "Helps teams understand AI use cases and automation opportunities before formal apprenticeship demand is confirmed.", bestFor: "Early-stage AI capability building.", delivery: "Short strategic capability sprint and opportunity mapping." },
    ],
    alternativeStandards: ["Level 3 Team Leader", "Level 4 Improvement Practitioner"],
    businessRationale: "For customer service AI capability, the best route depends on whether the immediate priority is data literacy, workflow automation or service process redesign. A staged approach may create stronger adoption before committing to a single cohort.",
    fundingRoute: "Apprenticeship elements may be potentially levy-funded or co-invested, subject to eligibility. Non-apprenticeship workforce programmes would need separate commercial review.",
    providerMatchingPrompt: "Review providers with data, business analysis and AI readiness capability, with delivery suited to customer operations.",
  },
  site: {
    interpretedRole: "Site Supervisor",
    workforceNeed: "Team leadership, site coordination, construction supervision, operational accountability and project handover discipline.",
    recommendedStandards: [
      { name: "Team Leader", level: "Level 3", suitability: 90, why: "Strong fit for first-line people leadership, performance routines and team coordination.", bestFor: "New or emerging site supervisors.", delivery: "Blended workshops with live team improvement activity." },
      { name: "Construction Site Supervisor", level: "Level 4", suitability: 86, why: "Direct fit where site compliance, supervision and handover control are key.", bestFor: "Supervisors in construction or installation environments.", delivery: "Site evidence, technical supervision and compliance activity." },
      { name: "Operations Manager", level: "Level 5", suitability: 79, why: "Appropriate where the role includes wider planning, resource control and operational ownership.", bestFor: "Experienced supervisors progressing into operations management.", delivery: "Leadership coaching and operational improvement projects." },
    ],
    alternativeStandards: ["Level 4 Associate Project Manager", "Level 4 Improvement Practitioner"],
    businessRationale: "For Site Supervisors, the right pathway depends on whether the gap is first-line leadership, construction supervision or wider operational control. A mixed cohort may be useful if supervisor experience levels vary.",
    fundingRoute: "Potentially funded through apprenticeship levy or co-investment, subject to eligibility and programme suitability.",
    providerMatchingPrompt: "Match providers with site supervision credibility, regional coverage and flexible delivery for operational teams.",
  },
  operationsdata: {
    interpretedRole: "Operations Data Skills",
    workforceNeed: "Operational reporting, planning insight, workflow analysis, data quality and evidence-led decision making.",
    recommendedStandards: [
      { name: "Data Technician", level: "Level 3", suitability: 89, why: "Strong entry route for operational colleagues building reporting and data handling skills.", bestFor: "Operations teams starting with dashboards and data quality.", delivery: "Remote workshops with applied internal datasets." },
      { name: "Data Analyst", level: "Level 4", suitability: 84, why: "Supports deeper insight, operational trend analysis and performance reporting.", bestFor: "Analysts and coordinators supporting capacity planning.", delivery: "Applied analytics with workplace projects." },
      { name: "Business Analyst", level: "Level 4", suitability: 78, why: "Useful when data skills need to translate into systems improvement and process change.", bestFor: "Operations improvement and workflow redesign.", delivery: "Stakeholder discovery and process mapping evidence." },
    ],
    alternativeStandards: ["Level 4 Improvement Practitioner", "Level 5 Operations Manager"],
    businessRationale: "For operations data capability, LevyTate would normally separate foundational data skills from process improvement and operating model change. The recommendation depends on whether the immediate need is reporting accuracy, insight capability or workflow redesign.",
    fundingRoute: "Potentially levy-funded or co-invested where apprenticeship eligibility and role relevance are confirmed.",
    providerMatchingPrompt: "Shortlist providers with data delivery strength, operational project experience and flexible workshop models.",
  },
  default: {
    interpretedRole: "Workforce Capability Need",
    workforceNeed: "Role capability, future skills, progression planning and programme fit review.",
    recommendedStandards: [
      { name: "Team Leader", level: "Level 3", suitability: 78, why: "Relevant where the requirement includes first-line leadership or progression readiness.", bestFor: "Emerging managers and supervisors.", delivery: "Blended workshops with workplace leadership evidence." },
      { name: "Business Analyst", level: "Level 4", suitability: 74, why: "Useful where the need includes systems, process or change analysis.", bestFor: "Operational change and service improvement roles.", delivery: "Applied business analysis projects." },
      { name: "Operations Manager", level: "Level 5", suitability: 72, why: "Suitable where the requirement includes accountability for teams, planning or delivery outcomes.", bestFor: "Experienced leaders with wider operational ownership.", delivery: "Leadership coaching and strategic improvement work." },
    ],
    alternativeStandards: ["Level 3 Data Technician", "Level 4 Improvement Practitioner"],
    businessRationale: "The requirement needs a programme fit review to confirm whether the priority is leadership, technical capability, data confidence or operational improvement. LevyTate can qualify the need before provider matching.",
    fundingRoute: "Potentially funded through apprenticeship levy or co-investment, subject to eligibility and programme suitability.",
    providerMatchingPrompt: "Submit the requirement for LevyTate review so provider fit can be assessed against role, site, delivery model and employer priorities.",
  },
};

function activeApplicationFor(requests: RequestSummary[], employeeName?: string) {
  if (!employeeName) return undefined;
  return requests.find((request) => request.name === employeeName && activeApplicationStatuses.has(request.status));
}

function getEmployeeGuidance(prompt: string, persona: PersonaSummary): EmployeeGuidance {
  const normalised = prompt.toLowerCase();
  const isDaniel = persona.name === "Daniel Carter";
  const wantsAI = normalised.includes("ai") || normalised.includes("automation");

  if (isDaniel && wantsAI) {
    return {
      primary: {
        programme: "AI & Automation Workforce Programme",
        pathway: "Digital, Data & AI",
        provider: "QA",
        fit: 94,
        why: "This route supports practical AI adoption, automation opportunities and data-enabled process improvement.",
        draftReason: "I am interested in the AI & Automation Workforce Programme because I want to build practical confidence using AI and automation to improve reporting workflows, reduce manual tasks and support data-enabled process improvement.",
      },
      alternatives: [
        { programme: "Level 4 Data Analyst", fit: 91, why: "Best fit for deeper analysis, insight generation and data storytelling." },
        { programme: "Level 3 Data Technician", fit: 86, why: "A practical route for strengthening data handling and dashboard confidence." },
        { programme: "Level 4 Business Analyst", fit: 84, why: "Useful if Daniel wants to connect systems, process change and business requirements." },
      ],
      supportRequired: "Protected time for AI use case discovery, portfolio evidence and internal reporting projects.",
    };
  }

  if (isDaniel) {
    return {
      primary: {
        programme: "Level 4 Data Analyst",
        pathway: "Digital, Data & AI",
        provider: "QA",
        fit: 92,
        why: "This pathway supports Daniel's progression into senior data, insight and automation leadership.",
        draftReason: "I am interested in the Level 4 Data Analyst pathway because I want to deepen my analysis, insight generation and data storytelling skills while progressing toward Head of Data & Automation.",
      },
      alternatives: [
        { programme: "Level 3 Data Technician", fit: 86, why: "Supports practical data foundations and reporting confidence." },
        { programme: "Level 4 Business Analyst", fit: 84, why: "Supports process improvement and systems change capability." },
        { programme: "AI & Automation Workforce Programme", fit: 82, why: "Supports practical AI adoption and automation opportunity discovery." },
      ],
      supportRequired: "Protected time for portfolio evidence and internal reporting projects.",
    };
  }

  return {
    primary: {
      programme: "Level 3 Team Leader",
      pathway: "Leadership & Management",
      provider: "Babington",
      fit: 93,
      why: "This pathway supports Amelia's progression into team leadership, shift coordination and production supervision.",
      draftReason: "I am interested in the Level 3 Team Leader pathway because I would like to progress from Production Team Member into a Production Supervisor or Team Leader role. I want to build confidence in leadership, communication and coordinating work across the team.",
    },
    alternatives: [
      { programme: "Level 3 Engineering Technician", fit: 88, why: "This supports stronger technical capability in a manufacturing environment." },
      { programme: "Level 3 Engineering Maintenance Technician", fit: 82, why: "A suitable technical route if Amelia wants to move toward maintenance and fault finding." },
    ],
    supportRequired: "Support with study time and evidence collection.",
  };
}

function getManagerGuidance(prompt: string, requests: RequestSummary[]): ManagerGuidance {
  const pending = requests.filter((request) => request.status === "Submitted to Line Manager" || request.status === "Awaiting Manager Review");
  const normalised = prompt.toLowerCase();
  const target = pending.find((request) => normalised.includes(request.name.split(" ")[0].toLowerCase())) ?? pending[0];

  if (normalised.includes("skills gap")) {
    return {
      title: "Team skills gap summary",
      summary: "The clearest team development priorities are leadership readiness, technical evidence quality and data confidence. LevyTate recommends using Level 3 Team Leader for emerging supervisors and Level 3 Engineering Technician for technical manufacturing progression.",
      signals: [["Priority gap", "Leadership readiness"], ["Suggested cohort", "Production leadership"], ["Business benefit", "Better handovers and quality routines"]],
    };
  }

  return {
    title: target ? `Review guidance for ${target.name}` : "Manager review guidance",
    summary: target ? `${target.name}'s application appears suitable because the selected programme aligns to their role, career goal and business benefit. Review study time, evidence access and coverage before approving.` : "There are no manager approvals in the current filtered view. Review team skills gaps or seed a new application for the presentation.",
    signals: [["Application", target?.pathway ?? "None awaiting review"], ["Current approver", target?.manager ?? "No action"], ["Suggested decision", target ? "Approve if workload can support study time" : "No approval needed"]],
  };
}

function getDepartmentGuidance(prompt: string, requests: RequestSummary[]): DepartmentGuidance {
  const normalised = prompt.toLowerCase();
  const pending = requests.filter((request) => request.status === "Submitted to Line Manager" || request.status === "Awaiting Manager Review" || request.status === "Approved by Line Manager" || request.status === "Submitted to Apprenticeship Lead" || request.status === "Awaiting Final Approval").length;

  if (normalised.includes("site")) {
    return {
      title: "Site participation comparison",
      summary: "York and Leeds show stronger apprenticeship activity, while several visitor centres have low participation. The next workforce plan should focus on consistent site adoption, especially for customer experience, site operations and supply chain roles.",
      signals: [["Lowest participation", "Smaller visitor centres"], ["Pending demand", String(pending)], ["Action", "Review site breakdown"]],
    };
  }

  if (normalised.includes("future") || normalised.includes("risk")) {
    return {
      title: "Future skills risk summary",
      summary: "The main future skills risks are leadership pipeline, data confidence, technical manufacturing evidence and site supervision. Apprenticeship demand should be planned by department and site before the next intake window.",
      signals: [["Skills risks", "4"], ["Highest priority", "Leadership pipeline"], ["Planning horizon", "Next quarter"]],
    };
  }

  return {
    title: "Department participation insight",
    summary: "Department participation is improving, with active learners across manufacturing, site operations, customer experience and digital roles. Department Heads can use this view for workforce planning only, with no individual approval actions.",
    signals: [["Participation", "18%"], ["Active learners", "27"], ["Pending applications", String(pending)]],
  };
}

function getLeadGuidance(query: string): LeadGuidance {
  const normalised = query.toLowerCase();
  if (normalised.includes("maintenance")) return advisoryMappings.maintenance;
  if (normalised.includes("procurement") || normalised.includes("supply")) return advisoryMappings.procurement;
  if ((normalised.includes("customer") && (normalised.includes("ai") || normalised.includes("automation"))) || normalised.includes("service team")) return advisoryMappings.customerai;
  if (normalised.includes("site supervisor") || normalised.includes("site supervisors")) return advisoryMappings.site;
  if ((normalised.includes("data") && normalised.includes("operations")) || normalised.includes("operational data")) return advisoryMappings.operationsdata;
  return advisoryMappings.default;
}

function employeeAssistantMessage(persona: PersonaSummary, guidance: EmployeeGuidance, activeApplication?: RequestSummary) {
  if (activeApplication) {
    return `${persona.name.split(" ")[0]}, your current apprenticeship application is already active, so LevyTate is keeping you on one clear route. The strongest approved next fit remains ${guidance.primary.programme}, and you can use this workspace to understand why it suits your role while tracking ${activeApplication.manager}'s review.`;
  }

  return `${persona.name.split(" ")[0]}, based on your current role as ${persona.role} and your goal of ${persona.careerGoal}, the strongest approved pathway is ${guidance.primary.programme}. It gives you the clearest next step inside Portakabin without opening multiple competing requests.`;
}

function managerAssistantMessage(guidance: ManagerGuidance, pendingCount: number) {
  return `${guidance.summary} There ${pendingCount === 1 ? "is" : "are"} currently ${pendingCount} team application${pendingCount === 1 ? "" : "s"} awaiting review, so the priority is to make a clear decision and keep team development moving.`;
}

function departmentAssistantMessage(guidance: DepartmentGuidance) {
  return `${guidance.summary} LevyTate is using this role to explain workforce signals, not to route individual approvals, so the next step is to turn the pattern into a department action plan.`;
}

function leadAssistantMessage(guidance: LeadGuidance) {
  const firstStandard = guidance.recommendedStandards[0];
  return `LevyTate has interpreted this as a ${guidance.interpretedRole} capability question. The strongest current fit is ${firstStandard.level} ${firstStandard.name}, with provider matching available through the LevyTate Team if you want to progress this into a scoped request.`;
}

function providerMatchDraftFromLeadGuidance(guidance: LeadGuidance): LevyTateProviderMatchDraft {
  const firstStandard = guidance.recommendedStandards[0];
  return {
    roleFamily: guidance.interpretedRole,
    recommendedStandard: `${firstStandard.level} ${firstStandard.name}`,
    rationale: guidance.businessRationale,
    fundingRoute: guidance.fundingRoute,
    notes: guidance.providerMatchingPrompt,
  };
}

function employeeRecommendedPathways(guidance: EmployeeGuidance) {
  return [
    {
      title: guidance.primary.programme,
      reason: guidance.primary.why,
      availability: "approved" as const,
      fit: guidance.primary.fit,
      provider: guidance.primary.provider,
      pathway: guidance.primary.pathway,
    },
    ...guidance.alternatives.map((item) => ({
      title: item.programme,
      reason: item.why,
      availability: "alternative" as const,
      fit: item.fit,
    })),
  ];
}

function leadRecommendedPathways(guidance: LeadGuidance) {
  return guidance.recommendedStandards.map((standard) => ({
    title: `${standard.level} ${standard.name}`,
    reason: standard.why,
    availability: "approved" as const,
    fit: standard.suitability,
    standard: standard.name,
  }));
}

export function buildFallbackResponse(request: LevyTateAiRequest): LevyTateAiResponse {
  const safeRequests = request.contextData?.requests ?? [];

  if (request.role === "Employee") {
    const persona = request.contextData?.selectedPersona ?? {
      name: request.selectedEmployee ?? "Employee",
      role: "Employee",
      department: "Operations",
      site: request.selectedSite,
      manager: currentManagerName,
      careerGoal: "Career progression",
      recommendedPathways: 1,
      savedOpportunities: 0,
      passportActivities: 0,
    };
    const activeApplication = request.contextData?.activeApplication ?? activeApplicationFor(safeRequests, persona.name);
    const guidance = getEmployeeGuidance(request.userMessage, persona);

    return {
      source: "mock",
      assistantMessage: employeeAssistantMessage(persona, guidance, activeApplication),
      recommendedActions: activeApplication
        ? [{ label: "View My Application", type: "open_my_applications", target: "My Applications" }]
        : [
            { label: "View pathway", type: "open_pathway", target: guidance.primary.programme },
            { label: "Start Application", type: "start_application", target: guidance.primary.programme },
          ],
      recommendedPathways: employeeRecommendedPathways(guidance),
      applicationPrefill: activeApplication
        ? null
        : {
            selectedApprenticeship: guidance.primary.programme,
            reasonForInterest: guidance.primary.draftReason,
            careerGoal: persona.careerGoal,
            supportRequired: guidance.supportRequired,
          },
      providerMatchDraft: null,
      nextStep: activeApplication ? "open_my_applications" : "start_application",
      safetyNotes: activeApplication
        ? ["You already have an active apprenticeship application in progress. You can track this in My Applications."]
        : ["Employees may only have one active apprenticeship application at a time."],
      employeeGuidance: guidance,
    };
  }

  if (request.role === "Line Manager") {
    const teamRequests = safeRequests.filter((item) => item.manager === currentManagerName);
    const pending = teamRequests.filter((item) => item.status === "Submitted to Line Manager" || item.status === "Awaiting Manager Review");
    const guidance = getManagerGuidance(request.userMessage, teamRequests);
    return {
      source: "mock",
      assistantMessage: managerAssistantMessage(guidance, pending.length),
      recommendedActions: [
        { label: "Review Applications", type: "open_review_queue", target: "Applications to Review" },
        { label: "Open Team Development", type: "open_team_development", target: "Team Development" },
      ],
      recommendedPathways: [],
      applicationPrefill: null,
      providerMatchDraft: null,
      nextStep: "open_review_queue",
      safetyNotes: ["Manager guidance supports review decisions but does not approve applications automatically."],
      managerGuidance: guidance,
    };
  }

  if (request.role === "Department Head") {
    const guidance = getDepartmentGuidance(request.userMessage, safeRequests);
    return {
      source: "mock",
      assistantMessage: departmentAssistantMessage(guidance),
      recommendedActions: [
        { label: "View Department Analytics", type: "open_department_analytics", target: "Department Analytics" },
        { label: "View Site Breakdown", type: "open_site_breakdown", target: "Site Breakdown" },
      ],
      recommendedPathways: [],
      applicationPrefill: null,
      providerMatchDraft: null,
      nextStep: "open_department_analytics",
      safetyNotes: ["Department Head access is analytics-only. No approval actions are available in this role."],
      departmentGuidance: guidance,
    };
  }

  const guidance = getLeadGuidance(request.userMessage);
  return {
    source: "mock",
    assistantMessage: leadAssistantMessage(guidance),
    recommendedActions: [
      { label: "Review Final Approvals", type: "open_final_approvals", target: "Applications for Final Approval" },
      { label: "Request Provider Matching", type: "request_provider_matching", target: guidance.recommendedStandards[0]?.name },
    ],
    recommendedPathways: leadRecommendedPathways(guidance),
    applicationPrefill: null,
    providerMatchDraft: providerMatchDraftFromLeadGuidance(guidance),
    nextStep: "request_provider_matching",
    safetyNotes: [
      "Provider matching is routed to the LevyTate Team, not exposed as an employee marketplace.",
      "Funding language should remain potentially levy-funded or potentially funded through levy/co-investment.",
    ],
    leadGuidance: guidance,
  };
}
