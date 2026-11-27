import { getSelectableApprenticeshipStandards } from "@/lib/levytate/domain/apprenticeship-standards";
import type { MvpWorkspaceData } from "@/lib/levytate/mvp/workspace";
import type { ApprenticeshipStandard } from "@/lib/levytate/domain";

type Evidence = Pick<MvpWorkspaceData, "employees" | "roles" | "providers" | "providerProgrammes" | "organisationProviders" | "organisationProgrammes">;

export type ApplicationProgrammeOption = {
  standard: ApprenticeshipStandard;
  recommended: boolean;
  published: boolean;
  offers: Array<{ programmeId: string; programmeName: string; providerId: string; providerName: string; published: boolean }>;
};

/** The application records an official standard, not a provider contract.
 * Group all matching active verified provider offers by standard. Publication is
 * employer-owned; the server checks authoritative source evidence (redacted
 * from employer-facing workspace data) before it accepts the selection. */
export function applicationProgrammeOptions(data: Evidence, employeeId: string, standards = getSelectableApprenticeshipStandards()): ApplicationProgrammeOption[] {
  const employee = data.employees.find(item => item.id === employeeId);
  const mappings = new Set(data.roles.find(role => role.id === employee?.roleId)?.pathwayMappings.map(item => item.apprenticeshipStandardId) ?? []);
  const approved = new Map(standards.map(item => [item.id, item]));
  const providers = new Map(data.providers.filter(item => item.status === "Active" && item.verificationStatus === "verified" && item.lastVerified).map(item => [item.providerId, item]));
  const selectedProviders = new Set(data.organisationProviders.filter(item => item.status === "Active").map(item => item.providerId));
  const result = new Map<string, ApplicationProgrammeOption>();
  for (const programme of data.providerProgrammes) {
    const provider = providers.get(programme.providerId);
    if (!provider || programme.status !== "Active" || programme.recordStatus !== "Active" || !["Verified from provider website", "Provider confirmed", "LevyTate reviewed"].includes(programme.verificationStatus)) continue;
    const ids = [...new Set(programme.linkedStandardIds)];
    if (!ids.length || !ids.includes(programme.linkedStandardId) || ids.some(id => !approved.has(id))) continue;
    const published = selectedProviders.has(provider.providerId) && data.organisationProgrammes.some(item => item.status === "Active" && item.programmeId === programme.id && item.providerId === provider.providerId);
    for (const id of ids) {
      const standard = approved.get(id)!;
      const option = result.get(id) ?? { standard, recommended: mappings.has(id), published: false, offers: [] };
      option.published ||= published;
      option.offers.push({ programmeId: programme.id, programmeName: programme.programmeName, providerId: provider.providerId, providerName: provider.providerName, published });
      result.set(id, option);
    }
  }
  return [...result.values()].map(option => ({ ...option, offers: option.offers.sort((a, b) => Number(b.published) - Number(a.published) || a.providerName.localeCompare(b.providerName) || a.programmeName.localeCompare(b.programmeName)) }))
    .sort((a, b) => Number(b.recommended) - Number(a.recommended) || Number(b.published) - Number(a.published) || a.standard.title.localeCompare(b.standard.title));
}

export function applicationProgrammeLabel(option: ApplicationProgrammeOption) {
  const providers = [...new Set(option.offers.map(offer => offer.providerName))];
  const providerLabel = providers.length === 1 ? providers[0] : `${providers.length} providers`;
  return `${option.recommended ? "Recommended · " : ""}Level ${option.standard.level} · ${option.standard.title} · ${providerLabel}${option.published ? "" : " · Add to My Programmes"}`;
}
