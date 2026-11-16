"use client";

import { useCallback, useState } from "react";
import type { ClientIdentity } from "@/lib/levytate/client-session";
import { createPinnedClientMutation } from "@/lib/levytate/client-mutation-retry";

export function usePinnedClientMutation<T>(identity: ClientIdentity | null, path: string, decode: (value: unknown) => T, readResponse?: (response: Response) => Promise<unknown>, method: "POST" | "PATCH" = "POST") {
  const [controller] = useState(() => createPinnedClientMutation(identity, path, decode, undefined, readResponse, method));
  const [working, setWorking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [reconciled, setReconciled] = useState(0);
  const run = useCallback(async (command?: unknown, confirmed?: (value: T) => void) => {
    if (controller.busy) throw new Error("An update is already in progress.");
    // The command is retained while transport is still in flight, too. Expose
    // recovery immediately so native modality prevents navigation losing it.
    setWorking(true); setPending(true); setError("");
    try {
      const result = command === undefined ? await controller.retry() : await controller.execute(command, confirmed);
      if (command === undefined) setReconciled((value) => value + 1);
      return result;
    } catch (failure) {
      setError(failure instanceof Error && failure.name === "Error" ? failure.message : "The connection was interrupted. The update could not be confirmed.");
      throw failure;
    } finally { setWorking(controller.busy); setPending(controller.pending); }
  }, [controller]);
  const retry = useCallback(() => { void run().catch(() => undefined); }, [run]);
  return { execute: run, retry, working, pending, error, reconciled, locked: working || pending };
}
