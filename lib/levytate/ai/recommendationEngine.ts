import type {
  LevyTateAiRequest,
  LevyTateAiResponse,
  LevyTatePlatformRecommendation,
  LevyTateRecommendationEvidence,
  LevyTateRecommendationResult,
  LevyTateRecommendedPathway,
} from "@/lib/levytate/ai/types";
import { getApprenticeshipStandard } from "@/lib/levytate/domain";

type PathwaySignal = {
  id: string;
  label: string;
  weight: number;
  pattern: RegExp;
};

type PathwayDefinition = {
  pathwayId: string;
  title: string;
  standard: string;
  baseScore: number;
  rationale: string;
  signals: PathwaySignal[];
};

const recommendationEngineVersion = "1";
const revealThreshold = 74;

function pathway(
  standardId: string,
  baseScore: number,
  rationale: string,
  signals: PathwaySignal[],
): PathwayDefinition {
  const standard = getApprenticeshipStandard(standardId);
  if (!standard) throw new Error("Unknown apprenticeship standard: " + standardId);
  return {
    pathwayId: standard.id,
    title: "Level " + standard.level + " " + standard.title,
    standard: standard.title,
    baseScore,
    rationale,
    signals,
  };
}

const pathwayCatalogue: PathwayDefinition[] = [
  pathway("ST0192", 40, "Builds continuous improvement, operational performance, process optimisation and cross-functional change capability.", [
    { id: "ai-interest", label: "Interested in practical AI-enabled improvement", weight: 12, pattern: /\b(ai|artificial intelligence|chatgpt|copilot|generative ai)\b/i },
    { id: "automation-interest", label: "Wants to improve workflow automation", weight: 18, pattern: /\b(automation|automate|automating|workflow)\b/i },
    { id: "continuous-improvement", label: "Focuses on continuous improvement", weight: 22, pattern: /\b(continuous improvement|process improvement|lean|six sigma)\b/i },
    { id: "operational-performance", label: "Wants to improve operational performance", weight: 17, pattern: /\b(operational performance|productivity|reduce waste|downtime|efficiency)\b/i },
    { id: "production-context", label: "Role operates in production or manufacturing", weight: 10, pattern: /\b(production|manufacturing|maintenance manager)\b/i },
    { id: "business-improvement", label: "Wants measurable business improvement", weight: 10, pattern: /\b(help the business|business improvement|improve how|business grow|productivity)\b/i },
  ]),
  pathway("ST0795", 44, "Builds practical data handling, reporting, data quality and insight capability for operational roles.", [
    { id: "reporting-work", label: "Already works with reporting", weight: 18, pattern: /\b(reporting|reports|report)\b/i },
    { id: "spreadsheet-work", label: "Uses spreadsheets in current work", weight: 14, pattern: /\b(spreadsheet|spreadsheets|excel)\b/i },
    { id: "data-interest", label: "Interested in data-led work", weight: 12, pattern: /\b(data|data-focused|data role)\b/i },
    { id: "data-quality", label: "Role includes CRM or data quality", weight: 10, pattern: /\b(crm|data quality|records|information quality)\b/i },
    { id: "analysis-interest", label: "Wants stronger analysis and insight", weight: 8, pattern: /\b(analysis|analytics|dashboard|insight)\b/i },
    { id: "automation-adjacent", label: "Automation requires reliable operational data", weight: 6, pattern: /\b(automation|automate|workflow)\b/i },
    { id: "admin-role", label: "Administrative work provides relevant data tasks", weight: 6, pattern: /\b(admin|administration|administrative)\b/i },
  ]),
  pathway("ST0118", 38, "Supports deeper analysis, insight generation, data storytelling and ownership of business reporting.", [
    { id: "advanced-analysis", label: "Wants deeper analytical responsibility", weight: 20, pattern: /\b(data analyst|advanced analysis|statistical|data science)\b/i },
    { id: "insight-ownership", label: "Wants to own dashboards or business insight", weight: 16, pattern: /\b(own reporting|reporting ownership|business insight|dashboards)\b/i },
    { id: "data-career", label: "Career goal is a data-focused role", weight: 15, pattern: /\b(move into (?:a )?data|data career|data-focused role)\b/i },
  ]),
  pathway("ST0117", 38, "Develops requirements discovery, process analysis, stakeholder engagement and systems improvement.", [
    { id: "process-analysis", label: "Interested in analysing and redesigning processes", weight: 18, pattern: /\b(process mapping|process analysis|redesign process|requirements)\b/i },
    { id: "systems-change", label: "Work involves systems or organisational change", weight: 16, pattern: /\b(system change|systems improvement|change project|stakeholder)\b/i },
    { id: "business-analysis", label: "Explicit interest in business analysis", weight: 22, pattern: /\b(business analyst|business analysis)\b/i },
  ]),
  pathway("ST0310", 38, "Develops planning, risk, stakeholder coordination and accountable project delivery.", [
    { id: "project-goal", label: "Wants responsibility for project delivery", weight: 22, pattern: /\b(project manager|project management|manage projects|project delivery)\b/i },
    { id: "delivery-coordination", label: "Role includes planning and coordination", weight: 14, pattern: /\b(planning|coordination|work packages|risk management)\b/i },
  ]),
  pathway("ST0313", 42, "Directly develops sourcing, supplier management, commercial judgement and procurement practice.", [
    { id: "procurement-role", label: "Role is in procurement or buying", weight: 30, pattern: /\b(procurement|buyer|buying|sourcing)\b/i },
    { id: "supplier-work", label: "Work includes supplier or commercial decisions", weight: 18, pattern: /\b(supplier|commercial|contract management)\b/i },
  ]),
  pathway("ST0071", 40, "Develops complex customer handling, service improvement and ownership of customer outcomes.", [
    { id: "customer-role", label: "Role is customer-facing", weight: 24, pattern: /\b(customer service|customer support|customer experience|client service)\b/i },
    { id: "service-improvement", label: "Wants to improve service outcomes", weight: 16, pattern: /\b(service improvement|customer outcomes|complaints)\b/i },
  ]),
  pathway("ST0457", 41, "Builds technical engineering competence through applied manufacturing, maintenance and workplace evidence.", [
    { id: "engineering-role", label: "Role has an engineering or maintenance focus", weight: 28, pattern: /\b(engineer|engineering|maintenance|technical maintenance)\b/i },
    { id: "manufacturing-context", label: "Work is based in manufacturing or production", weight: 14, pattern: /\b(manufacturing|production|factory)\b/i },
  ]),
  pathway("ST0048", 41, "Develops site coordination, safety, quality control and supervised construction delivery.", [
    { id: "site-supervision", label: "Role includes construction site supervision", weight: 30, pattern: /\b(site supervisor|construction site|site supervision)\b/i },
    { id: "construction-delivery", label: "Work includes construction delivery or handover", weight: 16, pattern: /\b(construction|site delivery|handover|quality checks)\b/i },
  ]),
];
function clamp(value: number) {
  return Math.max(0, Math.min(99, Math.round(value)));
}

function uniqueText(parts: Array<string | null | undefined>) {
  return [...new Set(parts.filter((part): part is string => Boolean(part?.trim())).map((part) => part.trim()))].join("\n");
}

function conversationText(request: LevyTateAiRequest) {
  return uniqueText([
    ...request.conversationHistory.filter((message) => message.role === "user").map((message) => message.content),
    request.userMessage,
    request.conversationProfile?.currentRole,
    request.conversationProfile?.currentDepartment,
    request.conversationProfile?.careerGoal,
    request.conversationProfile?.reasonForDevelopment,
    ...(request.conversationProfile?.currentSkills ?? []),
    ...(request.conversationProfile?.interestAreas ?? []),
    request.contextData?.selectedPersona?.role,
    request.contextData?.selectedPersona?.department,
    request.contextData?.selectedPersona?.careerGoal,
    request.employeeDiscovery?.roleTitle,
    request.employeeDiscovery?.department,
    ...(request.employeeDiscovery?.responsibilities ?? []),
    ...(request.employeeDiscovery?.currentSkills ?? []),
    ...(request.employeeDiscovery?.businessFunctions ?? []),
    ...(request.employeeDiscovery?.currentCapabilities ?? []),
    ...(request.employeeDiscovery?.apprenticeshipIndicators ?? []),
    ...(request.employeeDiscovery?.aiOpportunities ?? []),
    ...(request.employeeDiscovery?.dataOpportunities ?? []),
    ...(request.employeeDiscovery?.automationOpportunities ?? []),
    ...(request.employeeDiscovery?.futureCapabilities ?? []),
    ...(request.employerPriorities?.map((priority) => priority.name) ?? []),
  ]);
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function suppliedPathwayDefinitions(request: LevyTateAiRequest) {
  const supplied = request.availablePathways ?? [];
  return supplied.flatMap((pathway) => {
    if (pathway.status && /not available|archived|withdrawn/i.test(pathway.status)) return [];
    const existing = pathwayCatalogue.find((item) =>
      item.title.toLowerCase() === pathway.title.toLowerCase() ||
      item.standard.toLowerCase() === pathway.standard?.toLowerCase(),
    );
    if (existing) return [existing];
    return [{
      pathwayId: slugify(pathway.standard ?? pathway.title),
      title: pathway.title,
      standard: pathway.standard ?? pathway.title,
      baseScore: 36,
      rationale: "An employer-supplied pathway available for role-fit assessment.",
      signals: [{ id: "explicit-pathway", label: "The pathway is explicitly relevant to the stated requirement", weight: 28, pattern: new RegExp(`\\b${pathway.title.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i") }],
    } satisfies PathwayDefinition];
  });
}

function availableDefinitions(request: LevyTateAiRequest) {
  const supplied = suppliedPathwayDefinitions(request);
  if (!supplied.length) return pathwayCatalogue;
  const byId = new Map(supplied.map((item) => [item.pathwayId, item]));
  return [...byId.values()];
}

function roleMappingEvidence(request: LevyTateAiRequest, definition: PathwayDefinition) {
  const role = request.conversationProfile?.currentRole ?? request.employeeDiscovery?.roleTitle ?? request.contextData?.selectedPersona?.role ?? "";
  const mapping = request.roleMappings?.find((item) => item.roleTitle.toLowerCase() === role.toLowerCase());
  if (!mapping) return [];
  const primaryMatch = mapping.primaryPathway.toLowerCase().includes(definition.standard.toLowerCase()) || definition.title.toLowerCase().includes(mapping.primaryPathway.toLowerCase());
  const alternativeMatch = mapping.alternativePathways?.some((item) => item.toLowerCase().includes(definition.standard.toLowerCase()) || definition.title.toLowerCase().includes(item.toLowerCase()));
  if (!primaryMatch && !alternativeMatch) return [];
  return [{
    id: primaryMatch ? `role-primary-${slugify(role)}` : `role-alternative-${slugify(role)}`,
    label: primaryMatch ? `Primary pathway mapped to ${role}` : `Alternative pathway mapped to ${role}`,
    source: "role_mapping" as const,
    weight: primaryMatch ? 34 : 22,
  }];
}

function evidenceFor(request: LevyTateAiRequest, definition: PathwayDefinition, text: string) {
  const discoveryText = uniqueText([
    request.employeeDiscovery?.roleTitle,
    request.employeeDiscovery?.department,
    ...(request.employeeDiscovery?.responsibilities ?? []),
    ...(request.employeeDiscovery?.currentSkills ?? []),
    ...(request.employeeDiscovery?.businessFunctions ?? []),
    ...(request.employeeDiscovery?.currentCapabilities ?? []),
    ...(request.employeeDiscovery?.apprenticeshipIndicators ?? []),
    ...(request.employeeDiscovery?.aiOpportunities ?? []),
    ...(request.employeeDiscovery?.dataOpportunities ?? []),
    ...(request.employeeDiscovery?.automationOpportunities ?? []),
    ...(request.employeeDiscovery?.futureCapabilities ?? []),
  ]);
  const profileEvidence: LevyTateRecommendationEvidence[] = definition.signals
    .filter((signal) => signal.pattern.test(discoveryText))
    .map((signal) => ({ id: `profile-${signal.id}`, label: signal.label, source: "profile", weight: signal.weight }));
  const matchedSignalIds = new Set(profileEvidence.map((item) => item.id.replace(/^profile-/, "")));
  const conversationEvidence: LevyTateRecommendationEvidence[] = definition.signals
    .filter((signal) => !matchedSignalIds.has(signal.id) && signal.pattern.test(text))
    .map((signal) => ({ id: signal.id, label: signal.label, source: "conversation", weight: signal.weight }));
  const priorityEvidence: LevyTateRecommendationEvidence[] = (request.employerPriorities ?? []).flatMap((priority) => {
    const matchingSignals = definition.signals.filter((signal) => signal.pattern.test(priority.name));
    return matchingSignals.slice(0, 1).map((signal) => ({
      id: `priority-${slugify(priority.name)}-${signal.id}`,
      label: `Employer priority: ${priority.name}`,
      source: "platform_rule" as const,
      weight: priority.importance === "Critical" ? 8 : priority.importance === "High" ? 6 : 4,
    }));
  });
  return [...roleMappingEvidence(request, definition), ...profileEvidence, ...conversationEvidence, ...priorityEvidence];
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function previousScore(request: LevyTateAiRequest, pathwayId: string) {
  return request.previousRecommendationResult?.recommendations.find((item) => item.pathwayId === pathwayId)?.fitScore;
}

export function buildLevyTateRecommendations(request: LevyTateAiRequest): LevyTateRecommendationResult {
  const text = conversationText(request);
  const recommendations = availableDefinitions(request)
    .map((definition) => {
      const evidence = evidenceFor(request, definition, text);
      const fitScore = clamp(definition.baseScore + evidence.reduce((total, item) => total + item.weight, 0));
      const previous = previousScore(request, definition.pathwayId);
      const mapped = evidence.some((item) => item.source === "role_mapping");
      const suppliedPathway = request.availablePathways?.find((item) => item.title.toLowerCase() === definition.title.toLowerCase());
      const explicitlyApproved = Boolean(suppliedPathway?.status && /approved|live/i.test(suppliedPathway.status));
      return {
        pathwayId: definition.pathwayId,
        title: definition.title,
        fitScore,
        scoreDelta: previous === undefined ? 0 : fitScore - previous,
        confidence: clamp(38 + evidence.reduce((total, item) => total + Math.min(item.weight, 16), 0)),
        rationale: definition.rationale,
        evidence,
        availability: mapped || explicitlyApproved ? "approved" : "role_fit_review",
        eligibility: mapped ? "eligible" : "requires_review",
        providerAvailability: request.providerCatalogue?.length ? "matching_available" : "unconfirmed",
      } satisfies LevyTatePlatformRecommendation;
    })
    .filter((item) => item.evidence.length > 0 || item.fitScore >= 44)
    .sort((left, right) => right.fitScore - left.fitScore || right.confidence - left.confidence || left.title.localeCompare(right.title))
    .slice(0, 4);

  const topRecommendation = recommendations[0] ?? null;
  const confidence = topRecommendation?.confidence ?? 0;
  const enoughEvidence = Boolean(topRecommendation && topRecommendation.evidence.length >= 3);
  const shouldRevealRecommendations = Boolean(topRecommendation && confidence >= revealThreshold && enoughEvidence);
  const signature = recommendations.map((item) => `${item.pathwayId}:${item.fitScore}:${item.evidence.map((entry) => entry.id).sort().join(",")}`).join("|");
  const recommendationVersion = `rec-${recommendationEngineVersion}-${stableHash(signature)}`;

  return {
    recommendations,
    topRecommendation,
    recommendationVersion,
    confidence,
    revealThreshold,
    shouldRevealRecommendations,
    evidenceChanged: request.previousRecommendationResult?.recommendationVersion !== recommendationVersion,
  };
}

function toPathway(recommendation: LevyTatePlatformRecommendation): LevyTateRecommendedPathway {
  return {
    title: recommendation.title,
    reason: recommendation.rationale,
    availability: recommendation.availability === "approved" ? "approved" : recommendation.availability === "not_available" ? "not_available" : "alternative",
    fit: recommendation.fitScore,
    scoreDelta: recommendation.scoreDelta,
    confidence: recommendation.confidence,
    evidence: recommendation.evidence.map((item) => item.label),
    standard: recommendation.title.replace(/^Level \d+\s+/i, ""),
  };
}

export function applyPlatformRecommendations(
  request: LevyTateAiRequest,
  response: LevyTateAiResponse,
  result: LevyTateRecommendationResult,
): LevyTateAiResponse {
  const top = result.topRecommendation;
  const pathways = result.recommendations.map(toPathway);
  const groundedActions = response.recommendedActions.map((action) => {
    if (!top || !["open_pathway", "start_application", "draft_application_reason", "save_interest"].includes(action.type)) return action;
    return { ...action, target: top.title };
  });
  const actions = request.role === "Employee" && !result.shouldRevealRecommendations
    ? groundedActions.filter((action) => !["open_pathway", "start_application", "draft_application_reason", "compare_routes"].includes(action.type))
    : groundedActions;
  const applicationDraft = response.applicationDraft ?? response.applicationPrefill;
  const groundedDraft = result.shouldRevealRecommendations && applicationDraft && top
    ? { ...applicationDraft, selectedApprenticeship: top.title }
    : null;
  const primary = top && response.employeeGuidance
    ? {
        ...response.employeeGuidance.primary,
        programme: top.title,
        pathway: top.title.replace(/^Level \d+\s+/i, ""),
        fit: top.fitScore,
        why: top.rationale,
      }
    : response.employeeGuidance?.primary;
  const employeeGuidance = response.employeeGuidance && primary
    ? {
        ...response.employeeGuidance,
        primary,
        alternatives: result.recommendations.slice(1).map((item) => ({ programme: item.title, fit: item.fitScore, why: item.rationale })),
        availableNow: result.recommendations
          .filter((item) => item.availability === "approved")
          .map((item) => ({ programme: item.title, fit: item.fitScore, why: item.rationale })),
        futureInterests: result.recommendations
          .filter((item) => item.availability !== "approved")
          .map((item) => ({ programme: item.title, fit: item.fitScore, why: item.rationale })),
      }
    : response.employeeGuidance;
  const leadGuidance = response.leadGuidance
    ? {
        ...response.leadGuidance,
        recommendedStandards: result.recommendations.map((item) => ({
          name: item.title.replace(/^Level \d+\s+/i, ""),
          level: item.title.match(/^Level \d+/i)?.[0] ?? "Pathway",
          suitability: item.fitScore,
          why: item.rationale,
          bestFor: item.evidence.slice(0, 2).map((entry) => entry.label).join(" and ") || "Role-fit review",
          delivery: "Delivery model confirmed through employer mapping and provider matching.",
        })),
        alternativeStandards: result.recommendations.slice(1).map((item) => item.title),
      }
    : response.leadGuidance;

  return {
    ...response,
    shouldShowPathways: result.shouldRevealRecommendations,
    recommendedPathways: pathways,
    recommendedActions: actions,
    suggestedActions: actions,
    applicationPrefill: groundedDraft,
    applicationDraft: groundedDraft,
    employeeGuidance,
    leadGuidance,
    recommendationResult: result,
  };
}

function sentenceMentionsRecommendation(sentence: string, recommendation: LevyTatePlatformRecommendation) {
  const shortTitle = recommendation.title.replace(/^Level \d+\s+/i, "");
  return sentence.toLowerCase().includes(recommendation.title.toLowerCase()) || sentence.toLowerCase().includes(shortTitle.toLowerCase());
}

export function recommendationNarrativeIsAligned(message: string, result: LevyTateRecommendationResult) {
  const top = result.topRecommendation;
  if (!top || !result.shouldRevealRecommendations) return true;
  const sentences = message.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const referenced = result.recommendations.filter((item) => sentenceMentionsRecommendation(sentence, item));
    if (!referenced.length) continue;
    if (/\b(strongest|best fit|top recommendation|best match|leading match)\b/i.test(sentence) && !sentenceMentionsRecommendation(sentence, top)) return false;
    const percentages = [...sentence.matchAll(/(\d{1,3})\s*%/g)].map((match) => Number(match[1]));
    if (percentages.length && referenced.some((item) => !percentages.includes(item.fitScore))) return false;
    if (referenced.some((item) => item.pathwayId !== top.pathwayId) && /\b(stronger|better fit|ranks? above|ahead of)\b/i.test(sentence)) return false;
  }
  return true;
}

export function buildPlatformRecommendationExplanation(result: LevyTateRecommendationResult) {
  const top = result.topRecommendation;
  if (!top) return "I need a little more information about the role and development goal before LevyTate can rank suitable pathways.";
  if (!result.shouldRevealRecommendations) {
    return "I am still building enough evidence to make a reliable recommendation. I will keep exploring the role, the work outcome and the skills you want to develop before LevyTate ranks pathways.";
  }
  const alternative = result.recommendations[1];
  const evidence = top.evidence.slice(0, 2).map((item) => item.label.toLowerCase()).join(" and ");
  return `${top.title} is currently LevyTate's strongest match at ${top.fitScore}%. ${evidence ? `That is mainly because you ${evidence}.` : top.rationale}${alternative ? ` ${alternative.title} remains the next strongest option at ${alternative.fitScore}%.` : ""}`;
}
