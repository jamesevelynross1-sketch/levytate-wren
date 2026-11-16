/** Continue the genuinely enrolled fictional learner; never reset its history. */
import {randomUUID} from "node:crypto";
import {verifyLearningTime} from "./release-learning-time-browser.mjs";
export async function resumeLearner({app,manifest,contexts,backend,check}){
 const employee=contexts.get("a:employee"),lead=contexts.get("a:lead"),applicationId=`browser-${manifest.run}`;
 const rows=await backend(`rest/v1/levytate_learner_records?organisation_id=eq.${employee.tenant.id}&application_id=eq.${applicationId}&select=id,lifecycle_status`);
 check("resume finds exactly the genuinely enrolled retained learner",rows.length===1&&rows[0].lifecycle_status==="enrolled");
 const learnerId=rows[0].id,path=`${app}/api/levytate-learners/${encodeURIComponent(learnerId)}`;
 await verifyLearningTime({app,manifest,contexts,learnerId,backend,check});
 const detail=await lead.context.request.get(path),learner=(await detail.json()).learner;
 check("current Lead reads durable learner before outcome",detail.status()===200&&learner.lifecycleStatus==="enrolled");
 const body={outcome:"withdrawal",idempotencyKey:randomUUID(),expectedActivityVersion:learner.activityVersion,effectiveDate:new Date().toISOString().slice(0,10),reasonCategory:"other",initiatedBy:"learner",notes:"Synthetic agreed withdrawal for end-to-end acceptance",providerNotified:false,employeeNotified:false};
 const post=actor=>actor.context.request.post(`${path}/outcome`,{headers:{Origin:app,"X-LevyTate-Account":actor.user.email,"X-LevyTate-Organisation":actor.tenant.id},data:body});
 check("Employee cannot set official withdrawal outcome",(await post(employee)).status()===403);
 const outcome=await post(lead),saved=await outcome.json();
 check("real Lead terminal outcome commits durable withdrawal",outcome.status()===200&&saved.learner?.lifecycleStatus==="withdrawn");
 check("terminal outcome retry returns committed result",(await post(lead)).status()===200);
 const ended=await backend(`rest/v1/levytate_enrolments?organisation_id=eq.${employee.tenant.id}&application_id=eq.${applicationId}&select=id,status`);
 check("terminal outcome updates corresponding enrolment to Cancelled",ended.length===1&&ended[0].status==="Cancelled");
 check("no fictional notification claimed delivered",saved.learner?.withdrawal?.providerNotified===false&&saved.learner?.withdrawal?.employeeNotified===false);
}
