import { describe, expect, it } from "vitest";
import { applicationProgrammeOptions, applicationProgrammeLabel } from "@/lib/levytate/mvp/application-programme-options";
import type { ApprenticeshipStandard, ProviderCatalogueRecord, ProviderProgramme } from "@/lib/levytate/domain";
import type { MvpWorkspaceData } from "@/lib/levytate/mvp/workspace";

const standard = (id: string, title: string) => ({ id, title, level: 4, referenceCode: id, status: "Live" }) as ApprenticeshipStandard;
const provider = (providerId: string, providerName: string) => ({ providerId, providerName, status: "Active", verificationStatus: "verified", lastVerified: "2026-11-25" }) as ProviderCatalogueRecord;
const offer = (id: string, providerId: string, standardId: string) => ({ id, providerId, programmeName: id, linkedStandardId: standardId, linkedStandardIds: [standardId], status: "Active", recordStatus: "Active", verificationStatus: "LevyTate reviewed" }) as ProviderProgramme;
const standards = [standard("ST1","Data Analyst"), standard("ST2","Project Manager"), standard("ST3","Unlinked")];
const data = {
  employees: [{ id: "person", roleId: "" }], roles: [],
  providers: [provider("a","Provider A"),provider("b","Provider B")],
  providerProgrammes: [offer("a1","a","ST1"),offer("b1","b","ST1"),offer("a2","a","ST2")],
  organisationProviders: [{ providerId: "a", status: "Active" }],
  organisationProgrammes: [{ programmeId: "a1", providerId: "a", status: "Active" }],
} as Pick<MvpWorkspaceData, "employees" | "roles" | "providers" | "providerProgrammes" | "organisationProviders" | "organisationProgrammes">;
describe("provider-backed application choices", () => {
  it("offers all available standards with no role mapping and deduplicates providers", () => {
    const result = applicationProgrammeOptions(data,"person",standards);
    expect(result.map(item => item.standard.id)).toEqual(["ST1","ST2"]);
    expect(result[0]).toMatchObject({published:true,recommended:false,offers:[{providerId:"a",published:true},{providerId:"b",published:false}]});
    expect(result[1].published).toBe(false);
    expect(applicationProgrammeLabel(result[1])).toContain("Add to My Programmes");
  });
  it("uses role mapping as recommendation rather than eligibility", () => {
    const mapped = { ...data, employees: [{ id:"person",roleId:"role" }], roles:[{ id:"role",pathwayMappings:[{apprenticeshipStandardId:"ST2"}]}] } as typeof data;
    expect(applicationProgrammeOptions(mapped,"person",standards).map(item=>[item.standard.id,item.recommended])).toEqual([["ST2",true],["ST1",false]]);
  });
  it("excludes paused, unverified and unlinked offers", () => {
    const invalid = {...data,providerProgrammes:[{...offer("pause","a","ST1"),status:"Paused" as const},{...offer("bad","a","ST2"),verificationStatus:"Needs manual verification" as const},offer("unlinked","a","ST999"),offer("missing","not-a-provider","ST3")]};
    expect(applicationProgrammeOptions(invalid,"person",standards)).toEqual([]);
  });
  it("does not consider a provider mismatch or inactive provider selection published", () => {
    expect(applicationProgrammeOptions({...data,organisationProviders:[],organisationProgrammes:[{...data.organisationProgrammes[0],providerId:"b"}]},"person",standards).every(option=>!option.published)).toBe(true);
  });
});
