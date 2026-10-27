import type { Metadata } from "next";
import { levyTateWebsiteUrl } from "@/lib/levytate/hosts";
import { PublicTrustPage } from "@/components/levytate-public/PublicTrustPage";
import { getPublicTrustPage } from "@/lib/levytate/public-trust-content";

export const metadata: Metadata = { title: { absolute: "Account help | LevyTate" }, description: "Safe help for LevyTate sign-in and workspace access.", alternates: { canonical: levyTateWebsiteUrl("/account-help") } };
export default function Page() { return <PublicTrustPage page={getPublicTrustPage("account-help")} />; }
