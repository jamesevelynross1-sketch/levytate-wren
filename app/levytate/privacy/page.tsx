import type { Metadata } from "next";
import { PublicTrustPage } from "@/components/levytate-public/PublicTrustPage";
import { getPublicTrustPage } from "@/lib/levytate/public-trust-content";

export const metadata: Metadata = { title: { absolute: "Privacy | LevyTate" }, description: "How LevyTate handles personal information.", alternates: { canonical: "https://www.levytate.co.uk/privacy" } };
export default function Page() { return <PublicTrustPage page={getPublicTrustPage("privacy")} />; }
