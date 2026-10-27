import type { Metadata } from "next";
import { levyTateWebsiteUrl } from "@/lib/levytate/hosts";
import { PublicTrustPage } from "@/components/levytate-public/PublicTrustPage";
import { getPublicTrustPage } from "@/lib/levytate/public-trust-content";

export const metadata: Metadata = { title: { absolute: "Data rights | LevyTate" }, description: "Raise a request about personal information in LevyTate.", alternates: { canonical: levyTateWebsiteUrl("/data-rights") } };
export default function Page() { return <PublicTrustPage page={getPublicTrustPage("data-rights")} />; }
