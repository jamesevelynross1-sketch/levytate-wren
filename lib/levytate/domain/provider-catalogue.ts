import type { ProviderCatalogueFilters, ProviderCatalogueRecord, ProviderProgramme } from "./types";

export const defaultProviderCatalogueFilters: ProviderCatalogueFilters = {
  search: "",
  sector: "All",
  programme: "All",
  deliveryModel: "All",
  region: "All",
  status: "Active",
};

export function allProviderProgrammes(providers: ProviderCatalogueRecord[]) {
  return providers.flatMap((provider) => provider.programmes.map((programme) => ({ ...programme, providerId: provider.providerId, providerName: provider.providerName })));
}

export function uniqueProviderValues(providers: ProviderCatalogueRecord[], field: "sectors" | "deliveryModel" | "regions") {
  return Array.from(new Set(providers.flatMap((provider) => provider[field]))).sort((a, b) => a.localeCompare(b));
}

export function uniqueProgrammeNames(providers: ProviderCatalogueRecord[]) {
  return Array.from(new Set(providers.flatMap((provider) => provider.programmes.map((programme) => programme.programmeName)))).sort((a, b) => a.localeCompare(b));
}

export function filterProviderCatalogue(providers: ProviderCatalogueRecord[], filters: ProviderCatalogueFilters) {
  const query = filters.search.trim().toLowerCase();

  return providers.filter((provider) => {
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
      provider.programmes.map((programme) => `${programme.programmeName} ${programme.standardName} ${programme.sector} ${programme.tags.join(" ")}`).join(" "),
    ].join(" ").toLowerCase();

    const matchesSearch = !query || searchable.includes(query);
    const matchesSector = filters.sector === "All" || provider.sectors.includes(filters.sector) || provider.programmes.some((programme) => programme.sector === filters.sector);
    const matchesProgramme = filters.programme === "All" || provider.programmes.some((programme) => programme.programmeName === filters.programme || programme.standardName === filters.programme);
    const matchesDelivery = filters.deliveryModel === "All" || provider.deliveryModel.includes(filters.deliveryModel) || provider.programmes.some((programme) => programme.deliveryMode.includes(filters.deliveryModel));
    const matchesRegion = filters.region === "All" || provider.regions.includes(filters.region);
    const matchesStatus = filters.status === "All" || provider.status === filters.status;

    return matchesSearch && matchesSector && matchesProgramme && matchesDelivery && matchesRegion && matchesStatus;
  });
}

export function shortlistProvidersForNeed(providers: ProviderCatalogueRecord[], need: { programme?: string; sector?: string; deliveryModel?: string; region?: string; query?: string }) {
  const query = [need.programme, need.sector, need.query].filter((value): value is string => Boolean(value)).join(" ").toLowerCase();
  const requestedSector = need.sector;
  const requestedDeliveryModel = need.deliveryModel;
  const requestedRegion = need.region;

  return providers
    .filter((provider) => provider.status === "Active")
    .map((provider) => {
      const activeProgrammes = provider.programmes.filter((programme) => programme.availableForNewRecommendations !== false && programme.fundingStatus !== "defunded_for_new_starts");
      const programmeMatches = activeProgrammes.filter((programme) => {
        const haystack = `${programme.programmeName} ${programme.standardName} ${programme.sector} ${programme.tags.join(" ")}`.toLowerCase();
        return !query || haystack.includes(query) || query.split(" ").some((word) => word.length > 3 && haystack.includes(word));
      });
      const sectorFit = !requestedSector || provider.sectors.includes(requestedSector) || activeProgrammes.some((programme) => programme.sector === requestedSector);
      const deliveryFit = !requestedDeliveryModel || provider.deliveryModel.includes(requestedDeliveryModel) || activeProgrammes.some((programme) => programme.deliveryMode.includes(requestedDeliveryModel));
      const regionFit = !requestedRegion || provider.regions.includes(requestedRegion);
      const verificationBoost = provider.verificationStatus === "verified" ? 8 : 0;
      const score = Math.min(100, 42 + programmeMatches.length * 14 + (sectorFit ? 16 : 0) + (deliveryFit ? 10 : 0) + (regionFit ? 10 : 0) + verificationBoost);

      return {
        provider,
        score,
        matchedProgrammes: programmeMatches.slice(0, 5),
        reasons: [
          sectorFit ? "Sector fit" : null,
          deliveryFit ? "Delivery model fit" : null,
          regionFit ? "Region fit" : null,
          programmeMatches.length ? `${programmeMatches.length} programme match${programmeMatches.length === 1 ? "" : "es"}` : null,
        ].filter(Boolean) as string[],
      };
    })
    .filter((item) => item.score >= 52)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

export function fundingLabel(programme: Pick<ProviderProgramme, "fundingStatus">) {
  if (programme.fundingStatus === "commercial") return "Commercial training budget";
  if (programme.fundingStatus === "defunded_for_new_starts") return "Defunded for new starts";
  if (programme.fundingStatus === "potentially_levy_funded") return "Potentially levy-funded";
  return "Potentially funded through levy/co-investment";
}