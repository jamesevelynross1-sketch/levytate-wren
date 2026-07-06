import type {
  ApprenticeshipStandard,
  ProviderCatalogueFilters,
  ProviderCatalogueRecord,
  ProviderProgramme,
} from "./types";
import {
  commercialProfileCompletion,
  programmeProfileCompletion,
} from "./provider-commercial";
import {
  normaliseProviderTaxonomy,
  taxonomyValuesForProvider,
} from "./provider-taxonomy";

export const defaultProviderCatalogueFilters: ProviderCatalogueFilters = {
  search: "",
  sector: "All",
  technology: "All",
  businessChallenge: "All",
  deliveryModel: "All",
  region: "All",
  employerType: "All",
  programmeLevel: "All",
  programme: "All",
  status: "Active",
};

export function providerProgrammesFor(providerId: string, programmes: ProviderProgramme[]) {
  return programmes.filter((programme) => programme.providerId === providerId);
}

export function programmePrimaryStandard(programme: ProviderProgramme, standards: ApprenticeshipStandard[]) {
  if (programme.linkedStandardId) {
    const direct = standards.find((standard) => standard.id === programme.linkedStandardId);
    if (direct) return direct;
  }
  return standards.find((standard) => standard.id === programme.linkedStandardIds[0]);
}

export function allProviderProgrammes(
  providers: ProviderCatalogueRecord[],
  programmes: ProviderProgramme[],
  standards: ApprenticeshipStandard[],
) {
  return programmes.map((programme) => ({
    programme,
    provider: providers.find((provider) => provider.providerId === programme.providerId),
    standards: programme.linkedStandardIds.map((standardId) => standards.find((standard) => standard.id === standardId)).filter((standard): standard is ApprenticeshipStandard => Boolean(standard)),
  }));
}

export function uniqueProviderValues(providers: ProviderCatalogueRecord[], field: "sectors" | "deliveryModels" | "regions" | "industries") {
  return Array.from(new Set(providers.flatMap((provider) => provider[field]))).sort((a, b) => a.localeCompare(b));
}

export function uniqueProgrammeNames(programmes: ProviderProgramme[]) {
  return Array.from(new Set(programmes.map((programme) => programme.programmeName))).sort((a, b) => a.localeCompare(b));
}

function uniqueSorted(values: string[]) {
  return normaliseProviderTaxonomy(values).sort((left, right) => {
    if (left === "Needs verification") return 1;
    if (right === "Needs verification") return -1;
    return left.localeCompare(right);
  });
}

export function providerCatalogueFilterOptions(
  providers: ProviderCatalogueRecord[],
  programmes: ProviderProgramme[],
) {
  const activeProgrammes = programmes.filter((programme) => programme.recordStatus === "Active");
  return providers.reduce(
    (options, provider) => {
      const providerProgrammes = activeProgrammes.filter((programme) => programme.providerId === provider.providerId);
      const taxonomy = taxonomyValuesForProvider(provider, providerProgrammes);
      options.sectors.push(...taxonomy.sectors);
      options.technologies.push(...taxonomy.technologies);
      options.businessChallenges.push(...taxonomy.businessChallenges);
      options.deliveryModels.push(...taxonomy.deliveryModels);
      options.regions.push(...taxonomy.regions);
      options.employerTypes.push(...taxonomy.employerTypes);
      options.programmeLevels.push(...taxonomy.programmeLevels);
      options.programmes.push(...providerProgrammes.map((programme) => programme.programmeName));
      return options;
    },
    {
      sectors: [] as string[],
      technologies: [] as string[],
      businessChallenges: [] as string[],
      deliveryModels: [] as string[],
      regions: [] as string[],
      employerTypes: [] as string[],
      programmeLevels: [] as string[],
      programmes: [] as string[],
    },
  );
}

export function normalisedProviderCatalogueFilterOptions(
  providers: ProviderCatalogueRecord[],
  programmes: ProviderProgramme[],
) {
  const options = providerCatalogueFilterOptions(providers, programmes);
  return {
    sectors: uniqueSorted(options.sectors),
    technologies: uniqueSorted(options.technologies),
    businessChallenges: uniqueSorted(options.businessChallenges),
    deliveryModels: uniqueSorted(options.deliveryModels),
    regions: uniqueSorted(options.regions),
    employerTypes: uniqueSorted(options.employerTypes),
    programmeLevels: uniqueSorted(options.programmeLevels),
    programmes: uniqueSorted(options.programmes),
  };
}

function normalise(value: string) {
  return value.toLowerCase().trim();
}

function queryParts(query: string) {
  return normalise(query).split(/\s+/).filter(Boolean);
}

function hasQuery(value: string, query: string) {
  const target = normalise(value);
  const parts = queryParts(query);
  return Boolean(query) && parts.every((part) => target.includes(part));
}

function includesQuery(value: string, query: string) {
  return normalise(value).includes(query);
}

function fieldScore(values: string[], query: string, weight: number) {
  if (!query.trim()) return 0;
  const parts = queryParts(query);
  return values.reduce((score, rawValue) => {
    const value = normalise(rawValue);
    if (!value) return score;
    if (value === normalise(query)) return score + weight * 4;
    if (value.startsWith(normalise(query))) return score + weight * 3;
    if (parts.every((part) => value.split(/\s+/).some((word) => word.startsWith(part)))) return score + weight * 2.5;
    if (parts.every((part) => value.includes(part))) return score + weight * 1.5;
    return score;
  }, 0);
}

function searchableProviderText(provider: ProviderCatalogueRecord, deliveries: ProviderProgramme[], standards: ApprenticeshipStandard[]) {
  return [
    provider.providerName,
    provider.providerType,
    provider.website,
    provider.contactName,
    provider.contactEmail,
    provider.notes,
    provider.sectors.join(" "),
    provider.industries.join(" "),
    provider.technologies.join(" "),
    provider.deliveryModels.join(" "),
    provider.regions.join(" "),
    provider.employerTypes.join(" "),
    provider.specialisms.join(" "),
    provider.commercialProfile.organisationDescription,
    provider.commercialProfile.awards.join(" "),
    provider.commercialProfile.accreditations.join(" "),
    provider.commercialProfile.caseStudies.join(" "),
    provider.commercialProfile.successStories.join(" "),
    provider.commercialProfile.testimonials.join(" "),
    provider.commercialProfile.pricingNotes,
    provider.commercialProfile.commercialNotes,
    provider.commercialProfile.employerSizesSupported.join(" "),
    deliveries.map((programme) => [
      programme.programmeName,
      programme.shortDescription,
      programme.fullDescription,
      programme.targetOrganisations.join(" "),
      programme.targetIndustries.join(" "),
      programme.targetJobRoles.join(" "),
      programme.businessProblemsSolved.join(" "),
      programme.skillsDeveloped.join(" "),
      programme.technologiesCovered.join(" "),
      programme.expectedOutcomes.join(" "),
      programme.deliveryModels.join(" "),
      programme.commercialProfile.tagline,
      programme.commercialProfile.idealAudience,
      programme.commercialProfile.typicalDepartments.join(" "),
      programme.commercialProfile.futureSkillsDeveloped.join(" "),
      programme.commercialProfile.keyOutcomes.join(" "),
      programme.commercialProfile.locations.join(" "),
      programme.commercialProfile.fundingOptions.join(" "),
      programme.commercialProfile.progressionRoutes.join(" "),
      programme.commercialProfile.employerBenefits.join(" "),
      programme.commercialProfile.futureCapabilityImpact.join(" "),
      programme.notes,
    ].join(" ")).join(" "),
    deliveries.flatMap((programme) => programme.linkedStandardIds).map((standardId) => standards.find((standard) => standard.id === standardId)).filter((standard): standard is ApprenticeshipStandard => Boolean(standard)).map((standard) => `${standard.title} ${standard.referenceCode} ${standard.occupationalRoute} ${(standard.jobTitles ?? []).join(" ")}`).join(" "),
  ].join(" ").toLowerCase();
}

export function providerSearchScore(
  provider: ProviderCatalogueRecord,
  deliveries: ProviderProgramme[],
  standards: ApprenticeshipStandard[],
  query: string,
) {
  if (!query.trim()) return 0;
  return fieldScore(deliveries.map((programme) => programme.programmeName), query, 20)
    + fieldScore([provider.providerName], query, 18)
    + fieldScore(deliveries.flatMap((programme) => programme.technologiesCovered), query, 14)
    + fieldScore(provider.technologies, query, 13)
    + fieldScore(deliveries.flatMap((programme) => programme.businessProblemsSolved), query, 12)
    + fieldScore(deliveries.flatMap((programme) => programme.targetJobRoles), query, 11)
    + fieldScore(deliveries.flatMap((programme) => programme.targetIndustries), query, 8)
    + fieldScore(provider.industries, query, 6)
    + (hasQuery(searchableProviderText(provider, deliveries, standards), query) ? 3 : 0);
}

function filterIsAll(value: string) {
  return value === "All";
}

function providerMatchesFilters(
  provider: ProviderCatalogueRecord,
  deliveries: ProviderProgramme[],
  standards: ApprenticeshipStandard[],
  filters: ProviderCatalogueFilters,
) {
  const taxonomy = taxonomyValuesForProvider(provider, deliveries);
  const linkedStandards = deliveries.flatMap((programme) => programme.linkedStandardIds.map((standardId) => standards.find((standard) => standard.id === standardId)).filter((standard): standard is ApprenticeshipStandard => Boolean(standard)));

  return (filters.status === "All" || provider.status === filters.status)
    && (filterIsAll(filters.sector) || taxonomy.sectors.includes(filters.sector) || linkedStandards.some((standard) => standard.occupationalRoute === filters.sector))
    && (filterIsAll(filters.technology) || taxonomy.technologies.includes(filters.technology))
    && (filterIsAll(filters.businessChallenge) || taxonomy.businessChallenges.includes(filters.businessChallenge))
    && (filterIsAll(filters.deliveryModel) || taxonomy.deliveryModels.includes(filters.deliveryModel))
    && (filterIsAll(filters.region) || taxonomy.regions.includes(filters.region))
    && (filterIsAll(filters.employerType) || taxonomy.employerTypes.includes(filters.employerType))
    && (filterIsAll(filters.programmeLevel) || taxonomy.programmeLevels.includes(filters.programmeLevel))
    && (filterIsAll(filters.programme) || deliveries.some((programme) => programme.programmeName === filters.programme) || linkedStandards.some((standard) => standard.title === filters.programme));
}

export function filterProviderCatalogue(
  providers: ProviderCatalogueRecord[],
  programmes: ProviderProgramme[],
  standards: ApprenticeshipStandard[],
  filters: ProviderCatalogueFilters,
) {
  const query = filters.search.trim();

  return providers
    .map((provider) => {
      const deliveries = providerProgrammesFor(provider.providerId, programmes).filter((programme) => programme.recordStatus === "Active");
      return {
        provider,
        score: providerSearchScore(provider, deliveries, standards, query),
        matches: providerMatchesFilters(provider, deliveries, standards, filters),
      };
    })
    .filter((item) => item.matches && (!query || item.score > 0))
    .sort((left, right) => right.score - left.score || left.provider.providerName.localeCompare(right.provider.providerName))
    .map((item) => item.provider);
}

export type ProviderRelationshipSignal = {
  preferredProviderId: string;
  programmeIds: string[];
  status: string;
};

export type ProviderMatchNeed = {
  roleNeed: string;
  department?: string;
  futureCapability?: string;
  employerSize?: string;
  deliveryModel?: string;
  region?: string;
  technologies?: string[];
  industries?: string[];
  businessProblems?: string[];
  targetRoles?: string[];
  linkedStandardId?: string;
  programmeId?: string;
};

export type ProviderShortlistResult = {
  provider: ProviderCatalogueRecord;
  programme: ProviderProgramme;
  standards: ApprenticeshipStandard[];
  score: number;
  verified: boolean;
  confidence: "High" | "Medium" | "Low";
  reasons: string[];
  skillsMatched: string[];
  businessProblemsMatched: string[];
  technologyAlignment: string[];
  industryAlignment: string[];
  deliveryFit: string;
  fundingSuitability: string;
  employerBenefits: string[];
  futureCapabilityImpact: string[];
  strengths: string[];
  potentialRisks: string[];
  recommendedEmployerType: string;
};

export function isVerifiedProviderProgramme(programme: ProviderProgramme) {
  return programme.verificationStatus !== "Needs manual verification" && programme.status !== "Needs verification";
}

function scoreOverlap(source: string[], targets: string[]) {
  const normalisedSource = normaliseProviderTaxonomy(source);
  const normalisedTargets = normaliseProviderTaxonomy(targets);
  if (!normalisedSource.length || !normalisedTargets.length) return 0;
  return normalisedTargets.reduce((score, target) => score + (normalisedSource.some((item) => normalise(item).includes(normalise(target)) || normalise(target).includes(normalise(item))) ? 1 : 0), 0);
}

function matchedValues(source: string[], targets: string[]) {
  const normalisedSource = normaliseProviderTaxonomy(source);
  const normalisedTargets = normaliseProviderTaxonomy(targets);
  return normalisedSource.filter((item) => normalisedTargets.some((target) => normalise(item).includes(normalise(target)) || normalise(target).includes(normalise(item))));
}

export function shortlistProvidersForNeed(
  providers: ProviderCatalogueRecord[],
  programmes: ProviderProgramme[],
  standards: ApprenticeshipStandard[],
  need: ProviderMatchNeed,
  relationships: ProviderRelationshipSignal[] = [],
): ProviderShortlistResult[] {
  const requestedProgramme = need.programmeId ? programmes.find((programme) => programme.id === need.programmeId) : undefined;
  const requiredStandard = need.linkedStandardId ? standards.find((standard) => standard.id === need.linkedStandardId) : undefined;
  const preferredRelationshipByProvider = new Map<string, ProviderRelationshipSignal[]>();
  for (const relationship of relationships) {
    const current = preferredRelationshipByProvider.get(relationship.preferredProviderId) ?? [];
    current.push(relationship);
    preferredRelationshipByProvider.set(relationship.preferredProviderId, current);
  }

  const needTechnologies = normaliseProviderTaxonomy(need.technologies ?? []);
  const needIndustries = normaliseProviderTaxonomy(need.industries ?? []);
  const needBusinessProblems = normaliseProviderTaxonomy(need.businessProblems ?? []);
  const needTargetRoles = normaliseProviderTaxonomy(need.targetRoles ?? []);

  return providers
    .filter((provider) => provider.status === "Active")
    .flatMap((provider) => {
      const eligibleProgrammes = programmes.filter((programme) =>
        programme.providerId === provider.providerId
        && programme.recordStatus === "Active"
        && programme.status !== "Not available",
      );

      return eligibleProgrammes.map((programme) => {
        const providerRelationships = preferredRelationshipByProvider.get(provider.providerId) ?? [];
        const programmeCoveredByRelationship = providerRelationships.some((relationship) => relationship.programmeIds.includes(programme.id));
        const preferredRelationship = providerRelationships.some((relationship) => relationship.status === "Preferred");
        const programmeText = searchableProviderText(provider, [programme], standards);
        const roleFit = need.roleNeed ? (includesQuery(programmeText, need.roleNeed.toLowerCase()) || scoreOverlap(programme.targetJobRoles, [need.roleNeed]) > 0) : false;
        const departmentFit = need.department ? includesQuery(programmeText, need.department.toLowerCase()) || scoreOverlap(programme.commercialProfile.typicalDepartments, [need.department]) > 0 : false;
        const futureCapabilityFit = need.futureCapability ? includesQuery(programmeText, need.futureCapability.toLowerCase()) || scoreOverlap(programme.commercialProfile.futureCapabilityImpact, [need.futureCapability]) > 0 : false;
        const technologyScore = scoreOverlap([...provider.technologies, ...programme.technologiesCovered], needTechnologies);
        const industryScore = scoreOverlap([...provider.industries, ...programme.targetIndustries], needIndustries);
        const problemScore = scoreOverlap([...provider.specialisms, ...programme.businessProblemsSolved, ...programme.expectedOutcomes], needBusinessProblems);
        const targetRoleScore = scoreOverlap(programme.targetJobRoles, needTargetRoles);
        const deliveryFit = !need.deliveryModel || normaliseProviderTaxonomy([...programme.deliveryModels, ...provider.deliveryModels]).some((model) => normalise(model).includes(normalise(need.deliveryModel!)) || normalise(need.deliveryModel!).includes(normalise(model)));
        const regionFit = !need.region || normaliseProviderTaxonomy([...programme.regions, ...provider.regions]).some((region) => region === need.region || region === "England");
        const employerSizeFit = !need.employerSize || programme.employerSize === "Mixed employer base" || programme.employerSize === need.employerSize || provider.commercialProfile.employerSizesSupported.includes(need.employerSize);
        const programmePinned = requestedProgramme ? requestedProgramme.id === programme.id : false;
        const standardFit = requiredStandard ? programme.linkedStandardIds.includes(requiredStandard.id) : false;
        const verified = isVerifiedProviderProgramme(programme);
        const profileScore = Math.round((commercialProfileCompletion(provider.commercialProfile) + programmeProfileCompletion(programme.commercialProfile)) / 8);
        const score = Math.min(
          100,
          34
          + (programmePinned ? 18 : 0)
          + (preferredRelationship ? 8 : 0)
          + (programmeCoveredByRelationship ? 8 : 0)
          + (standardFit ? 8 : 0)
          + (roleFit ? 10 : 0)
          + (departmentFit ? 4 : 0)
          + (futureCapabilityFit ? 6 : 0)
          + technologyScore * 4
          + industryScore * 4
          + problemScore * 5
          + targetRoleScore * 4
          + (deliveryFit ? 5 : 0)
          + (regionFit ? 4 : 0)
          + (employerSizeFit ? 3 : 0)
          + (verified ? 4 : 0)
          + profileScore,
        );

        const technologyAlignment = matchedValues([...provider.technologies, ...programme.technologiesCovered], needTechnologies);
        const industryAlignment = matchedValues([...provider.industries, ...programme.targetIndustries], needIndustries);
        const businessProblemsMatched = matchedValues([...provider.specialisms, ...programme.businessProblemsSolved, ...programme.expectedOutcomes], needBusinessProblems);
        const skillsMatched = matchedValues(programme.skillsDeveloped, [...needTargetRoles, ...needTechnologies, ...needBusinessProblems]);
        const strengths = [
          ...technologyAlignment,
          ...industryAlignment,
          ...businessProblemsMatched,
          ...programme.commercialProfile.employerBenefits.slice(0, 2),
        ].filter(Boolean).slice(0, 4);
        const potentialRisks = [
          !verified ? "Programme still needs full verification" : null,
          !regionFit ? "Regional delivery fit requires confirmation" : null,
          !deliveryFit ? "Delivery model may need adaptation" : null,
          !employerSizeFit ? "Employer size fit should be checked during matching" : null,
        ].filter(Boolean) as string[];

        return {
          provider,
          programme,
          standards: programme.linkedStandardIds.map((standardId) => standards.find((standard) => standard.id === standardId)).filter((standard): standard is ApprenticeshipStandard => Boolean(standard)),
          score,
          verified,
          confidence: score >= 88 ? "High" : score >= 75 ? "Medium" : "Low",
          reasons: [
            programmePinned ? "Selected programme preference" : null,
            preferredRelationship ? "Preferred provider relationship already in place" : null,
            programmeCoveredByRelationship ? "Programme already covered by provider relationship" : null,
            standardFit ? "Linked standard supports funding and compliance" : null,
            roleFit ? "Target role alignment" : null,
            departmentFit ? "Department context reflected in programme positioning" : null,
            futureCapabilityFit ? "Future capability goal reflected in expected outcomes" : null,
            technologyAlignment.length ? `Technology taxonomy match: ${technologyAlignment.join(", ")}` : null,
            industryAlignment.length ? `Sector taxonomy match: ${industryAlignment.join(", ")}` : null,
            businessProblemsMatched.length ? `Business challenge match: ${businessProblemsMatched.join(", ")}` : null,
            targetRoleScore ? `${targetRoleScore} target role match${targetRoleScore > 1 ? "es" : ""}` : null,
            deliveryFit ? "Delivery model fit" : null,
            regionFit ? "Regional fit" : null,
            employerSizeFit ? "Employer type fit" : null,
            verified ? programme.verificationStatus : "Programme needs verification",
          ].filter(Boolean) as string[],
          skillsMatched,
          businessProblemsMatched,
          technologyAlignment,
          industryAlignment,
          deliveryFit: deliveryFit ? `Aligned to ${need.deliveryModel ?? "preferred delivery"}` : "Delivery fit needs confirmation",
          fundingSuitability: programme.fundingRoute,
          employerBenefits: programme.commercialProfile.employerBenefits.length ? programme.commercialProfile.employerBenefits : programme.expectedOutcomes,
          futureCapabilityImpact: programme.commercialProfile.futureCapabilityImpact.length ? programme.commercialProfile.futureCapabilityImpact : programme.expectedOutcomes,
          strengths,
          potentialRisks,
          recommendedEmployerType: programme.employerSize === "Mixed employer base" ? (provider.employerTypes[0] ?? "Employer fit to confirm") : programme.employerSize,
        } satisfies ProviderShortlistResult;
      });
    })
    .sort((a, b) => Number(b.verified) - Number(a.verified) || b.score - a.score || a.programme.programmeName.localeCompare(b.programme.programmeName));
}

export function fundingLabel(standard: ApprenticeshipStandard) {
  return standard.fundingBand === null
    ? "Funding band requires confirmation"
    : `Maximum funding band GBP ${standard.fundingBand.toLocaleString("en-GB")}`;
}
