export const workforceAssessmentFrameworkKey = "ai_automation_data";
export const workforceAssessmentQuestionnaireVersion = "ai-workforce-v1";
export const workforceAssessmentInterpretationVersion = "ai-workforce-rules-v1";

export type AssessmentAnswerValue = string | string[] | null;

export type AssessmentQuestion = {
  id: string;
  section: string;
  prompt: string;
  helpText: string;
  purpose: string;
  interpretation: string;
  type: "single_choice" | "multi_choice" | "long_text";
  required: boolean;
  options?: Array<{ value: string; label: string }>;
};

export type AssessmentFrameworkSection = {
  id: string;
  label: string;
  introduction: string;
};

export type AssessmentFrameworkDefinition = {
  frameworkKey: string;
  questionnaireVersion: string;
  interpretationVersion: string;
  title: string;
  shortTitle: string;
  purpose: string;
  audience: string;
  limitations: string[];
  estimatedMinutes: number;
  dimensions: Array<{ id: string; label: string; description: string }>;
  sections: AssessmentFrameworkSection[];
  questions: readonly AssessmentQuestion[];
};

const confidenceOptions = [
  { value: "independent", label: "I can do this independently" },
  { value: "with_support", label: "I can do this with some support" },
  { value: "developing", label: "I am beginning to develop this" },
  { value: "not_yet", label: "I have not done this yet" },
  { value: "not_sure", label: "Not sure" },
  { value: "not_applicable", label: "Not applicable to my role" },
];

export const workforceAssessmentQuestions: readonly AssessmentQuestion[] = [
  {
    id: "role_recurring_work",
    section: "role",
    prompt: "What are the main tasks or responsibilities you handle regularly?",
    helpText: "Describe the work you actually do rather than relying only on your job title.",
    purpose: "Establish role context for later guidance.",
    interpretation: "Written context only; it is not scored.",
    type: "long_text",
    required: true,
  },
  {
    id: "ai_practical_use",
    section: "capability",
    prompt: "How independently can you use an AI tool to support a real work task?",
    helpText: "For example, drafting, summarising, organising information or exploring an idea.",
    purpose: "Understand practical use of AI in the employee's role.",
    interpretation: "Independent use is a strength signal; support needs are development signals.",
    type: "single_choice",
    required: true,
    options: confidenceOptions,
  },
  {
    id: "ai_output_checking",
    section: "responsible_use",
    prompt: "How independently can you check an AI-generated answer before relying on it?",
    helpText: "Consider accuracy, missing information, bias and when human judgement is needed.",
    purpose: "Understand critical evaluation and responsible AI use.",
    interpretation: "Independent checking is a strength; uncertainty is a responsible-use development need.",
    type: "single_choice",
    required: true,
    options: confidenceOptions,
  },
  {
    id: "data_reporting",
    section: "capability",
    prompt: "How independently can you work with data to answer a question or produce a useful report?",
    helpText: "This could include checking data quality, analysing trends or explaining findings.",
    purpose: "Understand practical data and reporting capability.",
    interpretation: "Capability and development signals are considered separately from access to data or tools.",
    type: "single_choice",
    required: true,
    options: confidenceOptions,
  },
  {
    id: "automation_use",
    section: "capability",
    prompt: "How independently can you use simple automation to reduce repetitive work?",
    helpText: "This could be a workflow, rule, macro, reminder or no-code automation.",
    purpose: "Understand practical automation capability.",
    interpretation: "No current use is not treated as low capability when the role has no relevant opportunity.",
    type: "single_choice",
    required: true,
    options: confidenceOptions,
  },
  {
    id: "responsible_information_handling",
    section: "responsible_use",
    prompt: "How confident are you deciding what information is safe to use with AI or automation tools?",
    helpText: "Think about personal, commercially sensitive or confidential information.",
    purpose: "Understand safe information handling.",
    interpretation: "Uncertainty creates a responsible-use development need, not a compliance finding.",
    type: "single_choice",
    required: true,
    options: confidenceOptions,
  },
  {
    id: "automation_opportunity",
    section: "opportunity",
    prompt: "Which repetitive task or workflow would be most useful to improve?",
    helpText: "Describe one practical opportunity connected to your work. Use “not sure” if none is clear yet.",
    purpose: "Identify a grounded workplace development opportunity.",
    interpretation: "The answer informs discussion; it does not authorise a technology change.",
    type: "long_text",
    required: true,
  },
  {
    id: "development_interests",
    section: "opportunity",
    prompt: "Which areas would you most like to develop?",
    helpText: "Choose all that apply.",
    purpose: "Connect guidance to employee interests.",
    interpretation: "Interests guide possible routes but do not establish suitability or eligibility.",
    type: "multi_choice",
    required: true,
    options: [
      { value: "everyday_ai", label: "Using AI effectively in everyday work" },
      { value: "data_analysis", label: "Data analysis and reporting" },
      { value: "automation", label: "Improving or automating processes" },
      { value: "responsible_ai", label: "Responsible AI and information handling" },
      { value: "technical_solutions", label: "Building technical data or AI solutions" },
      { value: "leadership", label: "Leading adoption and change" },
      { value: "not_sure", label: "Not sure yet" },
    ],
  },
  {
    id: "tool_access",
    section: "readiness",
    prompt: "Do you have access to the tools, systems and data needed to practise these skills?",
    helpText: "Unavailable tools are recorded as a workplace condition, not a personal capability gap.",
    purpose: "Separate enablement conditions from personal capability.",
    interpretation: "Limited access is an organisational blocker.",
    type: "single_choice",
    required: true,
    options: [
      { value: "yes", label: "Yes" },
      { value: "partly", label: "Partly" },
      { value: "no", label: "No" },
      { value: "not_sure", label: "Not sure" },
      { value: "not_applicable", label: "Not applicable" },
    ],
  },
  {
    id: "practice_opportunity",
    section: "readiness",
    prompt: "Is there a suitable opportunity to apply learning in your current work?",
    helpText: "For example, a report, process improvement, project or supported experiment.",
    purpose: "Understand workplace application readiness.",
    interpretation: "No opportunity is an organisational condition, not evidence of low capability.",
    type: "single_choice",
    required: true,
    options: [
      { value: "yes", label: "Yes" },
      { value: "partly", label: "Possibly, with agreement" },
      { value: "no", label: "No current opportunity" },
      { value: "not_sure", label: "Not sure" },
      { value: "not_applicable", label: "Not applicable" },
    ],
  },
  {
    id: "time_and_support",
    section: "readiness",
    prompt: "How available are time, workload space and manager support for development?",
    helpText: "Answer based on current conditions, not what you think should be available.",
    purpose: "Understand practical readiness and constraints.",
    interpretation: "Limited support is an organisational blocker and does not lower personal capability.",
    type: "single_choice",
    required: true,
    options: [
      { value: "available", label: "Available and agreed" },
      { value: "partly", label: "Some support is available" },
      { value: "not_available", label: "Not currently available" },
      { value: "not_sure", label: "Not sure" },
      { value: "not_applicable", label: "Not applicable" },
    ],
  },
  {
    id: "development_example",
    section: "role",
    prompt: "Give one example of something you have learned, improved or tried in this area.",
    helpText: "A short practical example is enough. You can say “not yet” if you do not have one.",
    purpose: "Provide behavioural evidence and context for discussion.",
    interpretation: "The example supports narrative guidance and is not independently scored.",
    type: "long_text",
    required: true,
  },
] as const;

export const assessmentFrameworkDisclosure = {
  private: "Your draft answers and personal result are private to you until you explicitly share them or submit them to an assigned campaign.",
  campaign: "When you submit this campaign assessment, the stated findings and result become visible to the campaign owner and authorised reporting roles. Your manager sees individual findings only where the campaign policy permits it.",
  guidance: "This is indicative development guidance. It is not a competence test, apprenticeship eligibility decision, provider initial assessment or approval.",
} as const;
