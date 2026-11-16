import { beforeEach,describe,expect,it,vi } from "vitest";
const transport=vi.hoisted(()=>({rpc:vi.fn(),select:vi.fn(),context:vi.fn(),enabled:vi.fn()}));
vi.mock("@/lib/server/levytate-supabase",()=>({getLevyTateSupabaseConfig:()=>({}),supabaseFetchJson:transport.rpc,supabaseSelect:transport.select,supabaseSelectAll:transport.select}));
vi.mock("@/lib/server/levytate-learner-lifecycle",()=>({getLearnerLifecycleServerContext:transport.context}));
vi.mock("@/lib/server/levytate-off-the-job-capability",()=>({isOffTheJobAssistantEnabledForOrganisation:transport.enabled}));
import {learningTimeCommand,probeLearningTimeCommand,transitionLearningTimeActivity} from "@/lib/server/levytate-off-the-job";
import type { LevyTateBetaSession } from "@/lib/levytate/config/beta-access";
beforeEach(()=>vi.clearAllMocks());
describe("Learning Time atomic command transport (not real-auth acceptance)",()=>{
  const input={idempotencyKey:"synthetic-command",activityId:"synthetic-activity",lockVersion:2};
  it("passes the actor, original input and normalized row to one atomic RPC",async()=>{
    transport.rpc.mockResolvedValue({id:"stored"});
    expect(await learningTimeCommand("tenant","actor","save_activity",input,{title:"Fictional"})).toEqual({id:"stored"});
    expect(transport.rpc).toHaveBeenCalledTimes(1);
    expect(JSON.parse(transport.rpc.mock.calls[0][2].body)).toEqual({p_organisation_id:"tenant",p_actor_user_id:"actor",p_action:"save_activity",p_input:input,p_row:{title:"Fictional"},p_probe:false});
  });
  it("permits an empty authenticated receipt probe without a write",async()=>{
    transport.rpc.mockResolvedValue(null);expect(await probeLearningTimeCommand("tenant","actor","save_activity",input)).toBeNull();
    expect(JSON.parse(transport.rpc.mock.calls[0][2].body)).toMatchObject({p_probe:true,p_row:{}});
  });
  it("returns the committed receipt without replaying mutable calculations",async()=>{
    transport.rpc.mockResolvedValue({id:"stored",duration_minutes:60});expect(await probeLearningTimeCommand("tenant","actor","save_activity",input)).toMatchObject({id:"stored"});expect(transport.select).not.toHaveBeenCalled();
  });
  it("rejects missing retry key before persistence",async()=>{await expect(learningTimeCommand("tenant","actor","save_activity",{})).rejects.toMatchObject({status:400});expect(transport.rpc).not.toHaveBeenCalled();});
  it("does not claim success when the write response is missing",async()=>{transport.rpc.mockResolvedValue(null);await expect(learningTimeCommand("tenant","actor","submit_activity",input)).rejects.toMatchObject({status:503});});
  it.each([["PT403",403],["PT404",404],["PT409",409],["PT422",422],["23505",409],["private backend detail",503]])("maps %s safely",async(code,status)=>{
    transport.rpc.mockRejectedValue(new Error(`${code}: credential/private detail`));await expect(learningTimeCommand("tenant","actor","submit_activity",input)).rejects.toMatchObject({status});
    await expect(learningTimeCommand("tenant","actor","submit_activity",input)).rejects.not.toThrow("credential/private detail");
  });
});

describe("Learning Time service transition permissions (not hosted or real-auth acceptance)",()=>{
  const session={email:"fictional@example.invalid"} as LevyTateBetaSession;
  const input={activityId:"synthetic-activity",note:"Synthetic note",lockVersion:1,idempotencyKey:"synthetic-transition"};
  beforeEach(()=>{
    transport.enabled.mockResolvedValue(true);
    transport.rpc.mockRejectedValue(new Error("PT409: Learning Time state or evidence no longer permits this change"));
  });
  it.each([
    ["Employee","employer_check"],["Employee","request_information"],["Employee","mark_not_counted"],
    ["Line Manager","employer_check"],["Line Manager","request_information"],["Line Manager","mark_not_counted"],
    ["Apprenticeship Lead","withdraw"],["Employer Admin","withdraw"],
  ])("denies %s %s before a legacy state error can disguise the permission denial",async(role,action)=>{
    transport.context.mockResolvedValue({organisation:{id:"tenant"},user:{id:"actor",role}});
    await expect(transitionLearningTimeActivity(session,{...input,action})).rejects.toMatchObject({status:403});
    expect(transport.rpc).not.toHaveBeenCalled();
  });
  it.each([
    ["Employee","withdraw"],["Line Manager","withdraw"],["Apprenticeship Lead","employer_check"],["Apprenticeship Lead","request_information"],["Apprenticeship Lead","mark_not_counted"],
    ["Employer Admin","employer_check"],["Employer Admin","request_information"],["Employer Admin","mark_not_counted"],
  ])("keeps %s %s subject to the transactional ownership and state checks",async(role,action)=>{
    transport.context.mockResolvedValue({organisation:{id:"tenant"},user:{id:"actor",role}});
    await expect(transitionLearningTimeActivity(session,{...input,action})).rejects.toMatchObject({status:409});
    expect(transport.rpc).toHaveBeenCalledTimes(1);
    expect(JSON.parse(transport.rpc.mock.calls[0][2].body)).toMatchObject({p_actor_user_id:"actor",p_organisation_id:"tenant",p_action:"transition_activity",p_input:{...input,action}});
  });
});
