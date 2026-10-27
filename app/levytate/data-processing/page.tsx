import type { Metadata } from "next";
import { levyTateWebsiteUrl } from "@/lib/levytate/hosts";
import { PublicTrustPage } from "@/components/levytate-public/PublicTrustPage";
import { getPublicTrustPage } from "@/lib/levytate/public-trust-content";

export const metadata: Metadata = { title: { absolute: "Data processing | LevyTate" }, description: "How service data is processed in LevyTate.", alternates: { canonical: levyTateWebsiteUrl("/data-processing") } };
export default function Page() { return <PublicTrustPage page={getPublicTrustPage("data-processing")} />; }
