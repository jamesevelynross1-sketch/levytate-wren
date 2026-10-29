import { z } from "zod";
import type { ProviderCatalogueRecord, ProviderProgramme } from "@/lib/levytate/domain";
import { mvpEmployerPriorityOptions, type MvpMatchingRequest, type MvpProviderRelationship, type MvpRole, type MvpWorkspaceProfile } from "@/lib/levytate/mvp/workspace";
import { ClientRequestError } from "@/lib/server/levytate-request-boundary";

const text = z.string().trim().max(1000);
const required = z.string().trim().min(1).max(160);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const optionalId = z.union([id, z.literal("")]);
const list = z.array(text).max(100);
const ids = z.array(id).max(100).refine((items) => new Set(items).size === items.length, "References must be unique.");
const email = z.union([z.email().max(254), z.literal("")]);
const url = z.union([z.url().refine((value) => { try { const parsed = new URL(value); return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password; } catch { return false; } }, "Use an http or https URL without credentials."), z.literal("")]);
const date = z.string().refine((value) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value), "Use a valid calendar date.");
const timestamp = z.iso.datetime({ offset: true });
const funding = z.enum(["Potentially levy-funded", "Potentially funded through levy/co-investment", "Commercial training budget"]);
const commercialLink = z.strictObject({ label: required, url: url.refine(Boolean), kind: z.enum(["Download", "Brochure", "Case study", "Video", "FAQ"]) });
const providerCommercial = z.strictObject({
  organisationDescription: text, positioningStatement: text, logoUrl: url, bannerUrl: url, primaryContactTitle: text,
  commercialContactName: text, commercialContactEmail: email, commercialContactTitle: text, commercialContactPhone: text,
  yearsEstablished: text, learnerNumbers: text, employerPartners: text, achievementRate: text, learnerSatisfaction: text, employerSatisfaction: text,
  googleReviewSignal: text, awards: list, accreditations: list, caseStudies: list, successStories: list, testimonials: list,
  videoUrl: url, downloads: z.array(commercialLink).max(30), pricingNotes: text, commercialNotes: text, employerSizesSupported: list,
});
const programmeCommercial = z.strictObject({
  tagline: text, idealAudience: text, typicalDepartments: list, futureSkillsDeveloped: list, keyOutcomes: list, locations: list, fundingOptions: list,
  employerCommitment: text, assessmentApproach: text, progressionRoutes: list, caseStudies: list, faqs: list, downloads: z.array(commercialLink).max(30),
  employerBenefits: list, futureCapabilityImpact: list, confidenceLabel: text,
});
const provider = z.strictObject({
  providerId: id, providerName: required, website: url,
  providerType: z.enum(["Independent training provider", "University", "College", "Specialist consultancy", "Employer programme partner", "National provider", "Regional provider", "Employer Provider"]),
  sectors: list, industries: list, technologies: list, deliveryModels: list, regions: list, employerTypes: list, specialisms: list,
  contactName: text, contactEmail: email, ofstedRating: text, status: z.enum(["Active", "Archived"]), sourceUrls: z.array(url.refine(Boolean)).max(30),
  notes: z.string().max(10000), commercialProfile: providerCommercial, lastVerified: date, verificationStatus: z.enum(["verified", "needs_verification"]),
}).refine((record) => record.verificationStatus !== "verified" || (record.sourceUrls.length > 0 && Boolean(record.lastVerified)), "Verified providers require source evidence and a verification date.")
  .refine((record) => !record.lastVerified || record.lastVerified <= new Date().toISOString().slice(0, 10), "Verification cannot be dated in the future.");
const programme = z.strictObject({
  id, providerId: id, programmeName: required, shortDescription: text, fullDescription: z.string().max(20000),
  status: z.enum(["Active", "Needs verification", "Paused", "Not available", "Defunded / unavailable for new starts"]),
  verificationStatus: z.enum(["Verified from provider website", "Needs manual verification", "Provider confirmed", "LevyTate reviewed"]),
  targetOrganisations: list, targetIndustries: list, targetJobRoles: list, seniority: z.enum(["Entry", "Early career", "Experienced", "Supervisor", "Manager", "Mixed"]),
  employerSize: z.enum(["SME", "Mid-market", "Large enterprise", "Mixed employer base"]), businessProblemsSolved: list, skillsDeveloped: list, technologiesCovered: list,
  expectedOutcomes: list, deliveryModels: list, regions: list, duration: text, cohortOptions: list, commercialNotes: text, fundingRoute: funding,
  linkedStandardId: id, linkedStandardIds: ids.min(1), linkedStandardName: text, level: z.number().int().min(2).max(8).nullable(), route: text,
  fundingBand: z.number().int().nonnegative().max(100000).nullable(), officialUrl: url, sourceUrl: url, notes: z.string().max(10000),
  commercialProfile: programmeCommercial, recordStatus: z.enum(["Active", "Archived"]), createdAt: timestamp, updatedAt: timestamp,
}).refine((record) => record.linkedStandardIds.includes(record.linkedStandardId), "The primary standard must belong to the linked standards.")
  .refine((record) => record.verificationStatus === "Needs manual verification" || Boolean(record.sourceUrl), "Verified programmes require a source URL.");
const role = z.strictObject({
  id, title: required, department: required, businessArea: text, careerLevel: z.enum(["Entry", "Experienced", "Supervisor", "Manager", "Senior Manager"]),
  skillsTags: list, progression: list, status: z.enum(["Active", "Archived"]), createdAt: timestamp, updatedAt: timestamp,
  pathwayMappings: z.array(z.strictObject({ id, apprenticeshipStandardId: id, recommendationType: z.enum(["Primary", "Alternative"]), priority: z.number().int().min(1).max(100),
    businessRationale: text, fundingRoute: funding, deliveryPreference: z.enum(["Blended", "Site based", "Remote workshops", "Hybrid", "Online + coaching"]) })).min(1).max(20),
}).refine((record) => record.pathwayMappings.filter((mapping) => mapping.recommendationType === "Primary").length === 1, "Choose exactly one primary standard.")
  .refine((record) => new Set(record.pathwayMappings.map((mapping) => mapping.id)).size === record.pathwayMappings.length && new Set(record.pathwayMappings.map((mapping) => mapping.apprenticeshipStandardId)).size === record.pathwayMappings.length, "Role mappings must be unique.");
const profile = z.strictObject({
  employerName: required, workspaceName: required, primaryContact: text, contactEmail: email, defaultSite: text, sites: list, departments: list,
  priorities: z.array(z.strictObject({ id, name: z.enum(mvpEmployerPriorityOptions), importance: z.enum(["Critical", "High", "Medium"]), detail: text })).max(3),
});
const relationship = z.strictObject({
  id, category: z.enum(["Digital", "Engineering", "Business Improvement", "Marketing", "Leadership", "Data", "Customer", "Procurement"]),
  preferredProviderId: id, backupProviderIds: ids, programmeIds: ids, status: z.enum(["Preferred", "Review due", "Alternative required"]), notes: z.string().max(10000), reviewDate: date, lastUsedDate: date,
}).refine((record) => !record.backupProviderIds.includes(record.preferredProviderId), "A preferred provider cannot also be a backup.");
const matching = z.strictObject({
  id, roleNeed: required, department: text, futureCapability: text, employerSize: z.enum(["", "SME", "Mid-market", "Large enterprise", "Mixed employer base"]),
  programmeId: optionalId, linkedStandardId: optionalId, learnerCount: z.number().int().min(1).max(100000), sites: list, deliveryPreference: text, fundingPosition: text,
  urgency: text, notes: z.string().max(10000), businessProblems: list, targetRoles: list, technologies: list, industries: list,
  status: z.enum(["Submitted", "Under Review", "Provider Shortlist Being Prepared", "Shortlist Ready"]), shortlistProviderIds: ids, createdAt: timestamp, updatedAt: timestamp,
});

function parse<T>(schema: z.ZodType, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ClientRequestError(`Check catalogue details: ${result.error.issues[0]?.path.join(".") || "record"} ${result.error.issues[0]?.message ?? "is invalid"}`, 422);
  return result.data as T;
}
export const parseProvider = (input: unknown) => parse<ProviderCatalogueRecord>(provider, input);
export const parseProgramme = (input: unknown) => parse<ProviderProgramme>(programme, input);
export const parseRole = (input: unknown) => parse<MvpRole>(role, input);
export const parseProfile = (input: unknown) => parse<MvpWorkspaceProfile>(profile, input);
export const parseRelationship = (input: unknown) => parse<MvpProviderRelationship>(relationship, input);
export const parseMatchingRequest = (input: unknown) => parse<MvpMatchingRequest>(matching, input);
