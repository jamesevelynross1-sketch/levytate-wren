import type {
  ApprenticeshipStandard,
  ProviderCatalogueFilters,
  ProviderCatalogueRecord,
  ProviderProgramme,
} from "./types";

export const defaultProviderCatalogueFilters: ProviderCatalogueFilters = {
  search: "",
  sector: "All",
  programme: "All",
  deliveryModel: "All",
  region: "All",
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

export function filterProviderCatalogue(
  providers: ProviderCatalogueRecord[],
  programmes: ProviderProgramme[],
  standards: ApprenticeshipStandard[],
  filters: ProviderCatalogueFilters,
) {
  const query = filters.search.trim().toLowerCase();

  return providers.filter((provider) => {
    const deliveries = providerProgrammesFor(provider.providerId, programmes);
    const linkedStandards = deliveries.flatMap((programme) => programme.linkedStandardIds.map((standardId) => standards.find((standard) => standard.id === standardId)).filter((standard): standard is ApprenticeshipStandard => Boolean(standard)));
    const searchable = [
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
      ].join(" ")).join(" "),
      linkedStandards.map((standard) => `${standard.title} ${standard.referenceCode} ${standard.occupationalRoute}`).join(" "),
    ].join(" ").toLowerCase();

    return (!query || searchable.includes(query))
      && (filters.sector === "All" || provider.sectors.includes(filters.sector) || provider.industries.includes(filters.sector) || deliveries.some((programme) => programme.targetIndustries.includes(filters.sector)) || linkedStandards.some((standard) => standard.occupationalRoute === filters.sector))
      && (filters.programme === "All" || deliveries.some((programme) => programme.programmeName === filters.programme) || linkedStandards.some((standard) => standard.title === filters.programme))
      && (filters.deliveryModel === "All" || provider.deliveryModels.includes(filters.deliveryModel) || deliveries.some((programme) => programme.deliveryModels.includes(filters.deliveryModel)))
      && (filters.region === "All" || provider.regions.includes(filters.region) || deliveries.some((programme) => programme.regions.includes(filters.region)))
      && (filters.status === "All" || provider.status === filters.status);
  });
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

export function isVerifiedProviderProgramme(programme: ProviderProgramme) {
  return programme.verificationStatus !== "Needs manual verification" && programme.status !== "Needs verification";
}

function normalise(value: string) {
  return value.toLowerCase().trim();
}

function scoreOverlap(source: string[], targets: string[]) {
  if (!source.length || !targets.length) return 0;
  const normalisedSource = source.map(normalise);
  const normalisedTargets = targets.map(normalise);
  return normalisedTargets.reduce((score, target) => score + (normalisedSource.some((item) => item.includes(target) || target.includes(item)) ? 1 : 0), 0);
}

export function shortlistProvidersForNeed(
  providers: ProviderCatalogueRecord[],
  programmes: ProviderProgramme[],
  standards: ApprenticeshipStandard[],
  need: ProviderMatchNeed,
  relationships: ProviderRelationshipSignal[] = [],
) {
  const requestedProgramme = need.programmeId ? programmes.find((programme) => programme.id === need.programmeId) : undefined;
  const requiredStandard = need.linkedStandardId ? standards.find((standard) => standard.id === need.linkedStandardId) : undefined;
  const preferredRelationshipByProvider = new Map<string, ProviderRelationshipSignal[]>();
  for (const relationship of relationships) {
    const current = preferredRelationshipByProvider.get(relationship.preferredProviderId) ?? [];
    current.push(relationship);
    preferredRelationshipByProvider.set(relationship.preferredProviderId, current);
  }

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
        const programmeText = [
          programme.programmeName,
          programme.shortDescription,
          programme.fullDescription,
          programme.targetIndustries.join(" "),
          programme.targetJobRoles.join(" "),
          programme.technologiesCovered.join(" "),
          programme.businessProblemsSolved.join(" "),
          programme.expectedOutcomes.join(" "),
        ].join(" ").toLowerCase();
        const roleFit = need.roleNeed ? (programmeText.includes(need.roleNeed.toLowerCase()) || scoreOverlap(programme.targetJobRoles, [need.roleNeed]) > 0) : false;
        const departmentFit = need.department ? programmeText.includes(need.department.toLowerCase()) : false;
        const futureCapabilityFit = need.futureCapability ? programmeText.includes(need.futureCapability.toLowerCase()) || scoreOverlap(programme.expectedOutcomes, [need.futureCapability]) > 0 : false;
        const technologyScore = scoreOverlap(programme.technologiesCovered, need.technologies ?? []);
        const industryScore = scoreOverlap(programme.targetIndustries, need.industries ?? []);
        const problemScore = scoreOverlap(programme.businessProblemsSolved, need.businessProblems ?? []);
        const targetRoleScore = scoreOverlap(programme.targetJobRoles, need.targetRoles ?? []);
        const deliveryFit = !need.deliveryModel || programme.deliveryModels.some((model) => model.toLowerCase().includes(need.deliveryModel!.toLowerCase())) || provider.deliveryModels.some((model) => model.toLowerCase().includes(need.deliveryModel!.toLowerCase()));
        const regionFit = !need.region || programme.regions.includes(need.region) || provider.regions.includes(need.region) || programme.regions.includes("England");
        const employerSizeFit = !need.employerSize || programme.employerSize === "Mixed employer base" || programme.employerSize === need.employerSize;
        const programmePinned = requestedProgramme ? requestedProgramme.id === programme.id : false;
        const standardFit = requiredStandard ? programme.linkedStandardIds.includes(requiredStandard.id) : false;
        const verified = isVerifiedProviderProgramme(programme);
        const score = Math.min(
          100,
          36
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
          + (employerSizeFit ? 2 : 0)
          + (verified ? 4 : 0),
        );

        return {
          provider,
          programme,
          standards: programme.linkedStandardIds.map((standardId) => standards.find((standard) => standard.id === standardId)).filter((standard): standard is ApprenticeshipStandard => Boolean(standard)),
          score,
          verified,
          reasons: [
            programmePinned ? "Selected programme preference" : null,
            preferredRelationship ? "Preferred provider relationship already in place" : null,
            programmeCoveredByRelationship ? "Programme already covered by provider relationship" : null,
            standardFit ? "Linked standard supports funding and compliance" : null,
            roleFit ? "Target role alignment" : null,
            departmentFit ? "Department context reflected in programme positioning" : null,
            futureCapabilityFit ? "Future capability goal reflected in expected outcomes" : null,
            technologyScore ? `${technologyScore} technology match${technologyScore > 1 ? "es" : ""}` : null,
            industryScore ? `${industryScore} industry match${industryScore > 1 ? "es" : ""}` : null,
            problemScore ? `${problemScore} business problem match${problemScore > 1 ? "es" : ""}` : null,
            targetRoleScore ? `${targetRoleScore} target role match${targetRoleScore > 1 ? "es" : ""}` : null,
            deliveryFit ? "Delivery model fit" : null,
            regionFit ? "Regional fit" : null,
            employerSizeFit ? "Employer size fit" : null,
            verified ? programme.verificationStatus : "Programme needs verification",
          ].filter(Boolean) as string[],
        };
      });
    })
    .sort((a, b) => Number(b.verified) - Number(a.verified) || b.score - a.score || a.programme.programmeName.localeCompare(b.programme.programmeName));
}

export function fundingLabel(standard: ApprenticeshipStandard) {
  return standard.fundingBand === null
    ? "Funding band requires confirmation"
    : `Maximum funding band GBP ${standard.fundingBand.toLocaleString("en-GB")}`;
}
