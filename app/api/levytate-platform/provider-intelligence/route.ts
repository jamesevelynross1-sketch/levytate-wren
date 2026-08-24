import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { levytateBetaSessionCookie } from "@/lib/levytate/config/beta-access";
import { readAuthorisedLevyTateBetaSession } from "@/lib/server/levytate-authorised-session";
import { getProviderIntelligence } from "@/lib/server/levytate-provider-intelligence";
export async function GET(){const store=await cookies();const session=await readAuthorisedLevyTateBetaSession(store.get(levytateBetaSessionCookie)?.value);if(!session||session.accessLevel!=="beta_admin")return NextResponse.json({message:"Forbidden."},{status:403});const payload=await getProviderIntelligence();return NextResponse.json({sources:payload.sources.map(source=>{const articles=payload.articles.filter(article=>article.sourceId===source.id);return{id:source.id,providerId:source.providerId,label:source.label,status:source.status,lastAttemptAt:source.lastAttemptAt??null,lastSuccessfulFetchAt:source.lastSuccessfulFetchAt??null,lastError:source.lastError??null,articleCount:articles.length,latestArticleAt:articles.map(article=>article.publishedAt).filter(Boolean).sort().at(-1)??null};})});}
