import {
  workforceAssessmentFrameworkKey,
  workforceAssessmentInterpretationVersion,
  workforceAssessmentQuestionnaireVersion,
  workforceAssessmentQuestions,
  type AssessmentFrameworkDefinition,
  type AssessmentQuestion,
} from "@/lib/levytate/assessments/framework";

const agreement = ["Strongly disagree", "Disagree", "Neither agree nor disagree", "Agree", "Strongly agree"].map((label, index) => ({ value: String(index + 1), label }));
const confidence = ["Not at all confident", "Slightly confident", "Moderately confident", "Very confident", "Completely confident"].map((label, index) => ({ value: String(index + 1), label }));
const frequency = ["Never", "Less than monthly", "Monthly", "Weekly", "Daily"].map((label, index) => ({ value: String(index + 1), label }));
const context = [
  { value: "1", label: "Never used" },
  { value: "personal", label: "Personal use only" },
  { value: "workplace", label: "Workplace use only" },
  { value: "5", label: "Both personal and workplace use" },
];
const personalUseCases = ["Researching and comparing information", "Drafting or improving writing", "Planning travel, meals, budgets or personal projects", "Summarising information", "Learning a new skill or topic", "Creating presentations or documents", "Creating images or other media", "Analysing data or spreadsheets", "Writing or troubleshooting code", "Building custom assistants, agents or workflows", "Automating repetitive tasks", "Comparing and checking outputs from different tools"].map((label) => ({ value: label, label }));
const workplaceUseCases = ["Research and comparison", "Drafting or improving writing", "Summarising documents", "Creating presentations or documents", "Analysing data or spreadsheets", "Planning and scheduling", "Creating training content", "Writing or troubleshooting code", "Building assistants or workflows", "Automating repetitive administration", "Comparing and checking outputs", "I do not currently use AI at work"].map((label) => ({ value: label, label }));
const scale = (id: string, section: string, prompt: string, options = agreement, dimension = ""): AssessmentQuestion => ({ id, section, prompt, helpText: "Choose the response that best reflects your current experience.", purpose: dimension, interpretation: "Self-reported evidence; interpreted with practical evidence and role context.", type: "single_choice", required: true, options });

export const comprehensiveQuestionnaireVersion = "ai-capability-v2";
export const comprehensiveInterpretationVersion = "ai-capability-rules-v2";

export const comprehensiveSections = [
  { id: "experience", label: "Your experience with AI", introduction: "People build useful AI skills through personal use as well as work. Do not share private prompts, topics or account information." },
  { id: "understanding", label: "Understanding AI", introduction: "Explore AI's strengths, limitations and need for human oversight." },
  { id: "responsible", label: "Responsible use", introduction: "Explore safe, responsible and accountable use. This is not a test of policy recall." },
  { id: "application", label: "Practical application", introduction: "Consider how you approach tasks, instructions and simple AI-assisted workflows." },
  { id: "verification", label: "Checking outputs", introduction: "Consider how you check outputs and decide when human judgement must take priority." },
  { id: "contribution", label: "Supporting wider adoption", introduction: "Explore peer support, technical activity and leadership without treating them as a hierarchy." },
  { id: "practical", label: "Practical scenarios", introduction: "Choose the most appropriate response to four short workplace scenarios." },
  { id: "opportunities", label: "Barriers and opportunities", introduction: "Identify the conditions and opportunities that would make development useful." },
] as const;

export const comprehensiveAssessmentQuestions: readonly AssessmentQuestion[] = [
  scale("ex1", "experience", "How often do you use AI tools for personal tasks or interests?", frequency, "generalUsage"),
  scale("ex2", "experience", "How often do you use AI tools as part of your work?", frequency, "generalUsage"),
  scale("ex3", "experience", "Which statement best reflects where you currently use AI?", context, "generalUsage"),
  scale("ex4", "experience", "I can use more than one AI tool or approach when it is helpful.", agreement, "generalUsage"),
  scale("ex5", "experience", "I can work independently with AI for familiar tasks.", agreement, "generalUsage"),
  scale("ex6", "experience", "How confident are you transferring useful personal AI experience into approved workplace activity?", confidence, "generalUsage"),
  scale("ex7", "experience", "I can explain which parts of a task AI supported and which decisions remained mine.", agreement, "generalUsage"),
  { id: "personalUseCases", section: "experience", prompt: "Which activities have you used AI for outside work?", helpText: "Select all that apply. Do not share private topics or account information.", purpose: "transferable experience", interpretation: "Category evidence only.", type: "multi_choice", required: false, options: personalUseCases },
  { id: "workplaceUseCases", section: "experience", prompt: "Which activities have you used AI for at work?", helpText: "Select all that apply, including no current workplace use where relevant.", purpose: "workplace use", interpretation: "Category evidence only.", type: "multi_choice", required: true, options: workplaceUseCases },
  ...[
    ["un1", "I understand that generative AI predicts plausible outputs rather than guaranteeing facts."],
    ["un2", "I can recognise tasks where AI may be useful and tasks where it may be unsuitable."],
    ["un3", "I understand why AI can produce confident but inaccurate or invented information."],
    ["un4", "I can identify when meaningful human oversight is required."],
    ["un5", "I understand that an AI tool's suitability depends on the task, data and potential impact."],
  ].map(([id, prompt]) => scale(id, "understanding", prompt, agreement, "aiUnderstanding")),
  ...[
    ["re1", "I know how to avoid entering sensitive or confidential information into an unsuitable AI tool."],
    ["re2", "I check whether an AI tool is approved before using it for workplace information."],
    ["re3", "I consider bias, fairness and who may be affected before using an AI output."],
    ["re4", "I consider ownership, copyright or intellectual-property implications when using AI-generated material."],
    ["re5", "I understand that I remain accountable for work I complete with AI support."],
  ].map(([id, prompt]) => scale(id, "responsible", prompt, agreement, "responsibleUse")),
  ...[
    ["ap1", "I can give an AI tool clear context, purpose, constraints and output requirements."],
    ["ap2", "I improve an instruction when the first AI response is not useful."],
    ["ap3", "I can break a task into sensible steps that AI may support."],
    ["ap4", "I can choose a low-risk, clearly defined task for an initial AI experiment."],
    ["ap5", "I can design a simple workflow that keeps appropriate human review in place."],
  ].map(([id, prompt]) => scale(id, "application", prompt, agreement, "practicalApplication")),
  ...[
    ["ve1", "I check important AI-generated facts against reliable sources."],
    ["ve2", "I look for missing context, unsupported claims or important omissions in AI outputs."],
    ["ve3", "I assess whether an AI output's tone and content are suitable for the intended audience."],
    ["ve4", "I can recognise a weak or misleading output even when it is written confidently."],
    ["ve5", "I know when not to rely on AI and when to seek human expertise."],
  ].map(([id, prompt]) => scale(id, "verification", prompt, agreement, "verificationJudgement")),
  ...[
    ["co1", "I share useful and responsible AI practices with colleagues when relevant."],
    ["co2", "I can identify a process opportunity that may benefit from AI support."],
    ["co3", "I have experience configuring tools, building automations or using code or APIs."],
    ["co4", "I can help establish sensible guardrails or governance for AI activity."],
    ["co5", "I can connect AI activity to team or organisational priorities."],
  ].map(([id, prompt]) => scale(id, "contribution", prompt, agreement, "contribution")),
  { id: "pv1", section: "practical", prompt: "You ask an AI assistant to write a project update, but the response is too generic. Which action is most likely to improve it?", helpText: "Choose the strongest workplace response.", purpose: "practical judgement", interpretation: "Confidential scenario scoring.", type: "single_choice", required: true, options: [{ value: "A", label: "Ask the same question repeatedly without changing it" }, { value: "B", label: "Add the audience, purpose, context, format and important constraints" }, { value: "C", label: "Copy the first response directly into an external email" }, { value: "D", label: "Use a less specific instruction so the AI has more freedom" }] },
  { id: "pv2", section: "practical", prompt: "An AI tool produces a confident summary of a policy document. What should you do before relying on it?", helpText: "Choose the strongest workplace response.", purpose: "practical judgement", interpretation: "Confidential scenario scoring.", type: "single_choice", required: true, options: [{ value: "A", label: "Assume it is accurate because it sounds professional" }, { value: "B", label: "Share it immediately and ask others to correct mistakes" }, { value: "C", label: "Compare it with the original source and check facts, omissions and context" }, { value: "D", label: "Ask the AI whether its own summary is correct and accept its answer" }] },
  { id: "pv3", section: "practical", prompt: "You want help drafting a response about a sensitive employee matter. What is the most appropriate approach?", helpText: "Choose the strongest workplace response.", purpose: "practical judgement", interpretation: "Confidential scenario scoring.", type: "single_choice", required: true, options: [{ value: "A", label: "Paste the full details into any publicly available AI tool" }, { value: "B", label: "Remove identifying information and use only an approved tool in line with guidance" }, { value: "C", label: "Use a personal AI account because it is separate from work" }, { value: "D", label: "Include the employee's name so the response is more specific" }] },
  { id: "pv4", section: "practical", prompt: "Which task is generally the strongest starting point for exploring workplace AI support?", helpText: "Choose the strongest workplace response.", purpose: "practical judgement", interpretation: "Confidential scenario scoring.", type: "single_choice", required: true, options: [{ value: "A", label: "Making a final high-risk decision without human review" }, { value: "B", label: "Automatically approving sensitive financial or employment actions" }, { value: "C", label: "Supporting a repetitive, clearly defined task where a person reviews outputs" }, { value: "D", label: "Replacing all existing processes before testing the technology" }] },
  { id: "barrier", section: "opportunities", prompt: "What is the main factor currently limiting your use of AI at work?", helpText: "Choose the factor that best reflects your current situation.", purpose: "workplace condition", interpretation: "Organisational condition, not a capability score.", type: "single_choice", required: true, options: ["Lack of time to learn", "Not sure where to start", "Lack of role-specific examples", "Concerns about accuracy", "Unclear company guidance", "Limited confidence using AI"].map((label) => ({ value: label, label })) },
  { id: "opportunity", section: "opportunities", prompt: "Which repetitive work task would you most like AI to improve?", helpText: "A short example is helpful. Do not include personal or confidential information.", purpose: "workplace opportunity", interpretation: "Narrative evidence only.", type: "long_text", required: false },
] as const;

export const assessmentFrameworks: readonly AssessmentFrameworkDefinition[] = [
  {
    frameworkKey: workforceAssessmentFrameworkKey,
    questionnaireVersion: workforceAssessmentQuestionnaireVersion,
    interpretationVersion: workforceAssessmentInterpretationVersion,
    title: "AI, automation and data workforce assessment",
    shortTitle: "Quick Assessment",
    purpose: "A concise development conversation covering role needs, AI, automation, data and workplace conditions.",
    audience: "Employees and employer-led development campaigns.",
    limitations: ["Indicative development guidance only", "Not a competence, eligibility, funding or employment decision"],
    estimatedMinutes: 6,
    dimensions: [],
    sections: [
      { id: "role", label: "Role context", introduction: "Describe the work and development context." },
      { id: "capability", label: "Current capability", introduction: "Reflect on practical AI, automation and data activity." },
      { id: "responsible_use", label: "Responsible use", introduction: "Consider checking and safe information handling." },
      { id: "opportunity", label: "Opportunity", introduction: "Identify a useful development opportunity." },
      { id: "readiness", label: "Workplace readiness", introduction: "Separate workplace conditions from personal capability." },
    ],
    questions: workforceAssessmentQuestions,
  },
  {
    frameworkKey: workforceAssessmentFrameworkKey,
    questionnaireVersion: comprehensiveQuestionnaireVersion,
    interpretationVersion: comprehensiveInterpretationVersion,
    title: "Comprehensive AI Capability Assessment",
    shortTitle: "Comprehensive Assessment",
    purpose: "Build a fuller evidence base for safe AI adoption, capability development and workforce planning.",
    audience: "Employees in an explicitly scoped employer campaign or a private personal assessment.",
    limitations: ["Internal development bands are not certification", "Four scenarios provide limited practical evidence", "Self-report requires contextual review", "Non-response and not-applicable answers are never low scores"],
    estimatedMinutes: 15,
    dimensions: [
      { id: "aiUnderstanding", label: "AI understanding", description: "Capabilities, limitations, uncertainty and oversight." },
      { id: "generalUsage", label: "Personal and workplace usage", description: "Relevant experience and transfer into work." },
      { id: "responsibleUse", label: "Responsible use", description: "Approved tools, information handling, fairness and accountability." },
      { id: "practicalApplication", label: "Practical application", description: "Task definition, iteration and human review." },
      { id: "verificationJudgement", label: "Verification and judgement", description: "Checking facts, omissions, sources and suitability." },
      { id: "contribution", label: "Wider contribution", description: "Enablement, technical activity, governance and leadership." },
    ],
    sections: [...comprehensiveSections],
    questions: comprehensiveAssessmentQuestions,
  },
] as const;

export function frameworkByVersion(questionnaireVersion: string) {
  return assessmentFrameworks.find((framework) => framework.questionnaireVersion === questionnaireVersion) ?? assessmentFrameworks[0];
}
