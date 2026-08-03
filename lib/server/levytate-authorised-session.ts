import { readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { checkProspectSessionAccess } from "@/lib/server/levytate-prospect-access";
import { revalidateEmployerSession } from "@/lib/server/levytate-auth";

export async function readAuthorisedLevyTateBetaSession(token: string | undefined | null) {
  const session = await readLevyTateBetaSession(token);
  if (!session) return null;
  const current = await revalidateEmployerSession(session);
  if (!current) return null;
  return await checkProspectSessionAccess(current.email) ? current : null;
}
