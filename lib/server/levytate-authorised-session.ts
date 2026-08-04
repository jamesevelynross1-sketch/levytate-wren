import { readLevyTateBetaSession } from "@/lib/levytate/config/beta-access";
import { checkProspectSessionAccess } from "@/lib/server/levytate-prospect-access";
import { revalidateEmployerSession } from "@/lib/server/levytate-auth";
import { getTermsGateState } from "@/lib/server/levytate-early-access-terms";

export async function readAuthorisedLevyTateBetaSession(token: string | undefined | null, options: { allowTermsPending?: boolean } = {}) {
  const session = await readLevyTateBetaSession(token);
  if (!session) return null;
  const current = await revalidateEmployerSession(session);
  if (!current) return null;
  if (!(await checkProspectSessionAccess(current.email))) return null;
  if (options.allowTermsPending) return current;
  const terms = await getTermsGateState(current);
  return terms.bypass || terms.accepted ? current : null;
}
