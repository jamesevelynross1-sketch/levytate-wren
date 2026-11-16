"use client";

import { useRef, useState } from "react";

export function assertConfirmedCatalogueResult(result: unknown) {
  if (!result || typeof result !== "object" || !("ok" in result) || result.ok !== true) {
    const message = result && typeof result === "object" && "message" in result && typeof result.message === "string" ? result.message : "The change could not be confirmed. Your input has been retained.";
    throw new Error(message);
  }
}

/** Keep the editor open until persistence and the workspace reload are confirmed. */
export function useCatalogueAction(setError: (message: string) => void) {
  const inFlight = useRef(false);
  const [saving, setSaving] = useState(false);
  async function perform(action: () => Promise<unknown>) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setSaving(true);
    setError("");
    try { assertConfirmedCatalogueResult(await action()); return true; }
    catch (error) { setError(error instanceof Error ? error.message : "The change could not be confirmed. Your input has been retained."); return false; }
    finally { inFlight.current = false; setSaving(false); }
  }
  return { saving, perform };
}
