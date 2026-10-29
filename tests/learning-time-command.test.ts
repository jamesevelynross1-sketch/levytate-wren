import { beforeEach,describe,expect,it,vi } from "vitest";
const transport=vi.hoisted(()=>({rpc:vi.fn(),select:vi.fn()}));
vi.mock("@/lib/server/levytate-supabase",()=>({getLevyTateSupabaseConfig:()=>({}),supabaseFetchJson:transport.rpc,supabaseSelect:transport.select,supabaseSelectAll:transport.select}));
vi.mock("@/lib/server/levytate-learner-lifecycle",()=>({getLearnerLifecycleServerContext:vi.fn()}));
vi.mock("@/lib/server/levytate-off-the-job-capability",()=>({isOffTheJobAssistantEnabledForOrganisation:vi.fn()}));
import {learningTimeCommand,probeLearningTimeCommand} from "@/lib/server/levytate-off-the-job";
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
