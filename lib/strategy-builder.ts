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
  "What This Means",
  "Recommended Focus",
  "Immediate Next Steps",
  "Next 30 Days",
  "Next 90 Days",
  "Potential Impact",
];

const emptyValues = new Set(["", "unknown", "unsure", "not provided", "not available", "to confirm"]);

function hasUsefulValue(value: string | undefined) {
  return Boolean(value && !emptyValues.has(value.trim().toLowerCase()));
}

function contextLine(label: string, value: string | undefined) {
  return hasUsefulValue(value) ? `${label}: ${value?.trim()}` : null;
}

function arrayLine(label: string, values: string[] | undefined) {
  const usefulValues = values?.filter((value) => hasUsefulValue(value)) ?? [];
  return usefulValues.length ? `${label}: ${usefulValues.join(", ")}` : null;
}

function formatLines(lines: Array<string | null>) {
  const usefulLines = lines.filter((line): line is string => Boolean(line));
  return usefulLines.length ? usefulLines.join("\n") : "No additional context supplied.";
}

export function buildStrategySystemPrompt() {
  return [
    "You are MPR Consulting's AI Apprenticeship Strategy Builder.",
    "Write like a senior UK apprenticeship and workforce capability adviser.",
    "The output must be premium, practical, board-friendly, conversational and employer-focused.",
    "Use plain English, short paragraphs, commercial awareness and practical recommendations.",
    "Avoid generic AI language, inflated claims, jargon, government-document phrasing and training-provider sales language.",
    "Be provider-neutral. Use UK spelling. Be specific enough to be useful, but do not invent data.",
    "Never use markdown syntax. Do not use #, ##, ###, raw markdown bullets, asterisks or decorative separators.",
    "Do not write empty placeholder values such as Unknown, Unsure, To confirm, Not provided or Not available.",
    "Avoid these phrases: The organisation should, The immediate opportunity is, Based on available scorecard context, Strategic opportunities, Workforce capability route.",
    "Always return a structured apprenticeship strategy brief using the requested heading labels as plain text.",
  ].join(" ");
}

export function buildGeneratePrompt(payload: StrategyGeneratePayload) {
  const { context, scorecardContext } = payload;
  const organisationContext = formatLines([
    contextLine("Organisation", context.organisationName),
    contextLine("Industry", context.industry),
    contextLine("Approximate employee numbers", context.employeeNumbers),
    contextLine("User role", context.userRole),
    contextLine("Existing apprenticeship activity", context.existingActivity),
    arrayLine("Strategic priorities", context.strategicPriorities),
    contextLine("Funding confidence", context.fundingConfidence),
    contextLine("Provider confidence", context.providerConfidence),
    contextLine("Strategic challenge", context.strategicChallenge),
  ]);
  const scorecardContextText = formatLines([
    typeof scorecardContext?.score === "number" ? `Score: ${scorecardContext.score}/100` : null,
    contextLine("Position", scorecardContext?.position),
    arrayLine("Blind spots", scorecardContext?.blindSpots),
    arrayLine("Selected priorities", scorecardContext?.selectedPriorities),
  ]);

  return `
Create a professional Apprenticeship Strategy Brief for this employer.

Organisation context:
${organisationContext}

Scorecard context:
${scorecardContextText}

Use these heading labels exactly, as plain text headings with no markdown:
${strategySections.join("\n")}

Structure guidance:
Executive Summary is only a short title area. Under it, write:
Current Position: 2 to 3 short paragraphs explaining where the employer appears to be.
What This Means: plain-English implications for decision makers.
Recommended Focus: the top 3 priorities only.
Immediate Next Steps: 3 to 5 practical actions.
Next 30 Days: 3 practical actions.
Next 90 Days: 3 practical actions.
Potential Impact: explain likely business, funding, engagement and workforce benefits without percentages or invented statistics.

Writing guidance:
Make it credible for senior HR, L&D, Finance, Operations and CEO readers.
Write as if an experienced MPR consultant is presenting findings after a discovery conversation.
Use natural consultancy language. Avoid robotic phrasing.
Omit missing information rather than naming it.
Do not use markdown bullets. Put each action on its own line.
`;
}

export function buildRefinePrompt(payload: StrategyRefinePayload) {
  const organisationContext = formatLines([
    contextLine("Organisation", payload.context.organisationName),
    contextLine("Industry", payload.context.industry),
    contextLine("Approximate employee numbers", payload.context.employeeNumbers),
    contextLine("User role", payload.context.userRole),
    contextLine("Existing apprenticeship activity", payload.context.existingActivity),
    arrayLine("Strategic priorities", payload.context.strategicPriorities),
    contextLine("Funding confidence", payload.context.fundingConfidence),
    contextLine("Provider confidence", payload.context.providerConfidence),
    contextLine("Strategic challenge", payload.context.strategicChallenge),
  ]);
  const scorecardContextText = formatLines([
    typeof payload.scorecardContext?.score === "number" ? `Score: ${payload.scorecardContext.score}/100` : null,
    contextLine("Position", payload.scorecardContext?.position),
    arrayLine("Blind spots", payload.scorecardContext?.blindSpots),
    arrayLine("Selected priorities", payload.scorecardContext?.selectedPriorities),
  ]);

  return `
Refine the existing apprenticeship strategy brief using the user's instruction.

User instruction:
${payload.instruction}

Organisation context:
${organisationContext}

Scorecard context:
${scorecardContextText}

Existing strategy:
${payload.currentStrategy}

Return the full revised strategy brief, not a commentary on what changed. Preserve this structure:
${strategySections.join("\n")}

Do not use markdown syntax, # headings, raw markdown bullets or empty placeholder values. Keep the tone plain-English, practical, employer-first and consultant-led.
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
