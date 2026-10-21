import type { LiftCapability } from "@/lib/levytate/lift/domain";
import { liftAssessmentQuestions } from "@/lib/levytate/lift/framework";

export type LiftRubricItem = {
  itemId: string;
  capabilities: LiftCapability[];
  evidenceType: string;
  taskPurpose: string;
  intendedToReveal: string;
  whySupported: string;
  otherResponsesIndicate: string;
  alternativeDefensibleAnswers: string;
  missingTreatment: string;
  inferenceLimit: string;
  automaticallyInterpreted: boolean;
  supportedValues: string[];
  emergingValues: string[];
  unknownValues: string[];
  contextValues: string[];
  contradictoryValues: string[];
};

type Rationale = Pick<LiftRubricItem, "intendedToReveal" | "whySupported" | "otherResponsesIndicate" | "alternativeDefensibleAnswers">;
type Classification = Pick<LiftRubricItem, "automaticallyInterpreted" | "supportedValues" | "emergingValues" | "unknownValues" | "contextValues" | "contradictoryValues">;

const rationale = (intendedToReveal: string, whySupported: string, otherResponsesIndicate: string, alternativeDefensibleAnswers: string): Rationale => ({ intendedToReveal, whySupported, otherResponsesIndicate, alternativeDefensibleAnswers });
const structured = (supported: string, emerging: string[] = [], context: string[] = [], contradictory: string[] = []): Classification => ({ automaticallyInterpreted: true, supportedValues: [supported], emergingValues: emerging, unknownValues: [], contextValues: context, contradictoryValues: contradictory });
const experience: Classification = { automaticallyInterpreted: true, supportedValues: ["established_practice"], emergingValues: ["developing_practice"], unknownValues: ["not_enough_opportunity"], contextValues: ["current_practice"], contradictoryValues: [] };
const workSample: Classification = { automaticallyInterpreted: false, supportedValues: [], emergingValues: [], unknownValues: [], contextValues: [], contradictoryValues: [] };

const rationales: Record<string, Rationale> = {
  check_01: rationale("Tests source coverage and material uncertainty before relying on a persuasive recommendation.", "The supported response establishes population, gap and uncertainty before deciding.", "A pilot or second source may be proportionate; full deferral prioritises certainty but carries delay.", "A reversible pilot is defensible for low-risk decisions; another source is defensible if it covers the material gap."),
  check_02: rationale("Tests authorised evidence checking and human accountability in AI-supported work.", "It checks material claims, states uncertainty and retains a named human owner.", "Peer review or redrafting can improve presentation; repeated model output tests consistency, not truth.", "Peer review is sufficient only where the reviewer also checks authorised sources."),
  check_03: rationale("Tests communication of a recommendation, uncertainty and proportionate next check.", "Free text has no automatic supported answer and remains employee-authored context.", "Omitted requested elements become prompts for human clarification, not negative labels.", "Different wording, spelling, assistive technology and levels of detail can all be defensible."),
  check_04: rationale("Tests progress under time pressure through bounded learning and stop conditions.", "A bounded test makes evidence, ownership, review timing and reversibility explicit.", "Partial implementation or a brief evidence pause can be proportionate; full provisional change carries more exposure.", "Partial implementation is defensible when components are independently reversible and measured."),
  check_05: rationale("Explores reported response when evidence challenges an initial view.", "Established practice reports independent, explainable revision but remains self-report.", "Current practice may reflect stability requirements; developing practice includes supported adjustment; no opportunity is unknown.", "Role authority and opportunity can make any non-established response reasonable."),
  flow_01: rationale("Tests whether improvement is considered across the whole service rather than a local metric.", "End-to-end mapping exposes displaced work, rework, risk and outcome before selection.", "A joint trial or resourced transfer can be reasonable; retaining the flow avoids risk but may abandon improvement.", "A receiving-team trial may be the fastest reliable way to obtain the missing evidence."),
  flow_02: rationale("Tests whether evidence compares the complete flow on a defined basis.", "It covers time, rework, quality and exceptions for one population and comparable period.", "Team time and feedback or service outcome alone are useful but partial; first-team adjustment can hide downstream work.", "Service outcome alone is defensible if it is the controlling measure and downstream risks are monitored separately."),
  flow_03: rationale("Tests whether a proposed test has scope, affected people and a stop or revision condition.", "Free text is retained for authorised human review and is never automatically scored.", "Missing boundaries identify clarification needs rather than a personal deficit.", "Different test sizes and methods are defensible where risk, authority and reversibility differ."),
  flow_04: rationale("Tests incorporation of receiving-team evidence and disagreement into change.", "Joint examples, outcomes and stop criteria make the concern testable without dismissing either team.", "Escalation, extra checks or redesign may be proportionate but provide less shared ownership of evidence.", "Immediate escalation is defensible for regulated, safety-critical or irreversible work."),
  flow_05: rationale("Explores reported identification of affected groups, information risks and safeguards.", "Established practice reports proactive consideration but remains self-report.", "Narrow focus may reflect role scope; prompted consideration is developing; no opportunity is unknown.", "A requester-only view can be reasonable where impact analysis is formally owned elsewhere."),
  team_01: rationale("Tests whether disagreement is made testable by separating observation and assumption.", "It preserves both accounts and agrees evidence capable of distinguishing them.", "Parallel tests, a provisional cause or neutral ownership can move work forward but may not resolve the evidence question.", "A neutral decision is defensible where delay itself creates significant harm."),
  team_02: rationale("Tests preservation of uncertainty when examples support multiple explanations.", "Discriminating evidence is needed before assigning cause.", "A weighted working explanation or non-causal action may be practical; assuming joint causation overstates the examples.", "A non-causal action is defensible when low-risk, reversible and useful under all live explanations."),
  team_03: rationale("Tests separation of agreement, uncertainty and next commitment in a handover.", "Free text remains context for human review rather than automatic evidence.", "A missing element becomes a clarification prompt; tone and grammar are not scored.", "Different communication styles and concise or detailed messages can meet the same boundary."),
  team_04: rationale("Tests proportionate use of scarce expertise while preserving knowledge and ownership.", "The smallest useful expert input plus contextual capture and explicit checks balances delivery and resilience.", "Review points, documentation or deferral may be sensible depending on risk and availability.", "Expert review can be preferable where preparatory work is safe and reversible."),
  team_05: rationale("Explores reported practice for making commitments durable after the immediate issue.", "Established practice reports explicit ownership, evidence, review and knowledge transfer.", "Memory may fit very small work; occasional capture is developing; no opportunity is unknown.", "Informal agreements can be proportionate in short-lived, low-risk work."),
  data_01: rationale("Tests distinction between counts, denominators and causation.", "It correctly states both observed movements and preserves causal uncertainty.", "Count-only or rate-only answers select a valid fact but overstate quality; no-comparison is overly cautious.", "A rate-focused answer is defensible when the decision concerns per-transaction exposure, but cannot establish cause."),
  data_02: rationale("Tests the basis required for fair comparison before interpreting rates.", "Definitions, populations, complexity and periods determine comparability; severity then adds context.", "Sample size, process conditions and error impact are important secondary checks but do not repair incomparable populations.", "Severity can be the first priority for a safety decision before a full rate comparison."),
  data_03: rationale("Tests explanation of count, denominator and limitation without inventing cause.", "Free text is not automatically scored or language-model evaluated.", "A missing denominator or limitation prompts review rather than a personal judgement.", "Different explanations are valid if they preserve the observed facts and uncertainty."),
  data_04: rationale("Tests executive simplicity with sufficient context for a sound decision.", "A small defined set preserves volume, rate and outcome and ties each measure to a decision.", "A qualified headline or outcome-only measure can fit a narrow decision; a composite may hide component movement.", "One qualified measure is defensible where governance already defines it as the controlling outcome."),
  data_05: rationale("Explores reported response when a measure's definition or quality changes.", "Established practice reports preserving history while explaining a revised definition.", "Continuity may matter; seeking support is developing; no opportunity is unknown.", "Continuing a measure can be reasonable when a break in series would cause greater decision risk and the caveat is explicit."),
  change_01: rationale("Tests representative, bounded and recoverable preparation for unfamiliar work.", "Representative practice reveals uncertainty while escalation and recovery can still be confirmed safely.", "Guided live work, a read-through or later review may suit different risk and reversibility.", "Guided first use is defensible when a practice environment cannot represent the live process."),
  change_02: rationale("Tests valid inputs, permissions, exceptions and accountable use of automation.", "It checks the complete control chain rather than confidence, familiarity or supplier scope alone.", "Known patterns, confidence and supplier rules inform review but cannot replace accountable validation.", "Known-pattern shortcuts may be defensible for low-impact suggestions with independent exception monitoring."),
  change_03: rationale("Tests surfacing and bounding a failed assumption through correct authority.", "It pauses the affected step, records evidence and enables an authorised correction.", "A safe workaround, old process or partial completion may be sensible depending on reversibility and authority.", "Returning to the old process is defensible where the assumption affects safety, legality or irreversible work."),
  change_04: rationale("Tests a handover's assumption, evidence boundary, next action and decision authority.", "Free text remains employee-authored context and is not automatically evaluated.", "Omitted elements identify questions for a reviewer, not a score.", "Tone, format and level of formality can vary with the workplace."),
  change_05: rationale("Explores reported connection of feedback to an intended outcome and bounded revision.", "Established practice reports comparing evidence with purpose before changing a bounded part.", "Workability feedback and issue-led adjustments remain useful; no opportunity is unknown.", "Preference feedback can be sufficient where usability is itself the defined outcome."),
  pressure_01: rationale("Tests prioritisation using impact, dependencies and confidentiality with an explicit trade-off.", "It gathers material facts, protects confidential work and secures an authorised priority.", "Protecting the deadline, splitting progress or finding capacity can work if their assumptions are verified.", "Protecting the fixed deadline first is defensible where impact and controls are already established."),
  pressure_02: rationale("Tests evidence for priority across outcome, delay harm, dependencies, effort and risk.", "The full set supports a transparent trade-off rather than urgency signals or ease alone.", "Deadline/customer impact, value/effort or commitments/capacity are useful subsets for narrower decisions.", "A subset is defensible where omitted dimensions are known to be equal or immaterial."),
  pressure_03: rationale("Tests communication of conflict, proposed priority, trade-off and decision required.", "Free text remains private authored context, not an automatically scored response.", "Missing an element prompts clarification; assertiveness, tone and style are not inferred as capability.", "Different escalation formats are valid when they preserve confidentiality and decision clarity."),
  pressure_04: rationale("Tests confirmation of data classification and authorised AI use under pressure.", "It resolves the permission boundary and preserves a safe delivery route while authority is clarified.", "Minimum-data or partial-use approaches try to manage urgency but may leave classification unresolved; owner risk acceptance cannot override policy.", "A minimum-data test is defensible only where approved anonymisation guidance confirms classification."),
  pressure_05: rationale("Explores reported conversion of delivery feedback into an owned reviewable improvement.", "Established practice reports an outcome, trade-offs, owner and review point.", "Deadline focus or informal discussion may fit smaller scope; no opportunity is unknown.", "Informal follow-up can be proportionate where work is low-risk and not repeated."),
};

const classifications: Record<string, Classification> = {
  check_01: structured("scope_then_decide", ["limited_pilot", "seek_second_source"], ["defer_for_full_coverage"]),
  check_02: structured("verify_human_owner", ["peer_readability_review", "manual_redraft"], ["model_repeat_check"]),
  check_03: workSample,
  check_04: structured("bounded_test", ["partial_implementation", "short_evidence_pause"], ["provisional_full_change"]),
  check_05: experience,
  flow_01: structured("map_end_to_end", ["trial_with_receiver", "rebalance_ownership"], ["retain_current_flow"]),
  flow_02: structured("end_to_end_evidence", ["team_time_and_feedback", "service_outcome_only"], ["first_team_with_exceptions"]),
  flow_03: workSample,
  flow_04: structured("joint_test_design", ["document_and_escalate", "extra_quality_check", "revise_before_trial"]),
  flow_05: experience,
  team_01: structured("separate_observations", ["parallel_actions", "facilitated_owner_decision"], ["shared_provisional_cause"]),
  team_02: structured("multiple_plausible", ["weighted_explanation", "operational_not_causal"], ["shared_contribution"]),
  team_03: workSample,
  team_04: structured("minimum_contribution", ["expert_review_point", "documented_delegation"], ["defer_until_available"]),
  team_05: experience,
  data_01: structured("rate_and_volume", ["lower_count_better", "rate_worse"], ["not_comparable"]),
  data_02: structured("comparable_basis", ["sample_confidence", "process_conditions", "error_impact"]),
  data_03: workSample,
  data_04: structured("small_measure_set", ["headline_with_note", "single_outcome_metric"], ["composite_index"]),
  data_05: experience,
  change_01: structured("representative_practice", ["guided_first_case", "low_risk_readthrough", "independent_then_review"]),
  change_02: structured("validated_accountable", ["known_pattern", "confidence_and_review", "supplier_rules"]),
  change_03: structured("pause_record_authorise", ["safe_workaround", "return_to_old_process", "complete_then_escalate"]),
  change_04: workSample,
  change_05: experience,
  pressure_01: structured("risk_priority_escalation", ["protect_fixed_deadline", "split_bounded_progress", "capacity_reassignment"]),
  pressure_02: structured("outcomes_risk_dependencies", ["deadline_and_customer", "value_and_effort", "commitments_and_capacity"]),
  pressure_03: workSample,
  pressure_04: structured("confirm_classification", ["minimum_data_trial"], ["approved_tool_assumption"], ["owner_risk_acceptance"]),
  pressure_05: experience,
};

export const liftRubricMatrix: readonly LiftRubricItem[] = liftAssessmentQuestions.map((item) => {
  const explanation = rationales[item.id];
  const classification = classifications[item.id];
  if (!explanation || !classification) throw new Error(`Missing Lift rubric definition for ${item.id}`);
  return {
    itemId: item.id,
    capabilities: [...item.capabilityIds],
    evidenceType: item.evidenceType,
    taskPurpose: item.prompt,
    ...explanation,
    ...classification,
    missingTreatment: "Missing, not applicable and not enough opportunity remain unknown and are excluded from negative interpretation.",
    inferenceLimit: "This pilot item cannot establish workplace performance, competence, potential, motivation or employment suitability.",
  };
});

export function rubricFor(itemId: string) {
  return liftRubricMatrix.find((item) => item.itemId === itemId) ?? null;
}
