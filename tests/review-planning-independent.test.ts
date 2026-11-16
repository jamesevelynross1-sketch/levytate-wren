import { describe, expect, it } from "vitest";
import { completedReviewEvidence, selectReviewPlan } from "@/lib/levytate/mvp/review-planning";

const row = (id: string, status: string, reviewDate: string, nextReviewDate: string, createdAt: string) => ({ id, status, reviewDate, nextReviewDate, createdAt });
const scheduled = row("original-scheduled", "scheduled", "2026-12-16", "", "2026-11-16T09:55:00Z");
const completed = row("later-completed", "completed", "2026-11-16", "2026-11-23", "2026-11-16T10:20:00Z");

describe("independent current review-plan boundary", () => {
  for (const rows of [[scheduled, completed], [completed, scheduled]]) it(`uses actual recorded chronology in order ${rows[0].id}`, () => {
    const result = selectReviewPlan(rows);
    expect(result.latest?.id).toBe(completed.id);
    expect(result.nextDate).toBe("2026-11-23");
    expect(completedReviewEvidence(rows)[0]?.id).toBe(completed.id);
  });
  it("uses a scheduled appointment's own date without inventing completed evidence", () => {
    expect(selectReviewPlan([scheduled])).toMatchObject({ latest: scheduled, nextDate: "2026-12-16" });
    expect(completedReviewEvidence([scheduled])).toEqual([]);
  });
  it("keeps recorded evidence while a newer explicit schedule replaces the next date", () => {
    const next = row("new-schedule", "scheduled", "2026-11-25", "", "2026-11-16T11:00:00Z");
    const result = selectReviewPlan([next, completed, scheduled]);
    expect(result.nextDate).toBe("2026-11-25");
    expect(completedReviewEvidence([next, completed, scheduled])[0]).toEqual(completed);
  });
  it("does not turn a newly cancelled plan into a due review", () => {
    const cancelled = row("cancel", "cancelled", "2026-12-16", "2027-01-01", "2026-11-16T11:00:00Z");
    expect(selectReviewPlan([scheduled, completed, cancelled])).toMatchObject({ latest: cancelled, nextDate: "" });
  });
  it("permits a later explicitly recorded schedule after cancellation", () => {
    const cancel = row("cancel", "cancelled", "2026-12-16", "", "2026-11-16T11:00:00Z");
    const resumed = row("resumed", "scheduled", "2026-11-26", "", "2026-11-16T12:00:00Z");
    expect(selectReviewPlan([resumed, cancel, completed]).nextDate).toBe("2026-11-26");
  });
  it("a recorded empty follow-up does not silently reuse the obsolete appointment", () => {
    const closed = { ...completed, nextReviewDate: "" };
    expect(selectReviewPlan([scheduled, closed]).nextDate).toBe("");
  });
  for (const reverse of [false, true]) it(`makes equal-time cancellation conservative and deterministic (${reverse})`, () => {
    const at = "2026-11-16T10:20:00Z", values = [
      { ...scheduled, createdAt: at }, { ...completed, createdAt: at }, row("cancel", "cancelled", "2026-11-01", "", at),
    ];
    const result = selectReviewPlan(reverse ? values.reverse() : values);
    expect(result.latest?.status).toBe("cancelled"); expect(result.nextDate).toBe("");
  });
  it("compares instants rather than timestamp spelling", () => {
    const result = selectReviewPlan([{ ...scheduled, createdAt: "2026-11-16T11:20:00+01:00" }, completed]);
    expect(result.latest?.id).toBe(completed.id);
  });
  it("orders completed narrative evidence by actual review date and excludes cancelled/scheduled rows", () => {
    const backfill = row("backfill", "completed", "2026-11-01", "", "2026-11-16T12:00:00Z");
    expect(completedReviewEvidence([backfill, scheduled, completed]).map(item => item.id)).toEqual([completed.id, backfill.id]);
  });
  it("preserves source arrays and rows", () => {
    const values = Object.freeze([Object.freeze({ ...scheduled }), Object.freeze({ ...completed })]);
    expect(selectReviewPlan(values).latest?.id).toBe(completed.id);
    expect(completedReviewEvidence(values)).toEqual([completed]);
    expect(values[0].id).toBe(scheduled.id);
  });
  it("returns an explicit empty plan for no evidence", () => {
    expect(selectReviewPlan([])).toEqual({ latest: null, nextDate: "" });
  });
});
