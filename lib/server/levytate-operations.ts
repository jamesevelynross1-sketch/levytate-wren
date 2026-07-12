import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import {
  buildOrganisationOperationalItems,
  groupOperationalQueues,
  operationalPriorityRanks,
  operationalQueueLabels,
  type OperationalDueStatus,
  type OperationalItem,
  type OperationalOwnerType,
  type OperationalPriorityLevel,
  type OperationalQueueType,
  type OperationsFilterOptions,
  type OperationsResponse,
} from "@/lib/levytate/mvp/operations-centre";
import { listOrganisationLearnerLifecycleDetails } from "@/lib/server/levytate-learner-lifecycle";

export type OperationsQuery = {
  priority?: string;
  queue?: string;
  learner?: string;
  programme?: string;
  provider?: string;
  site?: string;
  department?: string;
  owner?: string;
  dueStatus?: string;
  search?: string;
};

export async function getOrganisationOperationsSummary(
  session: LevyTateBetaSession,
  query: OperationsQuery = {},
): Promise<OperationsResponse> {
  const details = await listOrganisationLearnerLifecycleDetails(session);
  const derived = buildOrganisationOperationalItems(details);
  const filtered = derived.items.filter((item) => matchesQuery(item, query));
  return {
    source: "supabase",
    generatedAt: new Date().toISOString(),
    summary: derived.summary,
    queues: groupOperationalQueues(filtered),
    recentActivity: derived.recentActivity,
    filterOptions: buildFilterOptions(derived.items),
    totalAttentionItems: filtered.length,
  };
}

export async function getOrganisationOperationalItems(session: LevyTateBetaSession, query: OperationsQuery = {}) {
  const response = await getOrganisationOperationsSummary(session, query);
  return Object.values(response.queues).flat();
}

function matchesQuery(item: OperationalItem, query: OperationsQuery) {
  const equals = (actual: string, expected?: string) => !expected || expected === "All" || actual.toLowerCase() === expected.toLowerCase();
  if (!equals(item.priorityLevel, query.priority)) return false;
  if (!equals(item.queueType, query.queue)) return false;
  if (!equals(item.learnerName, query.learner)) return false;
  if (!equals(item.programmeName, query.programme)) return false;
  if (!equals(item.providerName, query.provider)) return false;
  if (!equals(item.site, query.site)) return false;
  if (!equals(item.department, query.department)) return false;
  if (!equals(item.ownerType, query.owner)) return false;
  if (!equals(item.dueStatus, query.dueStatus)) return false;
  const search = query.search?.trim().toLowerCase();
  return !search || [item.learnerName, item.programmeName, item.providerName, item.department, item.site, item.reason]
    .some((value) => value.toLowerCase().includes(search));
}

function buildFilterOptions(items: OperationalItem[]): OperationsFilterOptions {
  const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
  return {
    priorities: (Object.keys(operationalPriorityRanks) as OperationalPriorityLevel[]).sort((left, right) => operationalPriorityRanks[left] - operationalPriorityRanks[right]),
    queues: (Object.keys(operationalQueueLabels) as OperationalQueueType[]).map((value) => ({ value, label: operationalQueueLabels[value] })),
    learners: unique(items.map((item) => item.learnerName)),
    programmes: unique(items.map((item) => item.programmeName)),
    providers: unique(items.map((item) => item.providerName)),
    sites: unique(items.map((item) => item.site)),
    departments: unique(items.map((item) => item.department)),
    owners: unique(items.map((item) => item.ownerType as OperationalOwnerType)),
  };
}

export function isOperationalDueStatus(value: string): value is OperationalDueStatus {
  return ["Overdue", "Due today", "Due soon", "No due date"].includes(value);
}
