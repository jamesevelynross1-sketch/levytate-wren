import { liftOpportunityGroupingVersion, liftWorkflowGroupLabels, type LiftCapability, type LiftWorkflowGroup } from "@/lib/levytate/lift/domain";
import { discloseLiftAggregates } from "@/lib/levytate/lift/privacy";

export type LiftOpportunityCandidateForGrouping = {
  id: string;
  campaignId: string;
  employeeId: string;
  frameworkKey: string;
  questionnaireVersion: string;
  interpretationVersion: string;
  groupingVersion: string;
  workflowGroup: LiftWorkflowGroup;
  capabilityIds: LiftCapability[];
  relationship: "supported" | "hypothesis";
  supportingEvidenceIds: string[];
  contradictoryEvidenceIds: string[];
};

export type LiftOpportunityRoute = {
  id: string;
  groupingKey: string;
  campaignId: string;
  frameworkKey: string;
  questionnaireVersion: string;
  interpretationVersion: string;
  groupingVersion: string;
  workflowGroup: LiftWorkflowGroup;
  contributorEmployeeIds: string[];
  candidateIds: string[];
  capabilityIds: LiftCapability[];
  relationship: "supported" | "hypothesis";
  supportingEvidenceIds: string[];
  contradictoryEvidenceIds: string[];
  title: string;
  workThatCouldImprove: string;
  constraint: string;
  outcomeWorthPursuing: string;
};

/**
 * Groups only on reviewed, controlled fields. Free text is intentionally not
 * part of the grouping key and is never copied into the employer aggregate.
 */
export function groupLiftOpportunityCandidates(input: {
  candidates: LiftOpportunityCandidateForGrouping[];
  submittedEmployeeIdsByCampaign: Map<string, string[]>;
  stableId: (...parts: string[]) => string;
}): LiftOpportunityRoute[] {
  const groups = new Map<string, LiftOpportunityCandidateForGrouping[]>();
  for (const candidate of input.candidates) {
    const key = [candidate.campaignId, candidate.frameworkKey, candidate.questionnaireVersion, candidate.interpretationVersion, candidate.groupingVersion, candidate.workflowGroup].join("|");
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }

  const byCampaign = new Map<string, Array<{ key: string; candidates: LiftOpportunityCandidateForGrouping[]; contributorEmployeeIds: string[]; cohort: string }>>();
  for (const [key, candidates] of groups) {
    const contributors = [...new Set(candidates.map((candidate) => candidate.employeeId))];
    const campaignId = candidates[0]!.campaignId;
    const collection = byCampaign.get(campaignId) ?? [];
    collection.push({ key, candidates, contributorEmployeeIds: contributors, cohort: key });
    byCampaign.set(campaignId, collection);
  }

  const routes: LiftOpportunityRoute[] = [];
  for (const [campaignId, campaignGroups] of byCampaign) {
    const disclosure = discloseLiftAggregates({
      submittedEmployeeIds: input.submittedEmployeeIdsByCampaign.get(campaignId) ?? [],
      candidates: campaignGroups,
    });
    for (const group of disclosure.available) {
      const first = group.candidates[0]!;
      const capabilityCounts = new Map<LiftCapability, Set<string>>();
      for (const candidate of group.candidates) {
        for (const capabilityId of candidate.capabilityIds) {
          const contributors = capabilityCounts.get(capabilityId) ?? new Set<string>();
          contributors.add(candidate.employeeId);
          capabilityCounts.set(capabilityId, contributors);
        }
      }
      const safeCapabilities = [...capabilityCounts].filter(([, contributors]) => contributors.size >= 5).map(([capability]) => capability);
      const label = liftWorkflowGroupLabels[first.workflowGroup];
      const relationship = group.candidates.every((candidate) => candidate.relationship === "supported") ? "supported" : "hypothesis";
      routes.push({
        id: input.stableId("opportunity-route", group.key),
        groupingKey: group.key,
        campaignId,
        frameworkKey: first.frameworkKey,
        questionnaireVersion: first.questionnaireVersion,
        interpretationVersion: first.interpretationVersion,
        groupingVersion: first.groupingVersion || liftOpportunityGroupingVersion,
        workflowGroup: first.workflowGroup,
        contributorEmployeeIds: group.contributorEmployeeIds,
        candidateIds: [...new Set(group.candidates.map((candidate) => candidate.id))],
        capabilityIds: safeCapabilities,
        relationship,
        supportingEvidenceIds: [...new Set(group.candidates.flatMap((candidate) => candidate.supportingEvidenceIds))],
        contradictoryEvidenceIds: [...new Set(group.candidates.flatMap((candidate) => candidate.contradictoryEvidenceIds))],
        title: `${label} opportunity`,
        workThatCouldImprove: `A disclosed group of employees identified a reviewed opportunity in ${label.toLowerCase()}. Individual wording remains private.`,
        constraint: "Confirm shared conditions, ownership and baseline before deciding on a change.",
        outcomeWorthPursuing: "Agree a bounded outcome and measure it on a comparable basis.",
      });
    }
  }
  return routes;
}
