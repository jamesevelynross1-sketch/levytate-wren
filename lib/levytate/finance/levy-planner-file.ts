import { z } from "zod";
import { fundingRuleVersion, validatePlanner, type PlannerInputs } from "./levy-planner";
const money=z.number().int().min(0).max(100_000_000_000);
const month=z.string().regex(/^20[2-4][0-9]-(0[1-9]|1[0-2])$/);
const cohort=z.strictObject({
  id:z.string().min(1).max(100),name:z.string().trim().min(1).max(100),standardId:z.string().max(100),standardTitle:z.string().max(500),level:z.number().int().min(2).max(7),
  startMonth:month,learners:z.number().int().min(1).max(10000),pricePence:z.number().int().min(1).max(100_000_000),bandPence:z.number().int().min(0).max(2_700_000),
  durationMonths:z.number().int().min(8).max(72),assessmentMonths:z.number().int().min(0).max(12),ageAtStart:z.number().int().min(16).max(100),
  exception:z.enum(["none","care-ehcp","foundation-other"]),route:z.enum(["levy","private"]),fundingChecked:z.boolean(),department:z.string().max(100),
});
export const plannerInputSchema=z.strictObject({
  openingMonth:month,openingPence:money,openingFunds:z.array(z.strictObject({receiptMonth:month,amountPence:money})).max(48),
  horizon:z.union([z.literal(12),z.literal(24),z.literal(36),z.literal(48)]),
  monthlyReceiptsPence:money,monthlyExistingPence:money,existingMonths:z.number().int().min(0).max(48),
  existingShortfallRate:z.union([z.literal(0),z.literal(5),z.literal(25)]),
  monthlyTransferPence:money,transferMonths:z.number().int().min(0).max(48),cohorts:z.array(cohort).max(50),
});
export function decodePlannerFile(value:unknown):{scenarioName:string;plan:PlannerInputs} {
  const parsed=z.strictObject({ruleVersion:z.literal(fundingRuleVersion),scenarioName:z.string().trim().min(1).max(100),plan:plannerInputSchema}).safeParse(value);
  if(!parsed.success)throw new Error("This is not a valid plan for the current funding-rule version.");
  const errors=validatePlanner(parsed.data.plan);
  if(errors.length)throw new Error(errors.join(" "));
  // The file is not trusted eligibility evidence. Require fresh confirmation.
  return {scenarioName:parsed.data.scenarioName,plan:{...parsed.data.plan,cohorts:parsed.data.plan.cohorts.map(c=>({...c,fundingChecked:false}))}};
}
