import { beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ fetch: vi.fn(), insert: vi.fn(), select: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/server/levytate-supabase", () => ({ getLevyTateSupabaseConfig: () => ({ url: "http://localhost:54321", serviceRoleKey: "fictional-test-key" }), supabaseFetchJson: fake.fetch, supabaseInsert: fake.insert, supabaseSelectAll: fake.select, supabaseUpdate: fake.update }));
import { archivePeopleRecord, importPeopleRecords, savePeopleRecord } from "../lib/server/levytate-people";
const importId = "e11e758c-68b4-4166-800f-0effc4802610";
const employee = { id: "employee-1", employeeNumber: "EMP1", name: "Fictional", email: "fictional@example.test", jobTitle: "Analyst", roleId: "", managerId: "", department: "Data", site: "", platformRole: "Employee", status: "Active", startDate: "2026-10-29", createdAt: "2026-10-29T15:00:00.000Z", updatedAt: "2026-10-29T15:00:00.000Z" };
beforeEach(() => {
  vi.clearAllMocks(); fake.select.mockResolvedValue([]); fake.insert.mockResolvedValue([{ id: employee.id }]);
  fake.fetch.mockResolvedValue({ importId, importedCount: 1, replayed: false });
});
describe("People persistence boundary", () => {
  it("makes one transactional RPC and preserves identical input on retry", async () => {
    expect(await importPeopleRecords("tenant-a", "actor", importId, [employee])).toMatchObject({ importedCount: 1 });
    fake.fetch.mockResolvedValueOnce({ importId, importedCount: 1, replayed: true });
    expect(await importPeopleRecords("tenant-a", "actor", importId, [employee])).toMatchObject({ replayed: true });
    expect(fake.fetch.mock.calls[0]).toEqual(fake.fetch.mock.calls[1]);
    expect(fake.insert).not.toHaveBeenCalled(); expect(fake.select).not.toHaveBeenCalled();
    const body = JSON.parse(fake.fetch.mock.calls[0][2].body);
    expect(body).toMatchObject({ p_organisation_id: "tenant-a", p_actor_user_id: "actor", p_import_id: importId });
    expect(body.p_employees[0]).not.toHaveProperty("organisation_id");
  });
  it("validates every row before contacting persistence", async () => {
    await expect(importPeopleRecords("tenant-a", "actor", importId, [employee, { ...employee, email: "bad" }])).rejects.toMatchObject({ status: 422 });
    expect(fake.fetch).not.toHaveBeenCalled();
  });
  it("rejects unconfirmed receipts and maps database conflicts without leaking data", async () => {
    fake.fetch.mockResolvedValueOnce({ importId, importedCount: 0, replayed: false });
    await expect(importPeopleRecords("tenant-a", "actor", importId, [employee])).rejects.toMatchObject({ status: 503 });
    fake.fetch.mockRejectedValueOnce(new Error("23505: secret record detail"));
    await expect(importPeopleRecords("tenant-a", "actor", importId, [employee])).rejects.toMatchObject({ status: 409 });
    fake.fetch.mockRejectedValueOnce(new Error("PT403: cross tenant"));
    await expect(importPeopleRecords("tenant-a", "actor", importId, [employee])).rejects.toMatchObject({ status: 403 });
  });
  it("rejects unsupported People fields and missing manager before a manual write", async () => {
    await expect(savePeopleRecord("tenant-a", { ...employee, organisation_id: "tenant-b" },"actor",0)).rejects.toMatchObject({ status: 422 });
    await expect(savePeopleRecord("tenant-a", { ...employee, managerId: "missing" },"actor",0)).rejects.toMatchObject({ status: 422 });
    expect(fake.insert).not.toHaveBeenCalled();
  });
  it("requires an atomic manual save receipt rather than a standalone entity insert", async () => {
    fake.fetch.mockResolvedValueOnce({entityKey:"levytate_employees:employee-1",revision:1});
    await savePeopleRecord("tenant-a", employee,"actor",0);
    expect(fake.insert).not.toHaveBeenCalled();
    expect(JSON.parse(fake.fetch.mock.calls[0][2].body)).toMatchObject({p_actor_user_id:"actor",p_expected_revision:0,p_action:"saveEmployee"});
    fake.fetch.mockResolvedValueOnce({});
    await expect(savePeopleRecord("tenant-a", employee,"actor",0)).rejects.toMatchObject({ status: 503 });
  });
  it("denies an archive target outside the current tenant", async () => {
    await expect(archivePeopleRecord("tenant-a", "other-person", "Archived","actor",0)).rejects.toMatchObject({ status: 404 });
    expect(fake.update).not.toHaveBeenCalled();
  });
  it("does not restore an employee when the same archive is retried", async () => {
    const current = { organisation_id: "tenant-a", id: employee.id, employee_number: employee.employeeNumber, name: employee.name, email: employee.email,
      job_title: employee.jobTitle, role_id: "", manager_id: "", department: employee.department, site: "", platform_role: "Employee", status: "Archived", start_date: employee.startDate, created_at: employee.createdAt, updated_at: employee.updatedAt };
    fake.select.mockImplementation(async (_config, table) => table === "levytate_employees" ? [current] : []);
    fake.fetch.mockResolvedValue({entityKey:"levytate_employees:employee-1",revision:1,replayed:true});
    await archivePeopleRecord("tenant-a", employee.id, "Archived","actor",0);
    await archivePeopleRecord("tenant-a", employee.id, "Archived","actor",0);
    expect(fake.update).not.toHaveBeenCalled();
    expect(fake.fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fake.fetch.mock.calls[1][2].body).p_record.status).toBe("Archived");
  });
});
