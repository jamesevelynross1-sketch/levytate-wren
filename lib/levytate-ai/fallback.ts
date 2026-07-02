import type {
  DepartmentGuidance,
  EmployeeGuidance,
  EmployeeIntent,
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

function classifyEmployeeIntent(prompt: string): EmployeeIntent {
  const normalised = prompt.toLowerCase();

  if (normalised.includes("compare") || normalised.includes("versus") || normalised.includes(" vs ")) return "compare_routes";
  if (
    normalised.includes("my manager") ||
    normalised.includes("line manager") ||
    normalised.includes("conversation") ||
    normalised.includes("talk to")
  ) return "manager_conversation";
  if (normalised.includes("apply") || normalised.includes("application") || normalised.includes("submit")) return "application_help";
  if (normalised.includes("change") || normalised.includes("different") || normalised.includes("changed my mind")) return "change_of_mind";
  if (normalised.includes("data") || normalised.includes("ai")) return "data_ai_interest";
  if (normalised.includes("automation") || normalised.includes("automate")) return "automation_interest";
  if (normalised.includes("manager") || normalised.includes("management") || normalised.includes("leader") || normalised.includes("supervisor")) return "management_interest";
  if (normalised.includes("what is") || normalised.includes("explain") || normalised.includes("mean")) return "pathway_explanation";
  if (normalised.includes("career") || normalised.includes("progress") || normalised.includes("future")) return "career_exploration";

  return "general_support";
}

const advisoryMappings: Record<string, LeadGuidance> = {
  maintenance: {
    interpretedRole: "Maintenance Manager",
    workforceNeed: "Technical leadership, maintenance planning, compliance, team supervision and operational improvement.",
    recommendedStandards: [
      { name: "Engineering Technician", level: "Level 3", suitability: 88, why: "Strong fit for technical maintenance capability and engineering competence.", bestFor: "Maintenance capability and engineering evidence.", delivery: "Site evidence, technical workshops and workplace projects." },
      { name: "Associate Project Manager", level: "Level 4", suitability: 82, why: "Strong fit where the role includes technical planning, work packages and delivery coordination.", bestFor: "Maintenance leaders with project and reliability ownership.", delivery: "Hybrid project planning workshops and workplace delivery evidence." },
      { name: "Improvement Practitioner", level: "Level 4", suitability: 76, why: "Useful where the business wants process improvement and productivity gains.", bestFor: "Maintenance process, downtime and productivity projects.", delivery: "Project-based improvement coaching." },
    ],
    alternativeStandards: ["Level 4 Improvement Practitioner", "Level 4 Associate Project Manager"],
    businessRationale: "For a Maintenance Manager, the strongest route depends on whether the priority is technical depth, leadership capability or operational improvement. If the individual already has strong technical skills, a management or improvement pathway may create greater business value.",
    fundingRoute: "Potentially funded through apprenticeship levy or co-investment, subject to eligibility and programme suitability.",
    providerMatchingPrompt: "Review provider fit for engineering delivery, site evidence, leadership coaching and operational improvement priorities.",
    programmeMatch: {
      providerName: "RHG Consult",
      programmeName: "Operational Improvement and Sustainability",
      linkedStandard: "Level 4 Improvement Practitioner",
      matchScore: 91,
      verificationStatus: "Needs manual verification",
      whyProgramme: "It frames the need as operational improvement, sustainability and cross-functional delivery rather than a generic engineering course.",
    },
  },
  procurement: {
    interpretedRole: "Procurement Lead",
    workforceNeed: "Commercial capability, supplier performance, contract discipline, negotiation and succession readiness.",
    recommendedStandards: [
      { name: "Commercial Procurement and Supply", level: "Level 4", suitability: 92, why: "Direct fit for procurement practice, supplier management and commercial decision making.", bestFor: "Procurement leads and emerging category owners.", delivery: "Blended commercial workshops with live procurement evidence." },
      { name: "Senior Procurement and Supply Chain Professional", level: "Level 6", suitability: 84, why: "Suitable for senior progression where strategic procurement ownership is expected.", bestFor: "Succession planning for senior procurement roles.", delivery: "Longer strategic programme with work-based commercial projects." },
      { name: "Business Analyst", level: "Level 4", suitability: 78, why: "Useful where procurement leadership is linked to process change, stakeholder insight and systems improvement.", bestFor: "Procurement leads improving commercial processes and supplier workflows.", delivery: "Applied business analysis projects with stakeholder evidence." },
    ],
    alternativeStandards: ["Level 3 Procurement and Supply Assistant", "Level 4 Business Analyst"],
    businessRationale: "For procurement succession, LevyTate would usually separate technical procurement capability from broader supervisory readiness. The strongest match depends on whether the priority is category expertise, contract discipline or progression into senior operational leadership.",
    fundingRoute: "Potentially levy-funded or supported through co-investment, subject to learner eligibility and the selected standard.",
    providerMatchingPrompt: "Identify providers with procurement depth, commercial tutor strength and delivery models suited to Portakabin locations.",
    programmeMatch: {
      providerName: "SRSCC",
      programmeName: "Commercial Procurement and Supply Excellence",
      linkedStandard: "Level 4 Commercial procurement and supply",
      matchScore: 94,
      verificationStatus: "Needs manual verification",
      whyProgramme: "It is built around sourcing, supplier governance and commercial confidence for procurement-led workforce needs.",
    },
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
    alternativeStandards: ["Level 3 Business Administrator", "Level 4 Improvement Practitioner"],
    businessRationale: "For customer service AI capability, the best route depends on whether the immediate priority is data literacy, workflow automation or service process redesign. A staged approach may create stronger adoption before committing to a single cohort.",
    fundingRoute: "Apprenticeship elements may be potentially levy-funded or co-invested, subject to eligibility. Non-apprenticeship workforce programmes would need separate commercial review.",
    providerMatchingPrompt: "Review providers with data, business analysis and AI readiness capability, with delivery suited to customer operations.",
    programmeMatch: {
      providerName: "AiCore",
      programmeName: "AI Adoption and Workflow Enablement",
      linkedStandard: "Level 3 Data Technician",
      matchScore: 88,
      verificationStatus: "Needs manual verification",
      whyProgramme: "It focuses on practical AI adoption, prompting and workflow redesign for customer and service operations.",
    },
  },
  site: {
    interpretedRole: "Site Supervisor",
    workforceNeed: "Colleague coordination, site readiness, construction supervision, operational accountability and project handover discipline.",
    recommendedStandards: [
      { name: "Construction Site Supervisor", level: "Level 3", suitability: 90, why: "Direct fit for first-line site coordination, quality checks and handover control.", bestFor: "New or emerging site supervisors.", delivery: "Field evidence, site supervision tasks and compliance activity." },
      { name: "Associate Project Manager", level: "Level 4", suitability: 86, why: "Strong fit where site supervision includes planning, stakeholder coordination and delivery control.", bestFor: "Supervisors moving into project delivery responsibility.", delivery: "Project evidence, risk planning and stakeholder coordination." },
      { name: "Improvement Practitioner", level: "Level 4", suitability: 79, why: "Appropriate where the role includes improving site routines, productivity and operational handovers.", bestFor: "Experienced supervisors progressing through operational improvement.", delivery: "Improvement coaching and workplace projects." },
    ],
    alternativeStandards: ["Level 4 Associate Project Manager", "Level 4 Improvement Practitioner"],
    businessRationale: "For Site Supervisors, the right pathway depends on whether the gap is first-line leadership, construction supervision or wider operational control. A mixed cohort may be useful if supervisor experience levels vary.",
    fundingRoute: "Potentially funded through apprenticeship levy or co-investment, subject to eligibility and programme suitability.",
    providerMatchingPrompt: "Match providers with site supervision credibility, regional coverage and flexible delivery for operational teams.",
    programmeMatch: {
      providerName: "Learning Skills Partnership",
      programmeName: "Construction Site Operations",
      linkedStandard: "Level 4 Construction site supervisor",
      matchScore: 90,
      verificationStatus: "Needs manual verification",
      whyProgramme: "It is designed for site supervision, field operations and stronger operational compliance across delivery teams.",
    },
  },
  operationsdata: {
    interpretedRole: "Operations Data Skills",
    workforceNeed: "Operational reporting, planning insight, workflow analysis, data quality and evidence-led decision making.",
    recommendedStandards: [
      { name: "Data Technician", level: "Level 3", suitability: 89, why: "Strong entry route for operational colleagues building reporting and data handling skills.", bestFor: "Operations teams starting with dashboards and data quality.", delivery: "Remote workshops with applied internal datasets." },
      { name: "Data Analyst", level: "Level 4", suitability: 84, why: "Supports deeper insight, operational trend analysis and performance reporting.", bestFor: "Analysts and coordinators supporting capacity planning.", delivery: "Applied analytics with workplace projects." },
      { name: "Business Analyst", level: "Level 4", suitability: 78, why: "Useful when data skills need to translate into systems improvement and process change.", bestFor: "Operations improvement and workflow redesign.", delivery: "Stakeholder discovery and process mapping evidence." },
    ],
    alternativeStandards: ["Level 4 Improvement Practitioner", "Level 4 Business Analyst"],
    businessRationale: "For operations data capability, LevyTate would normally separate foundational data skills from process improvement and operating model change. The recommendation depends on whether the immediate need is reporting accuracy, insight capability or workflow redesign.",
    fundingRoute: "Potentially levy-funded or co-invested where apprenticeship eligibility and role relevance are confirmed.",
    providerMatchingPrompt: "Shortlist providers with data delivery strength, operational project experience and flexible workshop models.",
    programmeMatch: {
      providerName: "QA",
      programmeName: "Data Foundations Accelerator",
      linkedStandard: "Level 4 Data analyst",
      matchScore: 92,
      verificationStatus: "Verified from provider website",
      whyProgramme: "It directly targets reporting confidence, dashboard fluency and cleaner operational data handling.",
    },
  },
  default: {
    interpretedRole: "Workforce Capability Need",
    workforceNeed: "Role capability, future skills, progression planning and programme fit review.",
    recommendedStandards: [
      { name: "Improvement Practitioner", level: "Level 4", suitability: 78, why: "Relevant where the requirement includes practical supervision, problem solving and operational change.", bestFor: "Emerging supervisors building management-level capability through real work.", delivery: "Blended improvement workshops with workplace project evidence." },
      { name: "Business Analyst", level: "Level 4", suitability: 74, why: "Useful where the need includes systems, process or change analysis.", bestFor: "Operational change and service improvement roles.", delivery: "Applied business analysis projects." },
      { name: "Associate Project Manager", level: "Level 4", suitability: 72, why: "Suitable where the requirement includes planning, stakeholders and delivery accountability.", bestFor: "Experienced colleagues moving into coordinated delivery ownership.", delivery: "Project planning, risk and stakeholder evidence." },
    ],
    alternativeStandards: ["Level 3 Data Technician", "Level 4 Improvement Practitioner"],
    businessRationale: "The requirement needs a programme fit review to confirm whether the priority is leadership, technical capability, data confidence or operational improvement. LevyTate can qualify the need before provider matching.",
    fundingRoute: "Potentially funded through apprenticeship levy or co-investment, subject to eligibility and programme suitability.",
    providerMatchingPrompt: "Submit the requirement for LevyTate review so provider fit can be assessed against role, site, delivery model and employer priorities.",
    programmeMatch: {
      providerName: "Baltic Apprenticeships",
      programmeName: "Data, Digital and Automation Pathway",
      linkedStandard: "Level 3 Data Technician",
      matchScore: 79,
      verificationStatus: "Needs manual verification",
      whyProgramme: "It gives LevyTate a programme-led starting point when the need spans digital capability, automation and modern operations support.",
    },
  },
};

function activeApplicationFor(requests: RequestSummary[], employeeName?: string) {
  if (!employeeName) return undefined;
  return requests.find((request) => request.name === employeeName && activeApplicationStatuses.has(request.status));
}

function getEmployeeGuidance(prompt: string, persona: PersonaSummary): EmployeeGuidance {
  const isDaniel = persona.name === "Daniel Carter";
  const intent = classifyEmployeeIntent(prompt);
  const wantsAI = intent === "data_ai_interest" || intent === "automation_interest";
  const wantsManagement = intent === "management_interest";

  if (isDaniel && wantsAI) {
    return {
      intent,
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
      availableNow: [
        { programme: "Level 4 Data Analyst", fit: 91, why: "Available now and already aligned to data, reporting and automation leadership." },
        { programme: "Level 3 Data Technician", fit: 86, why: "Useful for practical data foundations if Daniel wants a more hands-on route." },
      ],
      futureInterests: [
        { programme: "AI & Automation Workforce Programme", fit: 94, why: "Worth discussing as a future workforce programme alongside the current application." },
      ],
    };
  }

  if (isDaniel && wantsManagement) {
    return {
      intent,
      primary: {
        programme: "Level 4 Data Analyst",
        pathway: "Digital, Data & AI",
        provider: "QA",
        fit: 91,
        why: "This still supports a management route if Daniel wants to lead data, reporting or automation work rather than move into general people management straight away.",
        draftReason: "I am interested in the Level 4 Data Analyst pathway because I want to build the data leadership, insight and automation confidence needed for a future management role.",
      },
      alternatives: [
        { programme: "Level 4 Business Analyst", fit: 83, why: "Better if Daniel wants to manage process change, stakeholder needs and systems improvement." },
        { programme: "Level 6 Data Scientist", fit: 79, why: "Better if Daniel wants a future data management route with deeper analytics leadership." },
        { programme: "Level 4 Business Analyst", fit: 78, why: "Useful if the management route is linked to systems, process and change work." },
      ],
      supportRequired: "Protected time for portfolio evidence, leadership conversations and internal reporting projects.",
      availableNow: [
        { programme: "Level 4 Data Analyst", fit: 91, why: "Best if the goal is data leadership, reporting ownership or automation improvement." },
      ],
      futureInterests: [
        { programme: "Level 4 Business Analyst", fit: 83, why: "Worth discussing if Daniel wants a process, systems or stakeholder management route." },
        { programme: "Level 6 Data Scientist", fit: 79, why: "Worth discussing later if Daniel moves toward senior data leadership." },
      ],
    };
  }

  if (isDaniel) {
    return {
      intent,
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
      availableNow: [
        { programme: "Level 4 Data Analyst", fit: 92, why: "Available now and aligned to Daniel's current application and career goal." },
        { programme: "Level 4 Business Analyst", fit: 84, why: "Available as a related route for process and systems capability." },
      ],
      futureInterests: [
        { programme: "AI & Automation Workforce Programme", fit: 82, why: "Worth discussing as a future interest once the current application is resolved." },
      ],
    };
  }

  if (wantsAI) {
    return {
      intent,
      primary: {
        programme: "Level 3 Engineering Technician",
        pathway: "Manufacturing & Production",
        provider: "TEC Partnership",
        fit: 88,
        why: "Data and automation could still be relevant to Amelia's production role, especially if the goal is using better information to improve shift decisions, quality routines and team coordination.",
        draftReason: "I am interested in building confidence with data and automation because I want to understand how digital tools and better information can support production planning, improvement and future production supervision.",
      },
      alternatives: [
        { programme: "Level 3 Engineering Technician", fit: 86, why: "Available now if Amelia wants a more technical improvement and process understanding route." },
        { programme: "Level 3 Data Technician", fit: 74, why: "Worth discussing as a future route if the goal becomes more data-focused." },
        { programme: "AI & Automation Workforce Programme", fit: 72, why: "Worth discussing for future development or a short workforce capability conversation." },
      ],
      supportRequired: "Support with study time, evidence collection and a manager conversation about digital improvement opportunities in production.",
      availableNow: [
        { programme: "Level 3 Engineering Technician", fit: 88, why: "Available now if Amelia wants to use better production evidence to support future supervision." },
        { programme: "Level 3 Engineering Technician", fit: 86, why: "Available now if Amelia wants more technical improvement and process understanding." },
      ],
      futureInterests: [
        { programme: "Level 3 Data Technician", fit: 74, why: "Worth discussing if Amelia wants a more data-focused route later." },
        { programme: "AI & Automation Workforce Programme", fit: 72, why: "Worth discussing as a future development interest." },
        { programme: "Improvement Practitioner", fit: 70, why: "Worth discussing if the focus becomes process improvement or automation opportunities." },
      ],
    };
  }

  return {
    intent,
    primary: {
      programme: "Level 3 Engineering Technician",
      pathway: "Manufacturing & Production",
      provider: "TEC Partnership",
      fit: 93,
      why: "This pathway supports Amelia's progression into production supervision through stronger technical manufacturing evidence, quality routines and improvement confidence.",
      draftReason: "I am interested in the Level 3 Engineering Technician pathway because I would like to progress from Production Team Member into production supervision through stronger manufacturing knowledge, technical evidence, quality routines and improvement confidence.",
    },
    alternatives: [
      { programme: "Level 3 Engineering Technician", fit: 88, why: "This supports stronger technical capability in a manufacturing environment." },
      { programme: "Level 3 Engineering Maintenance Technician", fit: 82, why: "A suitable technical route if Amelia wants to move toward maintenance and fault finding." },
    ],
    supportRequired: "Support with study time and evidence collection.",
    availableNow: [
      { programme: "Level 3 Engineering Technician", fit: 93, why: "Available now and aligned to Amelia's production supervision goal." },
      { programme: "Level 3 Engineering Technician", fit: 88, why: "Available now if Amelia wants stronger technical manufacturing capability." },
    ],
    futureInterests: [
      { programme: "Improvement Practitioner", fit: 72, why: "Worth discussing later if Amelia wants to focus on process improvement." },
    ],
  };
}

function getManagerGuidance(prompt: string, requests: RequestSummary[]): ManagerGuidance {
  const pending = requests.filter((request) => request.status === "Submitted to Line Manager" || request.status === "Awaiting Manager Review");
  const normalised = prompt.toLowerCase();
  const target = pending.find((request) => normalised.includes(request.name.split(" ")[0].toLowerCase())) ?? pending[0];

  if (normalised.includes("skills gap")) {
    return {
      title: "Team skills gap summary",
      summary: "The clearest team development priorities are supervisory readiness, technical evidence quality and data confidence. LevyTate now recommends specialist routes such as Level 3 Engineering Technician and Level 4 Improvement Practitioner for emerging supervisors.",
      signals: [["Priority gap", "Supervisory readiness"], ["Suggested cohort", "Production supervision"], ["Business benefit", "Better handovers and quality routines"]],
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
      summary: "The main future skills risks are supervision pipeline, data confidence, technical manufacturing evidence and site supervision. Apprenticeship demand should be planned by department and site before the next intake window.",
      signals: [["Skills risks", "4"], ["Highest priority", "Supervision pipeline"], ["Planning horizon", "Next quarter"]],
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
  const firstName = persona.name.split(" ")[0];
  const activeBoundary = activeApplication
    ? ` You already have ${activeApplication.pathway} in progress, so you cannot submit a second application right now. We can still explore options, compare routes, save ideas for later and prepare a conversation with ${activeApplication.manager}.`
    : "";

  if (guidance.intent === "data_ai_interest" || guidance.intent === "automation_interest") {
    if (persona.name === "Daniel Carter") {
      return `Good question, ${firstName}. Data and automation is very close to your current direction. Your Level 4 Data Analyst route can support deeper reporting, insight and automation leadership, while an AI and automation interest is still worth saving for a future development conversation.${activeBoundary}`;
    }

    return `Good question, ${firstName}. Data and automation could still be relevant to your production role at Portakabin. It could mean using data to improve production planning, spotting automation opportunities on the shop floor, building confidence with digital tools, or moving toward a future improvement, improvement lead or data-focused role.${activeBoundary}`;
  }

  if (guidance.intent === "management_interest") {
    if (persona.name === "Daniel Carter") {
      return `That makes sense, ${firstName}. Your current Level 4 Data Analyst application could still support a management route if your future role is data leadership rather than broad people management. Because LevyTate starts by clarifying the specialist management context: people, operations, technical, project, commercial or data: people, operations, technical, project, commercial or data.${activeBoundary}`;
    }

    return `That makes sense, ${firstName}. A management route can grow from your production experience, but LevyTate now starts with the type of management you are moving into. For production supervision, a specialist manufacturing or improvement pathway is usually a better funded route than a broad management route.${activeBoundary}`;
  }

  if (guidance.intent === "change_of_mind") {
    return `Let's think that through, ${firstName}. Changing direction is fine to explore. The key is separating what you want to learn now from what you can apply for now, because LevyTate keeps one active application open at a time.${activeBoundary}`;
  }

  if (guidance.intent === "compare_routes") {
    return `Let's compare the routes, ${firstName}. The best choice depends on whether you want technical depth, leadership confidence, data capability or wider operational development.${activeBoundary}`;
  }

  if (guidance.intent === "manager_conversation") {
    return `A manager conversation is a good next step, ${firstName}. You can use LevyTate to turn your interest into a clear note about the role you want, the skills you want to build and how it could help the team.${activeBoundary}`;
  }

  if (activeApplication) {
    return `Let's explore this together, ${firstName}. ${guidance.primary.programme} is one relevant route for your current role and goal, but we can still look at alternatives and future interests while your current application is being reviewed by ${activeApplication.manager}.`;
  }

  return `Let's think this through, ${firstName}. Based on your current role as ${persona.role} and your goal of ${persona.careerGoal}, ${guidance.primary.programme} looks like a useful route to explore. We can compare it with alternatives before you decide whether to apply.`;
}

function managerAssistantMessage(guidance: ManagerGuidance, pendingCount: number) {
  return `${guidance.summary} There ${pendingCount === 1 ? "is" : "are"} currently ${pendingCount} team application${pendingCount === 1 ? "" : "s"} awaiting review, so the priority is to make a clear decision and keep team development moving.`;
}

function departmentAssistantMessage(guidance: DepartmentGuidance) {
  return `${guidance.summary} LevyTate is using this role to explain workforce signals, not to route individual approvals, so the next step is to turn the pattern into a department action plan.`;
}

function leadAssistantMessage(guidance: LeadGuidance) {
  const firstStandard = guidance.recommendedStandards[0];
  const programme = guidance.programmeMatch;

  if (programme) {
    return `LevyTate has interpreted this as a ${guidance.interpretedRole} capability question. The strongest programme-led fit right now is ${programme.providerName}'s ${programme.programmeName} at ${programme.matchScore}% match. ${programme.whyProgramme} It is mapped to ${programme.linkedStandard} for funding and compliance.`;
  }

  return `LevyTate has interpreted this as a ${guidance.interpretedRole} capability question. The strongest current fit is ${firstStandard.level} ${firstStandard.name}, with provider matching available through the LevyTate Team if you want to progress this into a scoped request.`;
}

function providerMatchDraftFromLeadGuidance(guidance: LeadGuidance): LevyTateProviderMatchDraft {
  const firstStandard = guidance.recommendedStandards[0];
  const programme = guidance.programmeMatch;
  return {
    roleFamily: guidance.interpretedRole,
    recommendedProgramme: programme?.programmeName ?? `${firstStandard.level} ${firstStandard.name}`,
    providerName: programme?.providerName ?? "LevyTate Team review",
    linkedStandard: programme?.linkedStandard ?? `${firstStandard.level} ${firstStandard.name}`,
    matchScore: programme?.matchScore ?? firstStandard.suitability,
    verificationStatus: programme?.verificationStatus ?? "Needs manual verification",
    rationale: guidance.businessRationale,
    fundingRoute: guidance.fundingRoute,
    notes: guidance.providerMatchingPrompt,
    recommendedStandard: `${firstStandard.level} ${firstStandard.name}`,
  };
}

function employeeManagerMessageDraft(persona: PersonaSummary, guidance: EmployeeGuidance, activeApplication?: RequestSummary) {
  if (guidance.intent === "data_ai_interest" || guidance.intent === "automation_interest") {
    return `Hi ${persona.manager}, I am interested in exploring how data, digital tools or automation could support my future development. Could we talk about whether this links to my current route or whether it is something to save for later?`;
  }

  if (guidance.intent === "management_interest") {
    return `Hi ${persona.manager}, I am interested in developing toward management. Could we talk about the type of management I am aiming for and whether my current specialist pathway supports that goal?`;
  }

  if (activeApplication) {
    return `Hi ${persona.manager}, I wanted to share why ${activeApplication.pathway} is important for my development. It aligns with my goal of ${persona.careerGoal} and would help me build stronger capability in my current role as ${persona.role}.`;
  }

  return `Hi ${persona.manager}, I would like to apply for ${guidance.primary.programme}. It fits my goal of ${persona.careerGoal} and would help me build stronger capability in my current role as ${persona.role}.`;
}

function employeeRecommendedPathways(guidance: EmployeeGuidance) {
  const futureInterestPathways = guidance.futureInterests?.map((item) => ({
    title: item.programme,
    reason: item.why,
    availability: "not_available" as const,
    fit: item.fit,
  })) ?? [];

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
    ...futureInterestPathways,
  ];
}

function employeeActions(guidance: EmployeeGuidance, activeApplication?: RequestSummary) {
  if (activeApplication) {
    if (guidance.intent === "data_ai_interest" || guidance.intent === "automation_interest") {
      return [
        { label: "Explore data and automation routes", type: "open_pathway" as const, target: "Digital, Data & AI" },
        { label: "Compare with my current application", type: "compare_routes" as const, target: activeApplication.pathway },
        { label: "Save this interest for later", type: "save_interest" as const, target: guidance.primary.programme },
        { label: "Prepare a message for my manager", type: "prepare_manager_message" as const, target: activeApplication.manager },
      ];
    }

    if (guidance.intent === "management_interest") {
      return [
        { label: "Compare routes", type: "compare_routes" as const, target: activeApplication.pathway },
        { label: "Prepare manager conversation", type: "prepare_manager_message" as const, target: activeApplication.manager },
        { label: "Save management interest", type: "save_interest" as const, target: guidance.primary.programme },
        { label: "View current application", type: "open_my_applications" as const, target: "My Applications" },
      ];
    }

    return [
      { label: "Compare routes", type: "compare_routes" as const, target: activeApplication.pathway },
      { label: "Save this interest", type: "save_interest" as const, target: guidance.primary.programme },
      { label: "Prepare manager note", type: "prepare_manager_message" as const, target: activeApplication.manager },
      { label: "View My Application", type: "open_my_applications" as const, target: "My Applications" },
    ];
  }

  return [
    { label: "View pathway", type: "open_pathway" as const, target: guidance.primary.programme },
    { label: "Compare routes", type: "compare_routes" as const, target: guidance.primary.programme },
    { label: "Start Application", type: "start_application" as const, target: guidance.primary.programme },
  ];
}

function leadRecommendedPathways(guidance: LeadGuidance) {
  if (guidance.programmeMatch) {
    return [{
      title: `${guidance.programmeMatch.programmeName} | ${guidance.programmeMatch.providerName}`,
      reason: `${guidance.programmeMatch.whyProgramme} Linked standard: ${guidance.programmeMatch.linkedStandard}.`,
      availability: guidance.programmeMatch.verificationStatus === "Verified from provider website" || guidance.programmeMatch.verificationStatus === "Provider confirmed" || guidance.programmeMatch.verificationStatus === "LevyTate reviewed" ? "approved" as const : "alternative" as const,
      fit: guidance.programmeMatch.matchScore,
      provider: guidance.programmeMatch.providerName,
      standard: guidance.programmeMatch.linkedStandard,
    }];
  }

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
    const applicationWarning = activeApplication
      ? "You have one active application in progress, so new submissions are paused. Exploration, comparison and manager conversations are still open."
      : null;

    return {
      source: "mock",
      assistantMessage: employeeAssistantMessage(persona, guidance, activeApplication),
      recommendedActions: employeeActions(guidance, activeApplication),
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
      safetyNotes: activeApplication && applicationWarning
        ? [applicationWarning]
        : ["Employees may only have one active apprenticeship application at a time."],
      applicationWarning,
      managerMessageDraft: employeeManagerMessageDraft(persona, guidance, activeApplication),
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
      applicationWarning: null,
      managerMessageDraft: null,
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
      applicationWarning: null,
      managerMessageDraft: null,
      departmentGuidance: guidance,
    };
  }

  const guidance = getLeadGuidance(request.userMessage);
  return {
    source: "mock",
    assistantMessage: leadAssistantMessage(guidance),
    recommendedActions: [
      { label: "Review Final Approvals", type: "open_final_approvals", target: "Applications for Final Approval" },
      { label: "Request Provider Matching", type: "request_provider_matching", target: guidance.programmeMatch?.programmeName ?? guidance.recommendedStandards[0]?.name },
    ],
    recommendedPathways: leadRecommendedPathways(guidance),
    applicationPrefill: null,
    providerMatchDraft: providerMatchDraftFromLeadGuidance(guidance),
    nextStep: "request_provider_matching",
    safetyNotes: [
      "Provider matching is routed to the LevyTate Team, not exposed as an employee marketplace.",
      "Funding language should remain potentially levy-funded or potentially funded through levy/co-investment.",
    ],
    applicationWarning: null,
    managerMessageDraft: null,
    leadGuidance: guidance,
  };
}

