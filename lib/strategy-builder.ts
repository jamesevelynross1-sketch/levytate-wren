export type StrategyBuilderContext = {
  organisationName: string;
  industry: string;
  employeeNumbers: string;
  userRole: string;
  existingActivity: string;
  strategicPriorities: string[];
  fundingConfidence: string;
  providerConfidence: string;
  strategicChallenge: string;
};

export type ScorecardContext = {
  score?: number;
  position?: string;
  blindSpots?: string[];
  selectedPriorities?: string[];
};

export type StrategyGeneratePayload = {
  context: StrategyBuilderContext;
  scorecardContext?: ScorecardContext | null;
};

export type StrategyRefinePayload = StrategyGeneratePayload & {
  currentStrategy: string;
  instruction: string;
};

export const strategySections = [
  "Executive Summary",
  "Current Position",
  "Strategic Opportunities",
  "Priority Capability Areas",
  "Funding & Levy Considerations",
  "Potential Programme Areas",
  "Provider Considerations",
  "Recommended Next Steps",
  "Suggested 30 / 60 / 90 Day Actions",
];

export function buildStrategySystemPrompt() {
  return [
    "You are MPR Consulting's AI Apprenticeship Strategy Builder.",
    "Write like a senior UK apprenticeship and workforce capability adviser.",
    "The output must be premium, practical, board-friendly and employer-focused.",
    "Avoid generic AI language, inflated claims, jargon and training-provider sales language.",
    "Be provider-neutral. Use UK spelling. Be specific enough to be useful, but do not invent data.",
    "Always return a structured apprenticeship strategy brief using the requested headings.",
  ].join(" ");
}

export function buildGeneratePrompt(payload: StrategyGeneratePayload) {
  const { context, scorecardContext } = payload;

  return `
Create an APPRENTICESHIP STRATEGY BRIEF for this employer.

Organisation context:
- Organisation: ${context.organisationName || "Not provided"}
- Industry: ${context.industry || "Not provided"}
- Approximate employee numbers: ${context.employeeNumbers || "Not provided"}
- User role: ${context.userRole || "Not provided"}
- Existing apprenticeship activity: ${context.existingActivity || "Not provided"}
- Strategic priorities: ${context.strategicPriorities.join(", ") || "Not provided"}
- Funding confidence: ${context.fundingConfidence || "Not provided"}
- Provider confidence: ${context.providerConfidence || "Not provided"}
- Strategic challenge: ${context.strategicChallenge || "Not provided"}

Scorecard context:
- Score: ${scorecardContext?.score ?? "No completed scorecard available"}
- Position: ${scorecardContext?.position ?? "No completed scorecard available"}
- Blind spots: ${scorecardContext?.blindSpots?.join(", ") || "No completed scorecard available"}
- Selected priorities: ${scorecardContext?.selectedPriorities?.join(", ") || "No completed scorecard available"}

Use these headings exactly:
${strategySections.map((section) => `## ${section}`).join("\n")}

Guidance:
- Make the strategy credible for senior HR, L&D, Finance and Operations stakeholders.
- Include practical recommendations that can be acted on in the next 30, 60 and 90 days.
- Mention funding, provider and workforce capability considerations where relevant.
- Do not overstate certainty. Where information is missing, say what should be clarified next.
`;
}

export function buildRefinePrompt(payload: StrategyRefinePayload) {
  return `
Refine the existing apprenticeship strategy brief using the user's instruction.

User instruction:
${payload.instruction}

Organisation context:
- Organisation: ${payload.context.organisationName || "Not provided"}
- Industry: ${payload.context.industry || "Not provided"}
- Approximate employee numbers: ${payload.context.employeeNumbers || "Not provided"}
- User role: ${payload.context.userRole || "Not provided"}
- Existing apprenticeship activity: ${payload.context.existingActivity || "Not provided"}
- Strategic priorities: ${payload.context.strategicPriorities.join(", ") || "Not provided"}
- Funding confidence: ${payload.context.fundingConfidence || "Not provided"}
- Provider confidence: ${payload.context.providerConfidence || "Not provided"}
- Strategic challenge: ${payload.context.strategicChallenge || "Not provided"}

Scorecard context:
- Score: ${payload.scorecardContext?.score ?? "No completed scorecard available"}
- Position: ${payload.scorecardContext?.position ?? "No completed scorecard available"}
- Blind spots: ${payload.scorecardContext?.blindSpots?.join(", ") || "No completed scorecard available"}
- Selected priorities: ${payload.scorecardContext?.selectedPriorities?.join(", ") || "No completed scorecard available"}

Existing strategy:
${payload.currentStrategy}

Return the full revised strategy brief, not a commentary on what changed. Preserve the same executive structure unless the instruction asks otherwise.
`;
}

export function getStrategyModel() {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

export async function callOpenAI(input: string) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getStrategyModel(),
      temperature: 0.25,
      messages: [
        {
          role: "system",
          content: buildStrategySystemPrompt(),
        },
        {
          role: "user",
          content: input,
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI request failed with status ${response.status}. ${detail.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("OpenAI returned an empty strategy response.");
  }

  return content;
}
