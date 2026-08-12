export const intelligenceTopics = ["All", "AI & Data", "Leadership", "Digital", "Operations", "Commercial", "Procurement", "People"] as const;

export type IntelligenceTopic = (typeof intelligenceTopics)[number];
export type IntelligenceFeedTopic = Exclude<IntelligenceTopic, "All">;
export type IntelligenceContentType = "Insight" | "Programme update" | "Event" | "Employer guide";

export type IntelligenceProvider = {
  id: string;
  name: string;
  shortName: string;
  accent: string;
  premium: true;
};

export type ProviderIntelligenceUpdate = {
  id: string;
  rawTitle: string;
  displayHeadline: string;
  displaySummary: string;
  contentType: IntelligenceContentType;
  topics: readonly IntelligenceFeedTopic[];
  programmes: readonly string[];
  regions: readonly string[];
  providerId: string;
  publishedAt: string;
  sourceType: "Provider editorial";
  editorialStatus: "published" | "draft";
};

export type FairFeedOptions = {
  topic?: IntelligenceTopic;
  limit?: number;
};
