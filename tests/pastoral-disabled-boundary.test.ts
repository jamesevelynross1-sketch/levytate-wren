import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
const transport=vi.hoisted(()=>({select:vi.fn(),decrypt:vi.fn(),env:vi.fn()}));
vi.mock("@/lib/server/levytate-supabase",()=>({getLevyTateSupabaseConfig:()=>({}),supabaseSelect:transport.select,readRuntimeEnv:transport.env}));
vi.mock("@/lib/server/levytate-pastoral-crypto",()=>({isPastoralEncryptionConfigured:()=>true,decryptPastoralJson:transport.decrypt}));
vi.mock("@/lib/server/levytate-learner-lifecycle",()=>({getLearnerLifecycleServerContext:vi.fn()}));
import {isPastoralSupportEnabledForOrganisation} from "@/lib/server/levytate-pastoral-capability";
import {findPersistedAssistantReply,persistPastoralExchange} from "@/lib/server/levytate-pastoral";
type Context=Parameters<typeof findPersistedAssistantReply>[0];
const context={organisation:{id:"fictional-tenant"},user:{id:"fictional-owner"},employee:{id:"fictional-employee"},accessMode:"employee"} as Context;
const conversationId="95000000-0000-4000-a000-000000000001";
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("NODE_ENV","test");vi.stubEnv("VERCEL_ENV","preview");transport.env.mockImplementation((key:string)=>key==="LEVYTATE_PASTORAL_SUPPORT_ENABLED"?"true":key==="LEVYTATE_PASTORAL_SUPPORT_RATE_LIMIT_SECRET"?"synthetic-test-string-not-a-credential":"");});
afterEach(()=>vi.unstubAllEnvs());
describe("Disabled My Support technical boundaries; no live activation or model invocation",()=>{
 it("Production remains disabled even if runtime switches are set",async()=>{vi.stubEnv("VERCEL_ENV","production");expect(await isPastoralSupportEnabledForOrganisation("fictional-tenant")).toBe(false);expect(transport.select).not.toHaveBeenCalled();});
 it("missing follow-up schema fails closed after capability lookup",async()=>{
  transport.select.mockImplementation(async(_config:unknown,table:string)=>{if(table==="levytate_organisation_capabilities")return[{organisation_id:"fictional-tenant",pastoral_support_enabled:true}];throw new Error("Missing deliberately excluded schema");});
  expect(await isPastoralSupportEnabledForOrganisation("fictional-tenant")).toBe(false);
  for(const call of transport.select.mock.calls.slice(1))expect((call[2] as URLSearchParams).get("limit")).toBe("0");
 });
 it("local allowlisting cannot bypass a disabled organisation",async()=>{
  transport.env.mockImplementation((key:string)=>key==="LEVYTATE_PASTORAL_SUPPORT_ENABLED"?"true":key==="LEVYTATE_PASTORAL_SUPPORT_LOCAL_ORGANISATIONS"?"fictional-tenant":"synthetic-test-string-not-a-credential");
  transport.select.mockResolvedValue([]);expect(await isPastoralSupportEnabledForOrganisation("fictional-tenant")).toBe(false);
 });
 it("a lost-response lookup without conversation ID cannot decrypt expired history",async()=>{
  transport.select.mockImplementation(async(_config:unknown,table:string)=>table==="levytate_pastoral_messages"?[{conversation_id:conversationId,owner_user_id:context.user.id,employee_id:context.employee!.id}]:[{id:conversationId,retention_expires_at:"2000-01-01T00:00:00Z"}]);
  await expect(findPersistedAssistantReply(context,null,"fictional-message")).rejects.toMatchObject({status:404});expect(transport.decrypt).not.toHaveBeenCalled();
 });
 it("mis-scoped ciphertext is rejected before decryption",async()=>{
  transport.select.mockImplementation(async(_config:unknown,table:string)=>table==="levytate_pastoral_messages"?[{conversation_id:conversationId,owner_user_id:"another-owner",employee_id:context.employee!.id}]:[{id:conversationId,retention_expires_at:"2099-01-01T00:00:00Z"}]);
  await expect(findPersistedAssistantReply(context,null,"fictional-message")).rejects.toMatchObject({status:404});expect(transport.decrypt).not.toHaveBeenCalled();
 });
 it("history-off does not write conversations or exchanges",async()=>{
  expect(await persistPastoralExchange({context,preference:null,conversation:null,clientMessageId:"fictional-message",employeeMessage:"Synthetic text",assistantMessage:"Synthetic text"})).toBeNull();expect(transport.select).not.toHaveBeenCalled();
 });
});
