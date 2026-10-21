import { notFound } from "next/navigation";
import { LiftModule } from "@/components/levytate-mvp/LiftModule";
import type { LiftWorkspace } from "@/lib/levytate/lift/domain";
import { buildLiftFixtureWorkspace } from "@/lib/server/levytate-lift-fixtures";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LiftFixturePreview({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV !== "development" || process.env.LEVYTATE_LIFT_FIXTURE_PREVIEW !== "true") notFound();
  const query = await searchParams;
  const requested = typeof query.role === "string" ? query.role : "Apprenticeship Lead";
  const requestedView = typeof query.view === "string" ? query.view : "Opportunity";
  const role: LiftWorkspace["role"] = requested === "Employee" || requested === "Line Manager" || requested === "Employer Admin" ? requested : "Apprenticeship Lead";
  const view = requestedView === "Decisions" || requestedView === "Proof" || requestedView === "Participation" || requestedView === "Historical" ? requestedView : "Opportunity";
  return <main className="min-h-screen bg-[#f3f6f2] px-4 py-6 text-[#102c3d] sm:px-6 lg:px-8"><div className="mx-auto max-w-[1580px]"><LiftModule initialWorkspace={buildLiftFixtureWorkspace(role)} initialLeaderView={view}/></div></main>;
}
