import { NextResponse } from "next/server";
import { progressReviewDemoScenarios } from "@/lib/levytate/intelligence/demo-progress-review";
import { analyseProgressReviewIntelligence } from "@/lib/levytate/intelligence/progress-review";
import { readRuntimeEnv } from "@/lib/server/levytate-supabase";

function authorised(request:Request){const expected=readRuntimeEnv("LEVYTATE_INTELLIGENCE_ANALYSIS_SECRET")||readRuntimeEnv("CRON_SECRET");return Boolean(expected&&request.headers.get("authorization")===`Bearer ${expected}`);}
export async function POST(request:Request){
  if(!authorised(request))return NextResponse.json({message:"Unauthorised."},{status:401});
  const body=await request.json().catch(()=>({})) as {learnerRecordId?:string};
  const eligible=body.learnerRecordId?progressReviewDemoScenarios.filter(input=>input.learnerRecordId===body.learnerRecordId):progressReviewDemoScenarios;
  if(body.learnerRecordId&&!eligible.length)return NextResponse.json({message:"Learner is outside the isolated Preview validation set."},{status:404});
  const signals=eligible.flatMap(input=>analyseProgressReviewIntelligence(input).signals);
  return NextResponse.json({ok:true,mode:"deterministic_preview",persisted:false,learnersAnalysed:eligible.length,signals});
}
