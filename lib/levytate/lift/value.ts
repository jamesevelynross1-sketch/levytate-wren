import type { LiftCapacityScenario, LiftProofRecord, LiftValueResult } from "@/lib/levytate/lift/domain";

export function calculateLiftCapacityValue(input: LiftCapacityScenario): LiftValueResult {
  const limitations = [
    "Capacity released is not automatically a cash saving.",
    "The realised fraction must not be applied twice where the time estimate already reflects realised adoption.",
  ];
  const required = [input.affectedPeople, input.minutesReleasedPerPersonPerWeek, input.applicableWeeks, input.realisedFraction];
  if (required.some((value) => value === null)) return { hours: null, capacityEquivalentValue: null, label: "Inputs incomplete", limitations: [...limitations, "Missing inputs remain unknown; no optimistic defaults were applied."] };
  const [people, minutes, weeks, fraction] = required as number[];
  if ([people, minutes, weeks, fraction].some((value) => !Number.isFinite(value)) || people < 0 || minutes < 0 || weeks < 0 || fraction < 0 || fraction > 1) throw new Error("Capacity inputs are outside their permitted ranges.");
  if (!input.period.trim()) throw new Error("A capacity-model period is required.");
  const hours = round((people * minutes / 60) * weeks * fraction);
  if (!Number.isFinite(hours)) throw new Error("Modelled capacity exceeds the supported range.");
  const rate = input.employerLoadedHourlyRate;
  if (rate !== null && (!Number.isFinite(rate) || rate < 0)) throw new Error("Employer-loaded hourly rate must be finite and non-negative.");
  return {
    hours,
    capacityEquivalentValue: rate === null ? null : round(hours * rate),
    label: rate === null ? "Modelled capacity released" : "Modelled capacity-equivalent value",
    limitations: rate === null ? limitations : [...limitations, "The employer-supplied loaded hourly rate creates a capacity-value threshold, not cash break-even or ROI."],
  };
}

export function canTransitionLiftProof(input: { current: LiftProofRecord; nextState: LiftProofRecord["state"]; decisionRecorded: boolean }) {
  const { current, nextState } = input;
  if (nextState === "change_tested") {
    return ["work_context_confirmed", "change_tested", "paused"].includes(current.state) && input.decisionRecorded && Boolean(current.owner.trim() && current.agreedScope.trim() && current.intendedMeasure.trim() && current.baseline);
  }
  if (nextState === "outcome_evidenced") {
    return ["change_tested", "outcome_evidenced", "no_improvement"].includes(current.state) && Boolean(current.outcome?.quantity && current.outcome.recordedAt && current.reviewedBy?.trim() && current.verification !== "not_reviewed" && comparable(current));
  }
  if (["signal_identified", "work_context_confirmed"].includes(nextState) && ["change_tested", "outcome_evidenced", "no_improvement"].includes(current.state)) return false;
  return ["signal_identified", "work_context_confirmed", "paused", "not_supported", "no_improvement"].includes(nextState);
}

export function overlappingBenefitWarning(sharedBenefitIds: string[][]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  sharedBenefitIds.flat().forEach((id) => seen.has(id) ? duplicates.add(id) : seen.add(id));
  return [...duplicates];
}

function comparable(proof: LiftProofRecord) {
  const baseline = proof.baseline?.quantity;
  const outcome = proof.outcome?.quantity;
  return Boolean(baseline && outcome && baseline.unit === outcome.unit && baseline.population === outcome.population);
}

function round(value: number) { return Math.round(value * 100) / 100; }
