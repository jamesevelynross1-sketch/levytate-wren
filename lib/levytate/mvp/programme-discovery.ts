import { z } from "zod";
import type { MvpWorkspaceData } from "@/lib/levytate/mvp/workspace";

export const personalProgrammeCommand = z.strictObject({ action: z.enum(["save", "unsave", "compare", "uncompare"]), programmeId: z.string().trim().min(1).max(160), requestId: z.uuid(), expectedRevision: z.number().int().nonnegative() });
export const personalProgrammeChoices = z.strictObject({ employeeId: z.string().min(1), savedProgrammeIds: z.array(z.string().min(1)).max(100), comparedProgrammeIds: z.array(z.string().min(1)).max(3), availableProgrammeIds: z.array(z.string().min(1)).max(5000), revision: z.number().int().nonnegative() });
export type PersonalProgrammeChoices = z.infer<typeof personalProgrammeChoices>;

export function ownDevelopmentPerson(data: MvpWorkspaceData, email: string) {
  const people = data.employees.filter((person) => person.status === "Active" && person.email.trim().toLowerCase() === email.trim().toLowerCase());
  return email.trim() && people.length === 1 ? people[0] : null;
}

export function availablePersonalProgrammes(data: MvpWorkspaceData, email: string) {
  const person = ownDevelopmentPerson(data, email);
  if (!person) return [];
  const mappings = data.roles.find((role) => role.id === person.roleId)?.pathwayMappings ?? [];
  const providerIds = new Set(data.organisationProviders.filter((item) => item.status === "Active").map((item) => item.providerId));
  const programmeIds = new Set(data.organisationProgrammes.filter((item) => item.status === "Active" && providerIds.has(item.providerId)).map((item) => item.programmeId));
  return data.providerProgrammes.flatMap((programme) => {
    const provider = data.providers.find((item) => item.providerId === programme.providerId && item.status === "Active" && item.verificationStatus === "verified" && item.lastVerified && item.sourceUrls.length);
    if (!provider || !programmeIds.has(programme.id) || programme.status !== "Active" || programme.recordStatus !== "Active"
      || !programme.sourceUrl.trim() || !programme.linkedStandardIds.length || !["Verified from provider website", "Provider confirmed", "LevyTate reviewed"].includes(programme.verificationStatus)) return [];
    const mapping = [...mappings].sort((a, b) => a.priority - b.priority).find((item) => item.apprenticeshipStandardId === programme.linkedStandardId || programme.linkedStandardIds.includes(item.apprenticeshipStandardId)) ?? null;
    return [{ programme, provider, mapping }];
  }).sort((a, b) => Number(Boolean(b.mapping)) - Number(Boolean(a.mapping)) || a.programme.programmeName.localeCompare(b.programme.programmeName));
}
