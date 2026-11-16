"use client";

import { useEffect, useState } from "react";

/** Keep server-rendered controls inert until their submit handler is attached. */
export function useHydratedForm() {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  return ready;
}
