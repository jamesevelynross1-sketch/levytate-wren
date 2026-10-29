import { afterEach, describe, expect, it, vi } from "vitest";
import { supabaseSelectAll } from "../lib/server/levytate-supabase";
const config = { url: "http://localhost:54321", serviceRoleKey: "fictional-only" };
const query = new URLSearchParams({ select: "id", order: "id.asc" });
afterEach(() => vi.unstubAllGlobals());
describe("complete tenant pagination", () => {
  it("follows Content-Range under a server cap instead of returning a short partial page", async () => {
    const fetcher = vi.fn(async (url: string) => {
      const offset = Number(new URL(url).searchParams.get("offset"));
      const rows = Array.from({ length: Math.min(2, 5 - offset) }, (_, i) => ({ id: offset + i }));
      return Response.json(rows, { headers: { "Content-Range": `${offset}-${offset + rows.length - 1}/5` } });
    });
    vi.stubGlobal("fetch", fetcher);
    expect(await supabaseSelectAll(config, "employees", query)).toHaveLength(5);
    expect(fetcher.mock.calls.map(([url]) => new URL(url).searchParams.get("offset"))).toEqual(["0", "2", "4"]);
  });
  it("accepts a confirmed empty dataset", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([], { headers: { "Content-Range": "*/0" } })));
    expect(await supabaseSelectAll(config, "employees", query)).toEqual([]);
  });
  it.each([
    { range: "0-0/*", items: [{ id: 1 }] }, { range: "3-3/4", items: [{ id: 1 }] }, { range: "0-2/3", items: [{ id: 1 }] }, { range: "*/4", items: [] },
  ])("fails closed on missing/inconsistent completeness evidence %j", async ({ range, items }) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(items, { headers: { "Content-Range": range } })));
    await expect(supabaseSelectAll(config, "employees", query)).rejects.toThrow();
  });
  it("rejects a changing dataset and never returns partial totals", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json([{ id: 1 }], { headers: { "Content-Range": "0-0/2" } })).mockResolvedValueOnce(Response.json([{ id: 2 }], { headers: { "Content-Range": "1-1/3" } })));
    await expect(supabaseSelectAll(config, "employees", query)).rejects.toThrow(/changed/);
  });
  it("fails at the configured safety limit rather than silently truncate", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([{ id: 1 }], { headers: { "Content-Range": "0-0/6" } })));
    await expect(supabaseSelectAll(config, "employees", query, { maxRows: 5 })).rejects.toThrow(/safety limit/);
  });
});
