import type { Metadata } from "next";
import { PublicTrustPage } from "@/components/levytate-public/PublicTrustPage";
import { getPublicTrustPage } from "@/lib/levytate/public-trust-content";

export const metadata: Metadata = { title: { absolute: "Early Access terms | LevyTate" }, description: "Conditions for controlled LevyTate Early Access.", alternates: { canonical: "https://www.levytate.co.uk/early-access-terms" } };
export default function Page() { return <PublicTrustPage page={getPublicTrustPage("early-access-terms")} />; }
