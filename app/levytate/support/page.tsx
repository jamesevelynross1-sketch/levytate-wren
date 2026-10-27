import type { Metadata } from "next";
import { levyTateWebsiteUrl } from "@/lib/levytate/hosts";
import { PublicTrustPage } from "@/components/levytate-public/PublicTrustPage";
import { getPublicTrustPage } from "@/lib/levytate/public-trust-content";

export const metadata: Metadata = { title: { absolute: "Support | LevyTate" }, description: "Get help with LevyTate access and service issues.", alternates: { canonical: levyTateWebsiteUrl("/support") } };
export default function Page() { return <PublicTrustPage page={getPublicTrustPage("support")} />; }
