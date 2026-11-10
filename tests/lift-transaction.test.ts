import { beforeEach, describe, expect, it, vi } from "vitest";
const transport = vi.hoisted(() => ({ rpc: vi.fn(), select: vi.fn(), all: vi.fn() }));
vi.mock("@/lib/server/levytate-supabase", () => ({ getLevyTateSupabaseConfig: () => ({}), supabaseFetchJson: transport.rpc, supabaseSelect: transport.select, supabaseSelectAll: transport.all }));
import { insertLiftPlan, liftWritePlan, runLiftTransaction, selectLiftPlan, updateLiftPlan } from "@/lib/server/levytate-lift-transaction";
import { calculateLiftCapacityValue, canTransitionLiftProof } from "@/lib/levytate/lift/value";
import type { LiftAction, LiftProofRecord } from "@/lib/levytate/lift/domain";
const command: LiftAction = { action:"submit_assessment", assessmentId:"synthetic",expectedRevision:1,expectedWorkspaceRevision:3,idempotencyKey:"synthetic-request" };
beforeEach(() => { vi.clearAllMocks(); transport.select.mockResolvedValue([{revision:3}]);transport.all.mockResolvedValue([]);transport.rpc.mockResolvedValueOnce(null).mockResolvedValue({revision:4}); });
describe("Lift atomic write plan (transport simulation, not authentication acceptance)", () => {
  it("provides read-your-writes and submits one complete transaction after probe", async () => {
    await runLiftTransaction("tenant","actor",command, async () => {
      await insertLiftPlan("levytate_lift_assessments",[{id:"a",organisation_id:"tenant",status:"draft"}],false);
      await updateLiftPlan("levytate_lift_assessments",{id:"eq.a"},{status:"submitted"});
      expect(await selectLiftPlan("levytate_lift_assessments",{status:"eq.submitted"})).toHaveLength(1);
    });
    expect(transport.rpc).toHaveBeenCalledTimes(2);
    const payload=JSON.parse(transport.rpc.mock.calls[1][2].body);
    expect(payload).toMatchObject({p_actor_user_id:"actor",p_organisation_id:"tenant",p_command:command,p_probe:false});
    expect(payload.p_writes).toHaveLength(2);
  });
  it("does not persist a partial plan when later validation fails",async () => {
    await expect(runLiftTransaction("tenant","actor",command,async () => { await insertLiftPlan("levytate_lift_assessments",[{id:"a"}],false);throw new Error("late validation"); })).rejects.toMatchObject({status:503});
    expect(transport.rpc).toHaveBeenCalledTimes(1);
  });
  it("returns a receipt before rebuilding already committed evidence",async () => {
    transport.rpc.mockReset().mockResolvedValue({revision:4});const build=vi.fn();await runLiftTransaction("tenant","actor",command,build);expect(build).not.toHaveBeenCalled();
  });
  it("rejects stale browser revision before constructing writes",async () => {
    transport.select.mockResolvedValue([{revision:4}]);const build=vi.fn();await expect(runLiftTransaction("tenant","actor",command,build)).rejects.toMatchObject({status:409});expect(build).not.toHaveBeenCalled();
  });
  it("prevents reused evidence IDs silently concealing a changed measure",async () => {
    transport.all.mockResolvedValue([{id:"e",source_type:"operational_baseline",quantity_value:10}]);
    await expect(liftWritePlan.run({organisationId:"tenant",rows:new Map(),writes:[]},()=>insertLiftPlan("levytate_lift_evidence_records",[{id:"e",source_type:"operational_baseline",quantity_value:20}],true))).rejects.toMatchObject({status:409});
  });
  it.each([["PT403",403],["PT404",404],["PT409",409],["PT422",422],["23505",409],["secret detail",503]])("maps %s without leaking persistence details",async(code,status)=>{
    transport.rpc.mockReset().mockRejectedValue(new Error(`${code}: private data`));await expect(runLiftTransaction("tenant","actor",command,async()=>{})).rejects.toMatchObject({status});
  });
});
describe("Lift proof and value truthfulness",()=>{
  const proof={state:"signal_identified",owner:"Fictional owner",agreedScope:"Synthetic test",intendedMeasure:"seconds",baseline:{quantity:{value:10,unit:"s",population:"synthetic"}},outcome:{quantity:{value:5,unit:"s",population:"synthetic"},recordedAt:"2026-10-29"},reviewedBy:"Reviewer",verification:"internal_review"} as LiftProofRecord;
  it("denies a fabricated direct leap to measured outcome",()=>expect(canTransitionLiftProof({current:proof,nextState:"outcome_evidenced",decisionRecorded:true})).toBe(false));
  it("permits a comparable outcome only after the recorded test stage",()=>expect(canTransitionLiftProof({current:{...proof,state:"change_tested"},nextState:"outcome_evidenced",decisionRecorded:true})).toBe(true));
  it("denies terminal evidence reversal",()=>expect(canTransitionLiftProof({current:{...proof,state:"outcome_evidenced"},nextState:"signal_identified",decisionRecorded:true})).toBe(false));
  it("rejects non-finite model assumptions",()=>expect(()=>calculateLiftCapacityValue({affectedPeople:Infinity,minutesReleasedPerPersonPerWeek:10,applicableWeeks:2,realisedFraction:1,employerLoadedHourlyRate:null,basis:"modelled_scenario",period:"synthetic"})).toThrow());
});
