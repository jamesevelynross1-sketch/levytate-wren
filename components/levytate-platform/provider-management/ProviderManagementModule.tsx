"use client";

import { ProvidersModule } from "@/components/levytate-mvp/ProvidersModule";
import { MvpWorkspaceProvider } from "@/components/levytate-mvp/MvpWorkspaceStore";

export function ProviderManagementModule() {
  return <MvpWorkspaceProvider><ProvidersModule /></MvpWorkspaceProvider>;
}