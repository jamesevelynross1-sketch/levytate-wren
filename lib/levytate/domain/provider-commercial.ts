import type {
  CommercialLink,
  CommercialLinkKind,
  ProgrammeCommercialProfile,
  ProviderCommercialProfile,
} from "./types";

const providerMetaMarker = "__LEVYTATE_PROVIDER_META__";
const programmeMetaMarker = "__LEVYTATE_PROGRAMME_META__";

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normaliseStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return uniqueStrings(value.filter((item): item is string => typeof item === "string"));
  }
  if (typeof value === "string") {
    return uniqueStrings(value.split(/\r?\n|,/g));
  }
  return [];
}

function normaliseLinkKind(value: unknown): CommercialLinkKind {
  return value === "Brochure" || value === "Case study" || value === "Video" || value === "FAQ" ? value : "Download";
}

export function normaliseCommercialLinks(value: unknown): CommercialLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<CommercialLink>;
    const label = safeString(candidate.label);
    const url = safeString(candidate.url);
    if (!label && !url) return [];
    return [{
      label: label || url,
      url,
      kind: normaliseLinkKind(candidate.kind),
    } satisfies CommercialLink];
  });
}

export function emptyProviderCommercialProfile(): ProviderCommercialProfile {
  return {
    organisationDescription: "",
    logoUrl: "",
    bannerUrl: "",
    primaryContactTitle: "",
    commercialContactName: "",
    commercialContactEmail: "",
    commercialContactTitle: "",
    commercialContactPhone: "",
    yearsEstablished: "",
    learnerNumbers: "",
    achievementRate: "",
    learnerSatisfaction: "",
    employerSatisfaction: "",
    googleReviewSignal: "",
    awards: [],
    accreditations: [],
    caseStudies: [],
    successStories: [],
    testimonials: [],
    videoUrl: "",
    downloads: [],
    pricingNotes: "",
    commercialNotes: "",
    employerSizesSupported: [],
  };
}

export function emptyProgrammeCommercialProfile(): ProgrammeCommercialProfile {
  return {
    tagline: "",
    idealAudience: "",
    typicalDepartments: [],
    futureSkillsDeveloped: [],
    keyOutcomes: [],
    locations: [],
    fundingOptions: [],
    employerCommitment: "",
    assessmentApproach: "",
    progressionRoutes: [],
    caseStudies: [],
    faqs: [],
    downloads: [],
    employerBenefits: [],
    futureCapabilityImpact: [],
    confidenceLabel: "High",
  };
}

export function normaliseProviderCommercialProfile(value: unknown): ProviderCommercialProfile {
  const candidate = value && typeof value === "object" ? value as Partial<ProviderCommercialProfile> : {};
  return {
    organisationDescription: safeString(candidate.organisationDescription),
    logoUrl: safeString(candidate.logoUrl),
    bannerUrl: safeString(candidate.bannerUrl),
    primaryContactTitle: safeString(candidate.primaryContactTitle),
    commercialContactName: safeString(candidate.commercialContactName),
    commercialContactEmail: safeString(candidate.commercialContactEmail),
    commercialContactTitle: safeString(candidate.commercialContactTitle),
    commercialContactPhone: safeString(candidate.commercialContactPhone),
    yearsEstablished: safeString(candidate.yearsEstablished),
    learnerNumbers: safeString(candidate.learnerNumbers),
    achievementRate: safeString(candidate.achievementRate),
    learnerSatisfaction: safeString(candidate.learnerSatisfaction),
    employerSatisfaction: safeString(candidate.employerSatisfaction),
    googleReviewSignal: safeString(candidate.googleReviewSignal),
    awards: normaliseStringArray(candidate.awards),
    accreditations: normaliseStringArray(candidate.accreditations),
    caseStudies: normaliseStringArray(candidate.caseStudies),
    successStories: normaliseStringArray(candidate.successStories),
    testimonials: normaliseStringArray(candidate.testimonials),
    videoUrl: safeString(candidate.videoUrl),
    downloads: normaliseCommercialLinks(candidate.downloads),
    pricingNotes: safeString(candidate.pricingNotes),
    commercialNotes: safeString(candidate.commercialNotes),
    employerSizesSupported: normaliseStringArray(candidate.employerSizesSupported),
  };
}

export function normaliseProgrammeCommercialProfile(value: unknown): ProgrammeCommercialProfile {
  const candidate = value && typeof value === "object" ? value as Partial<ProgrammeCommercialProfile> : {};
  return {
    tagline: safeString(candidate.tagline),
    idealAudience: safeString(candidate.idealAudience),
    typicalDepartments: normaliseStringArray(candidate.typicalDepartments),
    futureSkillsDeveloped: normaliseStringArray(candidate.futureSkillsDeveloped),
    keyOutcomes: normaliseStringArray(candidate.keyOutcomes),
    locations: normaliseStringArray(candidate.locations),
    fundingOptions: normaliseStringArray(candidate.fundingOptions),
    employerCommitment: safeString(candidate.employerCommitment),
    assessmentApproach: safeString(candidate.assessmentApproach),
    progressionRoutes: normaliseStringArray(candidate.progressionRoutes),
    caseStudies: normaliseStringArray(candidate.caseStudies),
    faqs: normaliseStringArray(candidate.faqs),
    downloads: normaliseCommercialLinks(candidate.downloads),
    employerBenefits: normaliseStringArray(candidate.employerBenefits),
    futureCapabilityImpact: normaliseStringArray(candidate.futureCapabilityImpact),
    confidenceLabel: safeString(candidate.confidenceLabel) || "High",
  };
}

function parseMetaPayload<T>(value: string | undefined, marker: string, empty: T) {
  if (!value) return { notes: "", commercialProfile: empty };
  if (!value.startsWith(marker)) {
    return { notes: value.trim(), commercialProfile: empty };
  }
  try {
    const parsed = JSON.parse(value.slice(marker.length)) as { notes?: string; commercialProfile?: unknown };
    return {
      notes: safeString(parsed.notes),
      commercialProfile: parsed.commercialProfile ?? empty,
    };
  } catch {
    return { notes: value.trim(), commercialProfile: empty };
  }
}

export function parseProviderRecordNotes(value?: string | null) {
  return parseMetaPayload(value ?? undefined, providerMetaMarker, emptyProviderCommercialProfile());
}

export function parseProgrammeRecordNotes(value?: string | null) {
  return parseMetaPayload(value ?? undefined, programmeMetaMarker, emptyProgrammeCommercialProfile());
}

function isProviderCommercialProfileEmpty(profile: ProviderCommercialProfile) {
  return !profile.organisationDescription
    && !profile.logoUrl
    && !profile.bannerUrl
    && !profile.primaryContactTitle
    && !profile.commercialContactName
    && !profile.commercialContactEmail
    && !profile.commercialContactTitle
    && !profile.commercialContactPhone
    && !profile.yearsEstablished
    && !profile.learnerNumbers
    && !profile.achievementRate
    && !profile.learnerSatisfaction
    && !profile.employerSatisfaction
    && !profile.googleReviewSignal
    && !profile.awards.length
    && !profile.accreditations.length
    && !profile.caseStudies.length
    && !profile.successStories.length
    && !profile.testimonials.length
    && !profile.videoUrl
    && !profile.downloads.length
    && !profile.pricingNotes
    && !profile.commercialNotes
    && !profile.employerSizesSupported.length;
}

function isProgrammeCommercialProfileEmpty(profile: ProgrammeCommercialProfile) {
  return !profile.tagline
    && !profile.idealAudience
    && !profile.typicalDepartments.length
    && !profile.futureSkillsDeveloped.length
    && !profile.keyOutcomes.length
    && !profile.locations.length
    && !profile.fundingOptions.length
    && !profile.employerCommitment
    && !profile.assessmentApproach
    && !profile.progressionRoutes.length
    && !profile.caseStudies.length
    && !profile.faqs.length
    && !profile.downloads.length
    && !profile.employerBenefits.length
    && !profile.futureCapabilityImpact.length
    && profile.confidenceLabel === "High";
}

export function serialiseProviderRecordNotes(notes: string, commercialProfile: ProviderCommercialProfile) {
  const normalised = normaliseProviderCommercialProfile(commercialProfile);
  if (!notes.trim() && isProviderCommercialProfileEmpty(normalised)) return "";
  return `${providerMetaMarker}${JSON.stringify({ notes: notes.trim(), commercialProfile: normalised })}`;
}

export function serialiseProgrammeRecordNotes(notes: string, commercialProfile: ProgrammeCommercialProfile) {
  const normalised = normaliseProgrammeCommercialProfile(commercialProfile);
  if (!notes.trim() && isProgrammeCommercialProfileEmpty(normalised)) return "";
  return `${programmeMetaMarker}${JSON.stringify({ notes: notes.trim(), commercialProfile: normalised })}`;
}

export function commercialProfileCompletion(profile: ProviderCommercialProfile) {
  const checks = [
    profile.organisationDescription,
    profile.logoUrl,
    profile.bannerUrl,
    profile.commercialContactName,
    profile.commercialContactEmail,
    profile.yearsEstablished,
    profile.learnerNumbers,
    profile.achievementRate,
    profile.learnerSatisfaction,
    profile.employerSatisfaction,
    profile.awards.length > 0 ? "awards" : "",
    profile.accreditations.length > 0 ? "accreditations" : "",
    profile.caseStudies.length > 0 ? "case-studies" : "",
    profile.testimonials.length > 0 ? "testimonials" : "",
    profile.downloads.length > 0 ? "downloads" : "",
  ].filter(Boolean).length;
  return Math.round((checks / 15) * 100);
}

export function programmeProfileCompletion(profile: ProgrammeCommercialProfile) {
  const checks = [
    profile.tagline,
    profile.idealAudience,
    profile.typicalDepartments.length > 0 ? "departments" : "",
    profile.futureSkillsDeveloped.length > 0 ? "future-skills" : "",
    profile.keyOutcomes.length > 0 ? "outcomes" : "",
    profile.locations.length > 0 ? "locations" : "",
    profile.fundingOptions.length > 0 ? "funding" : "",
    profile.employerCommitment,
    profile.assessmentApproach,
    profile.progressionRoutes.length > 0 ? "progression" : "",
    profile.caseStudies.length > 0 ? "case-studies" : "",
    profile.faqs.length > 0 ? "faqs" : "",
    profile.downloads.length > 0 ? "downloads" : "",
    profile.employerBenefits.length > 0 ? "employer-benefits" : "",
    profile.futureCapabilityImpact.length > 0 ? "future-impact" : "",
  ].filter(Boolean).length;
  return Math.round((checks / 15) * 100);
}
