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

export function allProviderProgrammes(
  providers: ProviderCatalogueRecord[],
  programmes: ProviderProgramme[],
  standards: ApprenticeshipStandard[],
) {
  return programmes.map((programme) => ({
    programme,
    provider: providers.find((provider) => provider.providerId === programme.providerId),
    standard: standards.find((standard) => standard.id === programme.apprenticeshipStandardId),
  }));
}

export function uniqueProviderValues(providers: ProviderCatalogueRecord[], field: "sectors" | "deliveryModel" | "regions") {
  return Array.from(new Set(providers.flatMap((provider) => provider[field]))).sort((a, b) => a.localeCompare(b));
}

export function uniqueProgrammeNames(programmes: ProviderProgramme[], standards: ApprenticeshipStandard[]) {
  const ids = new Set(programmes.map((programme) => programme.apprenticeshipStandardId));
  return standards.filter((standard) => ids.has(standard.id)).map((standard) => standard.title).sort((a, b) => a.localeCompare(b));
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
    const linkedStandards = deliveries
      .map((programme) => standards.find((standard) => standard.id === programme.apprenticeshipStandardId))
      .filter((standard): standard is ApprenticeshipStandard => Boolean(standard));
    const searchable = [
      provider.providerName,
      provider.providerType,
      provider.website,
      provider.contactName,
      provider.contactEmail,
      provider.notes,
      provider.sectors.join(" "),
      provider.deliveryModel.join(" "),
      provider.regions.join(" "),
      linkedStandards.map((standard) => `${standard.title} ${standard.referenceCode} ${standard.occupationalRoute}`).join(" "),
    ].join(" ").toLowerCase();

    return (!query || searchable.includes(query))
      && (filters.sector === "All" || provider.sectors.includes(filters.sector) || linkedStandards.some((standard) => standard.occupationalRoute === filters.sector))
      && (filters.programme === "All" || linkedStandards.some((standard) => standard.title === filters.programme))
      && (filters.deliveryModel === "All" || provider.deliveryModel.includes(filters.deliveryModel) || deliveries.some((programme) => programme.deliveryMode.includes(filters.deliveryModel)))
      && (filters.region === "All" || provider.regions.includes(filters.region) || deliveries.some((programme) => programme.regions.includes(filters.region)))
      && (filters.status === "All" || provider.status === filters.status);
  });
}

export type ProviderMatchNeed = {
  apprenticeshipStandardId: string;
  deliveryModel?: string;
  region?: string;
};

export function isVerifiedProviderProgramme(programme: ProviderProgramme) {
  return programme.verificationStatus !== "Needs manual verification";
}

export function shortlistProvidersForNeed(
  providers: ProviderCatalogueRecord[],
  programmes: ProviderProgramme[],
  standards: ApprenticeshipStandard[],
  need: ProviderMatchNeed,
) {
  const standard = standards.find((item) => item.id === need.apprenticeshipStandardId);
  if (!standard || standard.status !== "Live") return [];

  return providers
    .filter((provider) => provider.status === "Active")
    .flatMap((provider) => {
      const exactDeliveries = programmes.filter((programme) =>
        programme.providerId === provider.providerId
        && programme.apprenticeshipStandardId === standard.id
        && programme.recordStatus === "Active"
        && programme.status === "Active"
      );

      return exactDeliveries.map((programme) => {
        const deliveryFit = !need.deliveryModel
          || provider.deliveryModel.some((model) => model.toLowerCase().includes(need.deliveryModel!.toLowerCase()))
          || programme.deliveryMode.toLowerCase().includes(need.deliveryModel.toLowerCase());
        const regionFit = !need.region
          || provider.regions.includes(need.region)
          || programme.regions.includes(need.region)
          || programme.regions.includes("England");
        const verified = isVerifiedProviderProgramme(programme);
        const score = Math.min(100, 65 + (deliveryFit ? 12 : 0) + (regionFit ? 10 : 0) + (verified ? 13 : 0));

        return {
          provider,
          programme,
          standard,
          score,
          verified,
          reasons: [
            `Delivers ${standard.referenceCode}`,
            deliveryFit ? "Delivery model fit" : null,
            regionFit ? "Geographic fit" : null,
            verified ? programme.verificationStatus : "Delivery requires verification",
          ].filter(Boolean) as string[],
        };
      });
    })
    .sort((a, b) => Number(b.verified) - Number(a.verified) || b.score - a.score || a.provider.providerName.localeCompare(b.provider.providerName));
}

export function fundingLabel(standard: ApprenticeshipStandard) {
  return standard.fundingBand === null
    ? "Funding band requires confirmation"
    : `Maximum funding band £${standard.fundingBand.toLocaleString("en-GB")}`;
}