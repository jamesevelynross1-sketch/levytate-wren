import {beforeEach,describe,expect,it,vi} from "vitest";
const transport=vi.hoisted(()=>({rpc:vi.fn(),Error:class extends Error{}}));
vi.mock("@/lib/server/levytate-supabase",()=>({getLevyTateSupabaseConfig:()=>({}),supabaseFetchJson:transport.rpc,LevyTateSupabaseError:transport.Error}));
vi.mock("@/lib/server/levytate-learner-lifecycle",()=>({getLearnerLifecycleServerContext:vi.fn()}));
vi.mock("@/lib/server/levytate-workspace",()=>({getWorkspaceBootstrapForSession:vi.fn()}));
vi.mock("@/lib/server/levytate-request-capability",()=>({isRequestsEnabledForOrganisation:vi.fn()}));
vi.mock("@/lib/server/resend",()=>({sendEmail:vi.fn()}));
import {requestCommand,resumableRequestInvitations} from "@/lib/server/levytate-service-requests";
import type {ServiceRequestInvitation} from "@/lib/levytate/requests/domain";
beforeEach(()=>vi.clearAllMocks());
describe("Requests atomic command transport (not real-auth acceptance)",()=>{
 const options={organisationId:"fictional-tenant",actorKind:"employer" as const,actorId:"fictional-actor",command:{action:"create_draft",idempotencyKey:"fictional-command"}};
 it("passes original command, current actor and complete CAS readset to one transaction",async()=>{
  transport.rpc.mockResolvedValue({committed:true,requestId:"stored"});
  await requestCommand(options,{requests_insert:[{id:"stored"}]},{requests:[]});
  expect(transport.rpc).toHaveBeenCalledTimes(1);
  expect(JSON.parse(transport.rpc.mock.calls[0][2].body)).toMatchObject({p_actor_kind:"employer",p_actor_id:"fictional-actor",p_command:options.command,p_expected:{requests:[]},p_probe:false});
 });
 it("permits a missing authenticated receipt without writing",async()=>{transport.rpc.mockResolvedValue(null);expect(await requestCommand(options,{}, {},true)).toBeNull();expect(JSON.parse(transport.rpc.mock.calls[0][2].body).p_probe).toBe(true);});
 it("cannot describe an empty write response as success",async()=>{transport.rpc.mockResolvedValue(null);await expect(requestCommand(options)).rejects.toMatchObject({status:503});});
 it.each([["PT403",403],["PT404",404],["PT409",409],["PT422",400],["40001",409],["23505",409]])("maps %s without provider or credential detail",async(code,status)=>{
  transport.rpc.mockRejectedValue(new transport.Error(`${code}: private diagnostic`));
  await expect(requestCommand(options)).rejects.toMatchObject({status});
  await expect(requestCommand(options)).rejects.not.toThrow("private diagnostic");
 });
});
describe("Invitation replay is bounded by the original committed command",()=>{
 const invitations=[{id:"original",requestId:"request",providerId:"provider",status:"pending_delivery"},{id:"later",requestId:"request",providerId:"later-provider",status:"delivery_failed"}] as ServiceRequestInvitation[];
 const receipt={requestId:"request",deliveryInvitationIds:["original"]};
 it.each(["create_draft","update_draft","shortlist","publish_revision"])("%s replay cannot deliver invitations",action=>expect(resumableRequestInvitations({action},receipt,invitations)).toEqual([]));
 it("outbound replay resumes only the durable original invitation",()=>expect(resumableRequestInvitations({action:"invite_providers",providerIds:["provider","later-provider"]},receipt,invitations)).toEqual([invitations[0]]));
 it("requires both original provider scope and exact invitation retry scope",()=>{
  expect(resumableRequestInvitations({action:"invite_providers",providerIds:["later-provider"]},receipt,invitations)).toEqual([]);
  expect(resumableRequestInvitations({action:"retry_invitation",invitationId:"later"},receipt,invitations)).toEqual([]);
 });
 it("an older receipt without a delivery set fails closed",()=>expect(resumableRequestInvitations({action:"invite_providers",providerIds:["provider"]},{requestId:"request"},invitations)).toEqual([]));
});
