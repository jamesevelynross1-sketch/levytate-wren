import {
  workforceAssessmentQuestions,
  type AssessmentAnswerValue,
} from "@/lib/levytate/assessments/framework";

export type AssessmentAnswerMap = Record<string, AssessmentAnswerValue>;
export type DevelopmentRoute = "investigate_apprenticeship" | "focused_training" | "mentoring" | "workplace_project" | "tooling_or_process_improvement" | "no_immediate_action";

export type WorkforceAssessmentResult = {
  strengths: string[];
  developmentNeeds: string[];
  practicalOpportunity: string;
  workplaceConstraints: string[];
  possibleRoutes: Array<{ route: DevelopmentRoute; label: string; rationale: string }>;
  discussionPoints: string[];
  evidenceDomains: Array<{ domain: "technical" | "non_technical" | "responsible_ethical"; answered: number; relevant: number }>;
  disclaimer: string;
};

const independent = new Set(["independent"]);
const development = new Set(["with_support", "developing", "not_yet", "not_sure"]);

export function validateAssessmentAnswers(answers: AssessmentAnswerMap) {
  const unknown = Object.keys(answers).filter((id) => !workforceAssessmentQuestions.some((question) => question.id === id));
  if (unknown.length) return { valid: false, message: `Unknown assessment question: ${unknown[0]}.` } as const;
  const missing = workforceAssessmentQuestions.filter((question) => question.required && isUnanswered(answers[question.id]));
  return missing.length
    ? { valid: false, message: `Please answer ${missing.length} remaining question${missing.length === 1 ? "" : "s"}.`, missing: missing.map((question) => question.id) } as const
    : { valid: true, missing: [] } as const;
}

export function interpretWorkforceAssessment(answers: AssessmentAnswerMap): WorkforceAssessmentResult {
  const strengths: string[] = [];
  const needs: string[] = [];
  if (independent.has(text(answers.ai_practical_use))) strengths.push("Applying AI tools to practical work tasks");
  if (independent.has(text(answers.ai_output_checking))) strengths.push("Checking AI outputs before relying on them");
  if (independent.has(text(answers.data_reporting))) strengths.push("Using data to answer questions and communicate findings");
  if (independent.has(text(answers.automation_use))) strengths.push("Using simple automation to improve repetitive work");
  if (independent.has(text(answers.responsible_information_handling))) strengths.push("Making considered decisions about safe information handling");

  if (development.has(text(answers.ai_practical_use))) needs.push("Practical, role-specific use of AI tools");
  if (development.has(text(answers.ai_output_checking))) needs.push("Critical checking of AI-generated outputs");
  if (development.has(text(answers.data_reporting))) needs.push("Data analysis and reporting confidence");
  if (development.has(text(answers.automation_use))) needs.push("Identifying and applying simple automation");
  if (development.has(text(answers.responsible_information_handling))) needs.push("Responsible AI and information-handling judgement");

  const constraints: string[] = [];
  if (["no", "partly", "not_sure"].includes(text(answers.tool_access))) constraints.push("Access to suitable tools, systems or data needs discussion");
  if (["no", "partly", "not_sure"].includes(text(answers.practice_opportunity))) constraints.push("A suitable workplace opportunity needs to be agreed");
  if (["not_available", "partly", "not_sure"].includes(text(answers.time_and_support))) constraints.push("Time, workload space or management support needs confirmation");

  const interests = strings(answers.development_interests);
  const possibleRoutes: WorkforceAssessmentResult["possibleRoutes"] = [];
  const opportunity = written(answers.automation_opportunity);
  if (opportunity && !/^not\s+(sure|yet)$/i.test(opportunity)) {
    possibleRoutes.push({ route: "workplace_project", label: "Workplace development project", rationale: "The employee identified a specific workflow or task that could provide a practical learning context." });
  }
  if (interests.includes("automation") && constraints.some((item) => item.startsWith("Access"))) {
    possibleRoutes.push({ route: "tooling_or_process_improvement", label: "Tooling, access or process improvement", rationale: "The immediate blocker is workplace enablement rather than an assumed personal capability gap." });
  }
  if (needs.length <= 2 && needs.length > 0) {
    possibleRoutes.push({ route: "focused_training", label: "Focused training or short course", rationale: "The responses indicate a bounded development need that may not require a full apprenticeship." });
  }
  if (needs.length >= 3 && text(answers.practice_opportunity) !== "no") {
    possibleRoutes.push({ route: "investigate_apprenticeship", label: "Investigate an apprenticeship", rationale: "Several connected development needs and a potential workplace application justify a structured suitability conversation." });
  }
  if (needs.length && text(answers.time_and_support) !== "not_available") {
    possibleRoutes.push({ route: "mentoring", label: "Mentoring or guided practice", rationale: "Guided application could help turn existing exposure into independent capability." });
  }
  if (!possibleRoutes.length) possibleRoutes.push({ route: "no_immediate_action", label: "No immediate development action", rationale: "The responses do not yet establish a clear development action; discuss the role context before deciding." });

  return {
    strengths: strengths.length ? strengths : ["No clear strength signal yet; practical examples would provide better evidence"],
    developmentNeeds: needs.length ? needs : ["No immediate personal capability need identified from the supplied answers"],
    practicalOpportunity: opportunity && !/^not\s+(sure|yet)$/i.test(opportunity) ? opportunity : "A practical workplace opportunity still needs to be identified.",
    workplaceConstraints: constraints,
    possibleRoutes: uniqueRoutes(possibleRoutes),
    discussionPoints: [
      ...(constraints.length ? ["Confirm which workplace conditions can be addressed before choosing development."] : []),
      "Review the employee's role evidence and intended outcome with the appropriate manager.",
      "Confirm programme suitability, prior learning, funding and eligibility separately before any apprenticeship decision.",
    ],
    evidenceDomains: [
      domain("technical", answers, ["ai_practical_use", "data_reporting", "automation_use"]),
      domain("non_technical", answers, ["role_recurring_work", "automation_opportunity", "development_interests", "development_example"]),
      domain("responsible_ethical", answers, ["ai_output_checking", "responsible_information_handling"]),
    ],
    disclaimer: "Indicative development guidance only. This result does not determine competence, apprenticeship eligibility, programme level, funding, approval or provider suitability.",
  };
}

export function aggregateAssessmentResults(input: {
  invited: string[];
  submissions: Array<{ employeeId: string; department: string; roleTitle: string; result: WorkforceAssessmentResult }>;
  suppressionThreshold?: number;
}) {
  const submittedByEmployee = new Map(input.submissions.map((submission) => [submission.employeeId, submission]));
  const submissions = [...submittedByEmployee.values()];
  const invited = new Set(input.invited);
  const threshold = input.suppressionThreshold ?? 5;
  const groups = [...new Set(submissions.map((submission) => submission.department).filter(Boolean))].map((department) => {
    const departmentSubmissions = submissions.filter((submission) => submission.department === department);
    return {
      department,
      submitted: departmentSubmissions.length,
      suppressed: departmentSubmissions.length < threshold,
      recurringNeeds: departmentSubmissions.length < threshold ? [] : frequencies(departmentSubmissions.flatMap((submission) => submission.result.developmentNeeds)),
      blockers: departmentSubmissions.length < threshold ? [] : frequencies(departmentSubmissions.flatMap((submission) => submission.result.workplaceConstraints)),
    };
  });
  return {
    invited: invited.size,
    submitted: submissions.length,
    participationPercent: invited.size ? Math.round((submissions.length / invited.size) * 100) : 0,
    definition: `${submissions.length} distinct submitted response${submissions.length === 1 ? "" : "s"} from ${invited.size} recorded invitee${invited.size === 1 ? "" : "s"}. Unsubmitted invitees are not treated as capability evidence.`,
    suppressionThreshold: threshold,
    groups,
  };
}

function domain(domainName: WorkforceAssessmentResult["evidenceDomains"][number]["domain"], answers: AssessmentAnswerMap, ids: string[]) {
  const relevant = ids.filter((id) => text(answers[id]) !== "not_applicable");
  return { domain: domainName, relevant: relevant.length, answered: relevant.filter((id) => !isUnanswered(answers[id])).length };
}

function frequencies(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).map(([label, count]) => ({ label, count }));
}

function uniqueRoutes(routes: WorkforceAssessmentResult["possibleRoutes"]) {
  return [...new Map(routes.map((route) => [route.route, route])).values()];
}

function isUnanswered(value: AssessmentAnswerValue | undefined) {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

function text(value: AssessmentAnswerValue | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function written(value: AssessmentAnswerValue | undefined) {
  return text(value).slice(0, 4000);
}

function strings(value: AssessmentAnswerValue | undefined) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}
