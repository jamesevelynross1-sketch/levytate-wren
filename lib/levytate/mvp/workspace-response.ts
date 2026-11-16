import type { ClientIdentity } from "@/lib/levytate/client-session";
import type { LevyTateWorkspaceBootstrap, LevyTateWorkspaceMutation } from "@/lib/levytate/mvp/api";
import { parseMvpUserRole, permissionsForMvpRole } from "@/lib/levytate/mvp/rbac";

const invalid = () => new Error("LevyTate could not confirm this workspace response. Your open forms have been kept; reconnect or retry the original update.");
type Row = Record<string, unknown>;
function row(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Row;
}
function strings(value: unknown) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw invalid();
}
function fields(value: Row, names: string[]) { for (const name of names) if (typeof value[name] !== "string") throw invalid(); }
function arrays(value: Row, names: string[]) { for (const name of names) strings(value[name]); }
function rows(value: unknown, key = "id"): Row[] {
  if (!Array.isArray(value)) throw invalid();
  const seen = new Set<string>();
  return value.map((item) => {
    const itemRow = row(item), id = itemRow[key];
    if (typeof id !== "string" || !id.trim() || seen.has(id)) throw invalid();
    seen.add(id); return itemRow;
  });
}
function revision(value: unknown) { if (!Number.isSafeInteger(value) || Number(value) < 0) throw invalid(); }
function commercial(value: unknown, arrayFields: string[]) {
  const profile = row(value); arrays(profile, arrayFields);
  if (!Array.isArray(profile.downloads)) throw invalid();
  for (const link of profile.downloads) fields(row(link), ["label", "url", "kind"]);
}

/** Validate the live wire envelope before replacing state or confirming a write.
 * This is a render/identity contract, not a replacement for server business rules.
 * It never fills missing live data from demo defaults or changes exported values.
 */
export function decodeWorkspaceResponse(value: unknown, expected?: ClientIdentity | null): LevyTateWorkspaceBootstrap {
  const response = row(value), workspace = row(response.workspace), meta = row(workspace.meta), data = row(workspace.data);
  if (response.ok !== true || meta.storageMode !== "supabase" || data.version !== 6) throw invalid();
  fields(meta, ["organisationId", "organisationName", "userEmail"]);
  const organisationId = meta.organisationId as string, email = meta.userEmail as string;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(organisationId)
    || !email || email !== email.trim().toLowerCase() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalid();
  if (expected && (email !== expected.email.trim().toLowerCase() || organisationId !== expected.organisationId.toLowerCase())) {
    throw new Error("A different account or workspace is signed in. Reload to switch accounts; this account's open forms have been kept.");
  }
  const role = parseMvpUserRole(meta.userRole);
  if (!role || !Array.isArray(meta.permissions) || meta.permissions.some((permission) => !permissionsForMvpRole(role).includes(permission))) throw invalid();
  strings(meta.warnings);
  for (const name of ["requestsEnabled", "applicationWorkflowsEnabled", "applicationWorkflowPublished", "offTheJobAssistantEnabled", "pastoralSupportEnabled", "pastoralInboxEnabled", "liftEnabled"]) {
    if (meta[name] !== undefined && typeof meta[name] !== "boolean") throw invalid();
  }
  for (const value of Object.values(row(meta.mutationRevisions))) revision(value);
  if (meta.directReportOperationalSummaries !== undefined) {
    if (!Array.isArray(meta.directReportOperationalSummaries)) throw invalid();
    meta.directReportOperationalSummaries.forEach(row);
  }
  if (meta.coreEarlyAccess !== undefined) {
    const policy = row(meta.coreEarlyAccess);
    if (policy.role !== role) throw invalid();
    arrays(policy, ["permittedCapabilities", "deniedCapabilities"]);
    for (const moduleStatus of rows(policy.modules, "moduleKey")) fields(moduleStatus, ["label", "route", "availability", "reasonCode"]);
  }
  const profile = row(data.profile);
  fields(profile, ["employerName", "workspaceName", "primaryContact", "contactEmail", "defaultSite"]);
  arrays(profile, ["sites", "departments"]);
  for (const priority of rows(profile.priorities)) fields(priority, ["name", "importance", "detail"]);
  for (const employee of rows(data.employees)) fields(employee, ["employeeNumber", "name", "email", "jobTitle", "roleId", "managerId", "department", "site", "platformRole", "status", "startDate", "createdAt", "updatedAt"]);
  for (const development of rows(data.employeeDevelopmentProfiles, "employeeId")) {
    fields(development, ["stage", "preferredStandardId", "updatedAt"]);
    arrays(development, ["responsibilities", "currentSkills", "businessFunctions", "currentCapabilities", "apprenticeshipIndicators", "aiOpportunities", "dataOpportunities", "automationOpportunities", "futureCapabilities"]);
    if (!Array.isArray(development.conversationHistory)) throw invalid();
    development.conversationHistory.forEach((message) => fields(row(message), ["role", "content"]));
  }
  for (const item of rows(data.roles)) {
    fields(item, ["title", "department", "businessArea", "careerLevel", "status", "createdAt", "updatedAt"]); arrays(item, ["skillsTags", "progression"]);
    for (const mapping of rows(item.pathwayMappings)) fields(mapping, ["apprenticeshipStandardId", "recommendationType", "businessRationale", "fundingRoute", "deliveryPreference"]);
  }
  for (const application of rows(data.applications)) {
    fields(application, ["employeeId", "apprenticeshipStandardId", "status", "currentOwner", "reason", "careerGoal", "supportRequired", "managerNote", "submittedAt", "updatedAt"]);
    if (application.revision !== undefined) revision(application.revision);
    for (const history of rows(application.history)) fields(history, ["status", "owner", "note", "createdAt"]);
  }
  for (const provider of rows(data.providers, "providerId")) {
    fields(provider, ["providerName", "website", "providerType", "contactName", "contactEmail", "ofstedRating", "status", "notes", "lastVerified", "verificationStatus"]);
    arrays(provider, ["sectors", "industries", "technologies", "deliveryModels", "regions", "employerTypes", "specialisms", "sourceUrls"]);
    commercial(provider.commercialProfile, ["awards", "accreditations", "caseStudies", "successStories", "testimonials", "employerSizesSupported"]);
  }
  for (const programme of rows(data.providerProgrammes)) {
    fields(programme, ["providerId", "programmeName", "shortDescription", "fullDescription", "status", "verificationStatus", "duration", "linkedStandardId", "recordStatus", "createdAt", "updatedAt"]);
    arrays(programme, ["targetOrganisations", "targetIndustries", "targetJobRoles", "businessProblemsSolved", "skillsDeveloped", "technologiesCovered", "expectedOutcomes", "deliveryModels", "regions", "cohortOptions", "linkedStandardIds"]);
    commercial(programme.commercialProfile, ["typicalDepartments", "futureSkillsDeveloped", "keyOutcomes", "locations", "fundingOptions", "progressionRoutes", "caseStudies", "faqs", "employerBenefits", "futureCapabilityImpact"]);
  }
  for (const relationship of rows(data.providerRelationships)) { fields(relationship, ["category", "preferredProviderId", "status", "notes", "reviewDate", "lastUsedDate"]); arrays(relationship, ["backupProviderIds", "programmeIds"]); }
  for (const selection of rows(data.organisationProviders, "providerId")) fields(selection, ["status", "selectedAt", "updatedAt"]);
  for (const selection of rows(data.organisationProgrammes, "programmeId")) fields(selection, ["providerId", "status", "selectedAt", "updatedAt"]);
  for (const request of rows(data.matchingRequests)) { fields(request, ["roleNeed", "status", "createdAt", "updatedAt"]); arrays(request, ["sites", "businessProblems", "targetRoles", "technologies", "industries", "shortlistProviderIds"]); }
  for (const enrolment of rows(data.enrolments)) fields(enrolment, ["applicationId", "employeeId", "providerId", "apprenticeshipStandardId", "status", "startDate", "notes", "createdAt", "updatedAt"]);
  for (const collection of ["learnerRecords", "eligibilityDeclarations", "preEnrolmentChecks", "breaksInLearning", "withdrawals", "learnerReviews", "progressUpdates", "assessmentReadiness", "achievements", "operationalActions", "lifecycleEvents"]) {
    for (const item of rows(data[collection])) if (item.organisationId !== organisationId) throw invalid();
  }
  return workspace as LevyTateWorkspaceBootstrap;
}

/** A failed send may already have committed. Only that exact sent application
 * command may bypass a refreshed UI's edit hint to ask the server for its receipt.
 */
export function createApplicationReceiptRecovery() {
  const pending = new Map<string, string>();
  return {
    remember(mutation: LevyTateWorkspaceMutation) {
      if (mutation.type === "saveApplication") pending.set(mutation.application.id, JSON.stringify(mutation));
    },
    matches(mutation: LevyTateWorkspaceMutation) {
      return mutation.type === "saveApplication" && pending.get(mutation.application.id) === JSON.stringify(mutation);
    },
    confirm(mutation: LevyTateWorkspaceMutation) {
      if (mutation.type === "saveApplication" && pending.get(mutation.application.id) === JSON.stringify(mutation)) pending.delete(mutation.application.id);
    },
  };
}
