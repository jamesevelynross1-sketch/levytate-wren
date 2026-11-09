"use client";

import { useState } from "react";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { createRetainedWorkspaceRequest } from "@/lib/levytate/retained-workspace-request";

export function useRetainedWorkspaceRequest() {
  const { meta } = useMvpWorkspace();
  const [request] = useState(() => createRetainedWorkspaceRequest(meta?.storageMode === "supabase"
    ? { email: meta.userEmail, organisationId: meta.organisationId } : null));
  return request;
}
