import { z } from "zod";

/**
 * A source-grounded, consumer-readable interpretation generated when a user
 * opens an approved apprenticeship. Do not confuse it with official guidance.
 */
export const EXPLORE_NARRATIVE_VERSION = "defluff-v1";

export const exploreNarrativeSchema = z.object({
  headline: z.string().trim().min(20).max(150),
  introduction: z.string().trim().min(100).max(1050),
  whatYouWillLearn: z.array(z.string().trim().min(20).max(340)).length(4),
  whatThisCouldLookLikeAtWork: z.array(z.string().trim().min(20).max(340)).length(3),
  whoItMightSuit: z.string().trim().min(60).max(550),
  whatToKnowBeforeYouStart: z.string().trim().min(80).max(650),
  aConversationStarter: z.string().trim().min(25).max(250),
}).strict();

export type ExploreNarrative = z.infer<typeof exploreNarrativeSchema>;

// AI Gateway's strict structured-output subset does not accept minItems/maxItems.
// Enforce the exact counts using the Zod schema before showing any content.
export const EXPLORE_NARRATIVE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    introduction: { type: "string" },
    whatYouWillLearn: { type: "array", items: { type: "string" } },
    whatThisCouldLookLikeAtWork: { type: "array", items: { type: "string" } },
    whoItMightSuit: { type: "string" },
    whatToKnowBeforeYouStart: { type: "string" },
    aConversationStarter: { type: "string" },
  },
  required: [
    "headline",
    "introduction",
    "whatYouWillLearn",
    "whatThisCouldLookLikeAtWork",
    "whoItMightSuit",
    "whatToKnowBeforeYouStart",
    "aConversationStarter",
  ],
} as const;
