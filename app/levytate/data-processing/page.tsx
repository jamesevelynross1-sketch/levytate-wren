import type { Metadata } from "next";
import { PublicTrustPage } from "@/components/levytate-public/PublicTrustPage";
import { getPublicTrustPage } from "@/lib/levytate/public-trust-content";

export const metadata: Metadata = { title: { absolute: "Data processing | LevyTate" }, description: "How service data is processed in LevyTate.", alternates: { canonical: "https://www.levytate.co.uk/data-processing" } };
export default function Page() { return <PublicTrustPage page={getPublicTrustPage("data-processing")} />; }
