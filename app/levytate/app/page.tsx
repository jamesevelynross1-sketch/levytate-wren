import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LevyTateMvpApp } from "@/components/levytate-mvp/LevyTateMvpApp";
import { levytateBetaSessionCookie, readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { LevyTateWorkspacePermissionError, getWorkspaceBootstrapForSession } from "@/lib/server/levytate-workspace";

export const metadata: Metadata = {
  title: "MVP App | LevyTate",
  description: "Protected LevyTate beta MVP workspace.",
};

export default async function LevyTateAppPage() {
  const cookieStore = await cookies();
  const session = await readLevyTateBetaSession(cookieStore.get(levytateBetaSessionCookie)?.value);

  if (!session) redirect("/login");

  try {
    const initialWorkspace = await getWorkspaceBootstrapForSession(session);
    return <LevyTateMvpApp initialWorkspace={initialWorkspace} />;
  } catch (error) {
    if (error instanceof LevyTateWorkspacePermissionError) {
      return <AccountSetupRequired message={error.message} />;
    }

    throw error;
  }
}

function AccountSetupRequired({ message }: { message: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f6fbf8] px-5 py-10 text-[#102c3d]">
      <section className="w-full max-w-lg rounded-[1.5rem] border border-[#102c3d]/[0.08] bg-white p-7 shadow-[0_30px_90px_rgba(16,44,61,0.1)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Workspace access</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">Account setup required</h1>
        <p className="mt-4 text-sm leading-6 text-[#102c3d]/64">{message}</p>
        <a
          href="/login"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,44,61,0.14)]"
        >
          Return to login
        </a>
      </section>
    </main>
  );
}
