import {beforeEach,describe,expect,it,vi} from "vitest";
const transport=vi.hoisted(()=>({rpc:vi.fn(),Error:class extends Error{}}));
vi.mock("@/lib/server/levytate-supabase",()=>({getLevyTateSupabaseConfig:()=>({}),supabaseFetchJson:transport.rpc,LevyTateSupabaseError:transport.Error}));
vi.mock("@/lib/server/levytate-learner-lifecycle",()=>({getLearnerLifecycleServerContext:vi.fn(),LevyTateLearnerLifecyclePermissionError:class extends Error{}}));
vi.mock("@/lib/server/levytate-manager-scope",()=>({getManagerDirectReportContext:vi.fn(),listManagerDirectReportApplications:vi.fn()}));
import {atomicOperationalActionWrite} from "@/lib/server/levytate-operational-actions";
type Context=Parameters<typeof atomicOperationalActionWrite>[0];
const context={organisation:{id:"synthetic-tenant"},user:{id:"synthetic-actor"},actorDisplayName:"Fictional"} as Context;
beforeEach(()=>vi.clearAllMocks());
describe("Operations atomic transport, not genuine authentication acceptance",()=>{
 it("passes actor, action CAS and source snapshot to one RPC",async()=>{
  transport.rpc.mockResolvedValue({id:"stored",metadata:{}});
  await atomicOperationalActionWrite(context,"stored",2,"source_resolve",{status:"completed"},"2026-10-29T00:00:00Z");
  expect(transport.rpc).toHaveBeenCalledTimes(1);
  expect(JSON.parse(transport.rpc.mock.calls[0][2].body)).toMatchObject({p_actor_user_id:"synthetic-actor",p_expected_version:2,p_source_version:"2026-10-29T00:00:00Z",p_operation:"source_resolve"});
 });
 it("does not report an empty response as success",async()=>{transport.rpc.mockResolvedValue(null);await expect(atomicOperationalActionWrite(context,"stored",2,"transition",{status:"acknowledged"})).rejects.toThrow("could not be confirmed");});
 it.each(["PT403","PT404","PT409","40001","PT422","23505"])("sanitises %s",async code=>{
  transport.rpc.mockRejectedValue(new transport.Error(`${code}: private detail`));
  await expect(atomicOperationalActionWrite(context,"stored",2,"transition",{})).rejects.not.toThrow("private detail");
 });
});
