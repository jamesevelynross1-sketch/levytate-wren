import { isIP } from "node:net";
import type { ProviderIntelligenceSource } from "./domain.ts";

const blockedNames = new Set(["localhost", "metadata.google.internal"]);
export function isApprovedProviderUrl(value:string, source:ProviderIntelligenceSource) {
  try {
    const url=new URL(value);
    if(url.protocol!=="https:") return false;
    const host=url.hostname.toLowerCase();
    if(blockedNames.has(host)||isIP(host)!==0||host.endsWith(".local")) return false;
    return host===source.providerDomain||host.endsWith(`.${source.providerDomain}`);
  } catch { return false; }
}
export function assertApprovedProviderUrl(value:string, source:ProviderIntelligenceSource){ if(!isApprovedProviderUrl(value,source)) throw new Error("Provider source URL is not approved"); }
