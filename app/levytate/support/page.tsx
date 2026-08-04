import type { Metadata } from "next";
import { PublicTrustPage } from "@/components/levytate-public/PublicTrustPage";
import { getPublicTrustPage } from "@/lib/levytate/public-trust-content";

export const metadata: Metadata = { title: { absolute: "Support | LevyTate" }, description: "Get help with LevyTate access and service issues.", alternates: { canonical: "https://www.levytate.co.uk/support" } };
export default function Page() { return <PublicTrustPage page={getPublicTrustPage("support")} />; }
