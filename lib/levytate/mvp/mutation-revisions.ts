import type { LevyTateWorkspaceMutation } from "@/lib/levytate/mvp/api";
export const atomicWorkspaceActions = ["saveProfile", "saveEmployee", "archiveEmployee", "saveEmployeeDevelopmentProfile", "saveRole", "archiveRole", "saveProvider", "archiveProvider", "saveProviderProgramme", "archiveProviderProgramme", "removeProviderProgramme", "saveProviderRelationship", "saveOrganisationProvider", "saveOrganisationProgramme", "saveMatchingRequest", "updateMatchingStatus"] as const;
export function workspaceMutationEntity(mutation: LevyTateWorkspaceMutation, organisationId: string): string | null {
  switch (mutation.type) {
    case "saveProfile": return `levytate_organisations:${organisationId}`;
    case "saveEmployee": return `levytate_employees:${mutation.employee.id}`;
    case "archiveEmployee": return `levytate_employees:${mutation.id}`;
    case "saveEmployeeDevelopmentProfile": return `levytate_employee_development_profiles:${mutation.profile.employeeId}`;
    case "archiveRole": return `levytate_roles:${mutation.id}`;
    case "saveRole": return `levytate_roles:${mutation.role.id}`;
    case "saveProvider": return `levytate_providers:${mutation.provider.providerId}`;
    case "archiveProvider": return `levytate_providers:${mutation.id}`;
    case "saveProviderProgramme": return `levytate_provider_programmes:${mutation.programme.id}`;
    case "archiveProviderProgramme": case "removeProviderProgramme": return `levytate_provider_programmes:${mutation.id}`;
    case "saveProviderRelationship": return `levytate_provider_relationships:${mutation.relationship.id}`;
    case "saveOrganisationProvider": return `levytate_organisation_providers:${mutation.selection.providerId}`;
    case "saveOrganisationProgramme": return `levytate_organisation_programmes:${mutation.selection.programmeId}`;
    case "saveMatchingRequest": return `levytate_matching_requests:${mutation.request.id}`;
    case "updateMatchingStatus": return `levytate_matching_requests:${mutation.id}`;
    default: return null;
  }
}
