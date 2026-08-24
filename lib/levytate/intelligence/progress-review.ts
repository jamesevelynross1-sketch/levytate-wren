import type { LearnerProgressUpdate, LearnerReview } from "@/lib/levytate/mvp/learner-lifecycle";
import type { OperationalOwnerType, OperationalPriorityLevel } from "@/lib/levytate/mvp/operations-centre";

export const intelligenceSignalCategories = ["risk", "action", "quality", "pattern", "opportunity"] as const;
export const progressReviewSignalTypes = [
  "repeated_workplace_blocker", "progress_deterioration", "repeated_unresolved_action",
  "manager_support_required", "provider_action_required", "review_progress_inconsistency",
  "repeated_support_requirement", "escalating_pattern", "assessment_or_completion_opportunity",
] as const;
export const intelligenceThemes = ["workplace_opportunity", "manager_support", "provider_action", "learner_engagement", "workload_time", "evidence_collection", "attendance", "technical_capability", "programme_delivery", "support_intervention"] as const;

export type IntelligenceSignalCategory = typeof intelligenceSignalCategories[number];
export type ProgressReviewSignalType = typeof progressReviewSignalTypes[number];
export type IntelligenceTheme = typeof intelligenceThemes[number];
export type IntelligenceEvidenceSourceType = "provider_review" | "manager_check_in" | "l_and_d_check_in" | "progress_update" | "operational_action";
export type IntelligenceEvidence = { sourceType:IntelligenceEvidenceSourceType; sourceId:string; sourceDate:string; label:string; excerpt?:string; metric?:{label:string;value:string|number} };
export type IntelligenceSignalStatus = "new" | "acknowledged" | "accepted" | "dismissed" | "resolved";
export type IntelligenceSignal = {
  id:string; fingerprint:string; organisationId:string; entityType:"learner"|"provider"|"programme"|"organisation"; entityId:string;
  learnerRecordId?:string; providerId?:string; programmeId?:string; category:IntelligenceSignalCategory; signalType:ProgressReviewSignalType;
  title:string; summary:string; evidence:IntelligenceEvidence[]; confidence:"High"|"Medium"|"Low"; priority:Exclude<OperationalPriorityLevel,"Informational">;
  recommendedAction?:string; suggestedOwnerType?:OperationalOwnerType; suggestedDueDate?:string; status:IntelligenceSignalStatus;
  linkedOperationalActionId?:string; detectedAt:string; lastEvaluatedAt:string; resolvedAt?:string; analyserVersion:string; modelIdentifier?:string;
  acknowledgedBy?:string; acknowledgedAt?:string; dismissedBy?:string; dismissedAt?:string; dismissalReason?:IntelligenceDismissalReason;
};
export type IntelligenceDismissalReason = "Already resolved" | "Incorrect interpretation" | "No action required" | "Planned intervention already exists" | "Other";
export type IntelligenceOperationalActionInput = { id:string; title:string; description:string; ownerType:OperationalOwnerType; dueDate:string; sourceKey:string; actionType:"address_progress_exception"; sourceType:"progress_exception"; learnerRecordId:string; priority:Exclude<OperationalPriorityLevel,"Informational"> };
export type AnalysisOperationalAction = { id:string; status:string; title:string; dueDate?:string; sourceDate?:string };
export type ProgressReviewAnalysisInput = { organisationId:string; learnerRecordId:string; providerId?:string; programmeId?:string; learnerLabel?:string; reviews:LearnerReview[]; progressUpdates:LearnerProgressUpdate[]; operationalActions?:AnalysisOperationalAction[]; assessmentReadinessAligned?:boolean; now?:string };
export type ProgressReviewFacts = { providerReviews:LearnerReview[]; latestManagerCheckIn:LearnerReview|null; latestLAndDCheckIn:LearnerReview|null; progressUpdates:LearnerProgressUpdate[]; variances:number[]; varianceTrend:"deteriorating"|"improving"|"stable"|"insufficient"; reviewThemes:Array<{reviewId:string;themes:IntelligenceTheme[]}>; nonTerminalActions:AnalysisOperationalAction[] };

const analyserVersion="progress-review-v1";
const terminalActionStatuses=new Set(["completed","dismissed","cancelled"]);
const themeRules:Record<IntelligenceTheme,RegExp>={
  workplace_opportunity:/workplace (project|opportun)|role exposure|work-based project/i,
  manager_support:/manager (support|action|project|check-in)|line manager|protected learning/i,
  provider_action:/provider (to|must|action|support|update|schedule|confirm)|delivery issue|learning plan/i,
  learner_engagement:/engagement|disengag/i, workload_time:/workload|time allocation|protected time/i,
  evidence_collection:/evidence|portfolio/i, attendance:/attendance|absence/i, technical_capability:/technical (skill|capab)|capability gap/i,
  programme_delivery:/programme delivery|delivery issue|session quality/i, support_intervention:/support required|intervention|additional support/i,
};
const clean=(value:string)=>value.replace(/\s+/g," ").trim();
const bounded=(value:string,max=180)=>{const text=clean(value);return text.length<=max?text:`${text.slice(0,max-1).replace(/\s+\S*$/,"")}…`;};
const sortNewest=<T>(items:T[],date:(item:T)=>string)=>[...items].sort((a,b)=>date(b).localeCompare(date(a)));
export function classifyReviewThemes(text:string){return intelligenceThemes.filter(theme=>themeRules[theme].test(text));}

export function extractProgressReviewFacts(input:ProgressReviewAnalysisInput):ProgressReviewFacts {
  const relevantReviews=input.reviews.filter(review=>review.learnerRecordId===input.learnerRecordId);
  const providerReviews=sortNewest(relevantReviews.filter(review=>review.reviewType==="provider_review"),r=>r.reviewDate).slice(0,4);
  const latest=(type:LearnerReview["reviewType"])=>sortNewest(relevantReviews.filter(review=>review.reviewType===type),r=>r.reviewDate)[0]??null;
  const progressUpdates=sortNewest(input.progressUpdates.filter(update=>update.learnerRecordId===input.learnerRecordId),u=>u.updateDate).slice(0,3);
  const variances=[...progressUpdates].reverse().map(update=>update.variancePercentage);
  const varianceTrend=variances.length<2?"insufficient":variances.every((value,index)=>index===0||value<variances[index-1])?"deteriorating":variances.every((value,index)=>index===0||value>variances[index-1])?"improving":"stable";
  return {providerReviews,latestManagerCheckIn:latest("manager_check_in"),latestLAndDCheckIn:latest("l_and_d_check_in"),progressUpdates,variances,varianceTrend,reviewThemes:providerReviews.map(review=>({reviewId:review.id,themes:classifyReviewThemes(`${review.summary} ${review.supportRequired} ${review.actions.join(" ")}`)})),nonTerminalActions:(input.operationalActions??[]).filter(action=>!terminalActionStatuses.has(action.status))};
}

const reviewEvidence=(review:LearnerReview,label="Provider review"):IntelligenceEvidence=>({sourceType:review.reviewType==="other"?"provider_review":review.reviewType,sourceId:review.id,sourceDate:review.reviewDate,label,excerpt:bounded(`${review.summary}${review.supportRequired?` ${review.supportRequired}`:""}`)});
const progressEvidence=(update:LearnerProgressUpdate):IntelligenceEvidence=>({sourceType:"progress_update",sourceId:update.id,sourceDate:update.updateDate,label:"Recorded progress",metric:{label:"Target / actual / variance",value:`${update.targetProgressPercentage}% / ${update.actualProgressPercentage}% / ${update.variancePercentage}%`}});
const stableHash=(value:string)=>{let left=2166136261,right=2246822519;for(let index=0;index<value.length;index+=1){const code=value.charCodeAt(index);left=Math.imul(left^code,16777619);right=Math.imul(right^code,3266489917);}return `${(left>>>0).toString(16).padStart(8,"0")}${(right>>>0).toString(16).padStart(8,"0")}`;};
const fingerprint=(input:ProgressReviewAnalysisInput,type:ProgressReviewSignalType,condition:string)=>stableHash(`${input.organisationId}:${input.learnerRecordId}:${type}:${condition}`);
function makeSignal(input:ProgressReviewAnalysisInput,values:Omit<IntelligenceSignal,"id"|"fingerprint"|"organisationId"|"entityType"|"entityId"|"learnerRecordId"|"providerId"|"programmeId"|"status"|"detectedAt"|"lastEvaluatedAt"|"analyserVersion"> & {condition:string}):IntelligenceSignal {
  const now=input.now??new Date().toISOString(); const key=fingerprint(input,values.signalType,values.condition);
  const {condition:_,...signal}=values; void _;
  if(!signal.evidence.length)throw new Error("Intelligence Signals require evidence.");
  return {...signal,id:`signal-${key.slice(0,20)}`,fingerprint:key,organisationId:input.organisationId,entityType:"learner",entityId:input.learnerRecordId,learnerRecordId:input.learnerRecordId,providerId:input.providerId,programmeId:input.programmeId,status:"new",detectedAt:now,lastEvaluatedAt:now,analyserVersion};
}

export function analyseProgressReviewIntelligence(input:ProgressReviewAnalysisInput){
  const facts=extractProgressReviewFacts(input); const signals:IntelligenceSignal[]=[];
  const reviewsByTheme=(theme:IntelligenceTheme)=>facts.providerReviews.filter(review=>classifyReviewThemes(`${review.summary} ${review.supportRequired} ${review.actions.join(" ")}`).includes(theme));
  const workplace=reviewsByTheme("workplace_opportunity"); const deterioration=facts.varianceTrend==="deteriorating"&&facts.variances.at(-1)!<=-5;
  if(workplace.length>=2)signals.push(makeSignal(input,{condition:"workplace_opportunity",signalType:"repeated_workplace_blocker",category:deterioration?"risk":"pattern",title:"Repeated workplace blocker detected",summary:`Workplace opportunity has remained unresolved across ${workplace.length} provider reviews${deterioration?" while recorded progress variance has deteriorated":""}.`,evidence:[...workplace.slice(0,3).map(review=>reviewEvidence(review)),...facts.progressUpdates.slice(0,deterioration?3:0).map(progressEvidence)],confidence:"High",priority:deterioration?"High":"Medium",recommendedAction:"Review workplace project availability with the learner and line manager.",suggestedOwnerType:"Shared"}));
  if(deterioration)signals.push(makeSignal(input,{condition:"variance_deteriorating",signalType:"progress_deterioration",category:"risk",title:"Recorded progress is deteriorating",summary:`Progress variance moved ${facts.variances.join(" → ")} percentage points across the available updates. Review evidence should be considered alongside this trend; it does not establish causation.`,evidence:facts.progressUpdates.map(progressEvidence),confidence:facts.progressUpdates.length===3?"High":"Medium",priority:facts.variances.at(-1)!<=-12?"High":"Medium",recommendedAction:"Review the progress trend and agree a proportionate recovery plan.",suggestedOwnerType:"Apprenticeship Lead"}));
  const latest=facts.providerReviews[0]; const latestProgress=facts.progressUpdates[0];
  if(latest&&latestProgress&&/on track|progressing well|good progress/i.test(latest.summary)&&latestProgress.variancePercentage<=-10)signals.push(makeSignal(input,{condition:"positive_narrative_negative_metric",signalType:"review_progress_inconsistency",category:"quality",title:"Review narrative and progress appear inconsistent",summary:"The latest provider review is positive while the recorded progress position is materially below target.",evidence:[reviewEvidence(latest),progressEvidence(latestProgress)],confidence:"High",priority:"High",recommendedAction:"Check the provider progress data and review narrative before the next governance review.",suggestedOwnerType:"Shared"}));
  const repeatedActions=new Map<string,LearnerReview[]>();
  for(const review of facts.providerReviews)for(const action of review.actions){const themes=classifyReviewThemes(action);const key=themes[0]??clean(action).toLowerCase().replace(/\b(the|a|an|to|and)\b/g,"").replace(/\s+/g," ").slice(0,80);if(!key)continue;repeatedActions.set(key,[...(repeatedActions.get(key)??[]),review]);}
  const repeated=[...repeatedActions].find(([,reviews])=>new Set(reviews.map(review=>review.id)).size>=2);
  if(repeated){const [key,reviews]=repeated;signals.push(makeSignal(input,{condition:`action:${key}`,signalType:"repeated_unresolved_action",category:"action",title:"Review action appears unresolved",summary:`Essentially the same action appears across ${new Set(reviews.map(review=>review.id)).size} consecutive provider reviews.`,evidence:[...new Map(reviews.map(review=>[review.id,reviewEvidence(review)])).values()].slice(0,3),confidence:"High",priority:"High",recommendedAction:"Confirm ownership and resolution evidence before the next review.",suggestedOwnerType:key.includes("provider")?"Provider":key.includes("manager")||key.includes("workplace")?"Line Manager":"Shared"}));}
  const manager=reviewsByTheme("manager_support"); if(manager.length>=2)signals.push(makeSignal(input,{condition:"manager_support",signalType:"manager_support_required",category:"action",title:"Manager support is repeatedly required",summary:"Review evidence repeatedly identifies a manager-owned support requirement.",evidence:manager.slice(0,3).map(review=>reviewEvidence(review)),confidence:"High",priority:"High",recommendedAction:"Agree the workplace support and accountable owner with the line manager.",suggestedOwnerType:"Line Manager"}));
  const provider=reviewsByTheme("provider_action"); if(provider.length>=2)signals.push(makeSignal(input,{condition:"provider_action",signalType:"provider_action_required",category:"action",title:"Provider action remains outstanding",summary:"Provider-owned activity is repeated in consecutive review evidence.",evidence:provider.slice(0,3).map(review=>reviewEvidence(review)),confidence:"High",priority:"High",recommendedAction:"Review the outstanding requirement with the provider before the next governance meeting.",suggestedOwnerType:"Shared"}));
  const support=reviewsByTheme("support_intervention"); if(support.length>=2)signals.push(makeSignal(input,{condition:"support_intervention",signalType:"repeated_support_requirement",category:"pattern",title:"Support requirement is recurring",summary:"A support or intervention requirement appears across consecutive provider reviews.",evidence:support.slice(0,3).map(review=>reviewEvidence(review)),confidence:"High",priority:"Medium",recommendedAction:"Review whether the current support plan has an accountable owner and remains sufficient.",suggestedOwnerType:"Shared"}));
  if(deterioration&&workplace.length>=2)signals.push(makeSignal(input,{condition:"workplace_and_variance",signalType:"escalating_pattern",category:"pattern",title:"Risk pattern is escalating",summary:"Repeated workplace evidence appears alongside a deteriorating recorded progress position. This is an association for human review, not a claim of causation.",evidence:[...workplace.slice(0,2).map(review=>reviewEvidence(review)),...facts.progressUpdates.map(progressEvidence)],confidence:"High",priority:"High",recommendedAction:"Hold a focused learner, manager and provider review.",suggestedOwnerType:"Shared"}));
  if(latestProgress&&latestProgress.variancePercentage>=5&&(input.assessmentReadinessAligned||/assessment ready|gateway ready|ready for assessment|completion ready/i.test(latest?.summary??"")))signals.push(makeSignal(input,{condition:"assessment_readiness",signalType:"assessment_or_completion_opportunity",category:"opportunity",title:"Review assessment-readiness timing",summary:"Recorded progress is ahead of target and the latest review evidence aligns with assessment readiness.",evidence:[progressEvidence(latestProgress),...(latest?[reviewEvidence(latest)]:[])],confidence:"High",priority:"Low",recommendedAction:"Review whether the current assessment-readiness timetable remains appropriate.",suggestedOwnerType:"Apprenticeship Lead"}));
  return {facts,signals};
}

export function reconcileIntelligenceSignals(existing:IntelligenceSignal[],current:IntelligenceSignal[],now=new Date().toISOString()){
  const currentByFingerprint=new Map(current.map(signal=>[signal.fingerprint,signal])); const result:IntelligenceSignal[]=[];
  for(const signal of current){const prior=existing.find(item=>item.fingerprint===signal.fingerprint&&!item.resolvedAt);if(prior?.status==="dismissed"){result.push({...prior,lastEvaluatedAt:now});continue;}result.push(prior?{...signal,id:prior.id,status:prior.status,detectedAt:prior.detectedAt,lastEvaluatedAt:now,linkedOperationalActionId:prior.linkedOperationalActionId}:{...signal,lastEvaluatedAt:now});}
  for(const prior of existing)if(!currentByFingerprint.has(prior.fingerprint)&&prior.status!=="resolved")result.push({...prior,status:"resolved",resolvedAt:now,lastEvaluatedAt:now});
  return result;
}
export function acceptSignalAsOperationalAction(signal:IntelligenceSignal,overrides:Partial<Pick<IntelligenceOperationalActionInput,"title"|"description"|"ownerType"|"dueDate">>={}):IntelligenceOperationalActionInput {
  if(signal.confidence==="Low")throw new Error("Low-confidence signals cannot create operational actions.");
  if(!signal.learnerRecordId)throw new Error("A learner-linked signal is required.");
  return {id:`action-${signal.id}`,title:overrides.title??signal.title,description:overrides.description??signal.recommendedAction??signal.summary,ownerType:overrides.ownerType??signal.suggestedOwnerType??"Apprenticeship Lead",dueDate:overrides.dueDate??signal.suggestedDueDate??"",sourceKey:`intelligence:${signal.fingerprint}`,actionType:"address_progress_exception",sourceType:"progress_exception",learnerRecordId:signal.learnerRecordId,priority:signal.priority};
}
export function validateStructuredAnalysis(value:unknown,validEvidenceIds:Set<string>){
  if(!value||typeof value!=="object"||!Array.isArray((value as {signals?:unknown}).signals))throw new Error("Malformed Intelligence analysis JSON.");
  for(const signal of (value as {signals:Array<{signalType?:string;evidenceSourceIds?:unknown}>}).signals){if(!progressReviewSignalTypes.includes(signal.signalType as ProgressReviewSignalType))throw new Error("Unsupported Intelligence signal type.");if(!Array.isArray(signal.evidenceSourceIds)||!signal.evidenceSourceIds.length||signal.evidenceSourceIds.some(id=>typeof id!=="string"||!validEvidenceIds.has(id)))throw new Error("Intelligence analysis referenced invalid evidence.");}
  return value;
}
