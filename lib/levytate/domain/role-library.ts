import type { ApprenticeshipPathway, CareerLevel, RoleLibraryRole, RoleRecordStatus } from "./types";

export type RoleLibraryFilters = {
  search: string;
  status: RoleRecordStatus | "All";
  department: string;
  businessArea: string;
  careerLevel: CareerLevel | "All";
  site: string;
};

export const defaultRoleLibraryFilters: RoleLibraryFilters = {
  search: "",
  status: "Active",
  department: "All",
  businessArea: "All",
  careerLevel: "All",
  site: "All",
};

export function filterRoleLibraryRoles(roles: RoleLibraryRole[], filters: RoleLibraryFilters) {
  const query = filters.search.trim().toLowerCase();

  return roles.filter((role) => {
    const searchable = [
      role.roleTitle,
      role.department,
      role.businessArea,
      role.careerLevel,
      role.overview,
      role.specialistPathwayRationale ?? "",
      role.managementContext?.join(" ") ?? "",
      role.skillsTags.join(" "),
      role.aiTags.join(" "),
      role.typicalProgression.join(" "),
      role.siteApplicability.join(" "),
    ].join(" ").toLowerCase();

    const matchesSearch = !query || searchable.includes(query);
    const matchesStatus = filters.status === "All" || role.status === filters.status;
    const matchesDepartment = filters.department === "All" || role.department === filters.department;
    const matchesBusinessArea = filters.businessArea === "All" || role.businessArea === filters.businessArea;
    const matchesCareerLevel = filters.careerLevel === "All" || role.careerLevel === filters.careerLevel;
    const matchesSite = filters.site === "All" || role.siteApplicability.includes("All sites") || role.siteApplicability.includes(filters.site);

    return matchesSearch && matchesStatus && matchesDepartment && matchesBusinessArea && matchesCareerLevel && matchesSite;
  });
}

export function uniqueRoleValues(roles: RoleLibraryRole[], field: "department" | "businessArea" | "careerLevel") {
  return Array.from(new Set(roles.map((role) => role[field]))).sort((a, b) => String(a).localeCompare(String(b)));
}

export function uniqueRoleSites(roles: RoleLibraryRole[]) {
  return Array.from(new Set(roles.flatMap((role) => role.siteApplicability))).sort((a, b) => a.localeCompare(b));
}

export function roleByTitle(roles: RoleLibraryRole[], roleTitle: string) {
  return roles.find((role) => role.roleTitle.toLowerCase() === roleTitle.toLowerCase());
}

export function roleById(roles: RoleLibraryRole[], roleId: string) {
  return roles.find((role) => role.id === roleId);
}

export function orderedRoleRecommendations(role: RoleLibraryRole) {
  return [...role.recommendations].sort((a, b) => {
    if (a.recommendationType !== b.recommendationType) return a.recommendationType === "Primary" ? -1 : 1;
    return a.priority - b.priority;
  });
}

export function pathwaysForRole(role: RoleLibraryRole | undefined, pathways: ApprenticeshipPathway[], options: { includeUnavailable?: boolean } = {}) {
  if (!role) return [];
  return orderedRoleRecommendations(role).flatMap((mapping) => {
    const pathway = pathways.find((item) => item.id === mapping.pathwayId);
    if (!pathway) return [];
    if (!options.includeUnavailable && pathway.availableForNewApplications === false) return [];
    return [{ ...pathway, mapping }];
  });
}

export function recommendationCountForRoleTitle(roleTitle: string, roles: RoleLibraryRole[], pathways?: ApprenticeshipPathway[]) {
  const role = roleByTitle(roles, roleTitle);
  if (!role) return 0;
  return pathways ? pathwaysForRole(role, pathways).length : role.recommendations.length;
}

export function nextRoleId(roles: RoleLibraryRole[]) {
  const highest = roles.reduce((max, role) => {
    const numeric = Number(role.id.replace(/[^0-9]/g, ""));
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);

  return `role-${String(highest + 1).padStart(3, "0")}`;
}

export function syncRoleTitleFromId(roleId: string, roles: RoleLibraryRole[], fallback: string) {
  return roleById(roles, roleId)?.roleTitle ?? fallback;
}

export function isPathwayAvailableForNewApplications(pathway: ApprenticeshipPathway | undefined) {
  return pathway !== undefined && pathway.availableForNewApplications !== false;
}
