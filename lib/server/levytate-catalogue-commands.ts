import { ClientRequestError } from "@/lib/server/levytate-request-boundary";
import { getLevyTateSupabaseConfig, supabaseFetchJson } from "@/lib/server/levytate-supabase";

/** Only server-authenticated actor/tenant identifiers may reach these RPCs. */
export async function runCatalogueCommand(name: "levytate_save_role" | "levytate_select_catalogue", parameters: Record<string, unknown>) {
  const config = getLevyTateSupabaseConfig();
  if (!config) throw new ClientRequestError("Catalogue persistence is unavailable. Your changes have been retained.", 503);
  try {
    const result = await supabaseFetchJson<{ id: string }>(config, `rpc/${name}`, { method: "POST", body: JSON.stringify(parameters) });
    const expected = name === "levytate_save_role" ? (parameters.p_role as { id: string }).id : parameters.p_id;
    if (!result || result.id !== expected) throw new Error("Unconfirmed catalogue write");
    return result;
  } catch (error) {
    throwCataloguePersistenceError(error);
  }
}

export function throwCataloguePersistenceError(error: unknown): never {
  if (error instanceof ClientRequestError) throw error;
  const message = error instanceof Error ? error.message : "";
  if (/^(PT409|23505)/.test(message)) throw new ClientRequestError("This record changed or is still in use. Refresh and check linked records before trying again.", 409);
  if (message.startsWith("PT403")) throw new ClientRequestError("You do not have permission to change this catalogue record.", 403);
  if (message.startsWith("PT404")) throw new ClientRequestError("The catalogue record is no longer available.", 404);
  if (/^(PT422|23503|23514)/.test(message)) throw new ClientRequestError("Check the record and its current provider, programme and standard references.", 422);
  throw new ClientRequestError("Catalogue persistence is temporarily unavailable. Retry with the same input.", 503);
}
