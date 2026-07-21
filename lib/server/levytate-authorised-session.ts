import { readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { checkProspectSessionAccess } from "@/lib/server/levytate-prospect-access";

export async function readAuthorisedLevyTateBetaSession(token: string | undefined | null) {
  const session = await readLevyTateBetaSession(token);
  if (!session) return null;
  return await checkProspectSessionAccess(session.email) ? session : null;
}
