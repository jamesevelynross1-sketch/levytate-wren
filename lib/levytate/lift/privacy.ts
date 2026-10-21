export type LiftAggregateCandidate<T> = T & {
  contributorEmployeeIds: string[];
  cohort?: string;
};

/**
 * Applies Lift's minimum-five and complementary-suppression rules to route
 * existence as well as labels, counts and narrative. Manager observations are
 * deliberately not accepted as additional contributors.
 */
export function discloseLiftAggregates<T>(input: {
  candidates: Array<LiftAggregateCandidate<T>>;
  submittedEmployeeIds: string[];
  threshold?: number;
}) {
  const threshold = input.threshold ?? 5;
  const submitted = new Set(input.submittedEmployeeIds);
  if (submitted.size < threshold) return { available: [] as Array<LiftAggregateCandidate<T>>, suppressed: input.candidates.length, reason: `Fewer than ${threshold} distinct employees submitted.` };
  const normalised = input.candidates.map((candidate) => ({
    ...candidate,
    contributorEmployeeIds: [...new Set(candidate.contributorEmployeeIds.filter((id) => submitted.has(id)))],
  }));
  const cohorts = new Map<string, Set<string>>();
  normalised.forEach((candidate) => {
    if (!candidate.cohort) return;
    const group = cohorts.get(candidate.cohort) ?? new Set<string>();
    candidate.contributorEmployeeIds.forEach((id) => group.add(id));
    cohorts.set(candidate.cohort, group);
  });
  const hasSmallPositiveCohort = [...cohorts.values()].some((ids) => ids.size > 0 && ids.size < threshold);
  const available = normalised.filter((candidate) => candidate.contributorEmployeeIds.length >= threshold && !hasSmallPositiveCohort);
  return {
    available,
    suppressed: normalised.length - available.length,
    reason: hasSmallPositiveCohort
      ? "All overlapping cohort routes are withheld because a positive group below the disclosure threshold could be reconstructed by subtraction."
      : available.length === normalised.length
        ? "Every displayed route meets the distinct-employee threshold."
        : "Sparse routes are withheld across map, narrative, print and export.",
  };
}
