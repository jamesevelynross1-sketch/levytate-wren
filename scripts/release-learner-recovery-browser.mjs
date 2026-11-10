/** Real local Lead progress-entry recovery on the newly enrolled own Manager.
 * Does not sign in, alter fixture state or activate assessment/pastoral services.
 */
import{randomUUID}from'node:crypto';
import{localUrl}from'./release-local-fixtures.mjs';
export async function verifyLearnerRecovery({app:origin,manifest,contexts,learnerId,backend,check}){
 const app=localUrl(origin,'Learner recovery app'),lead=contexts.get('a:lead'),manager=contexts.get('a:manager'),other=contexts.get('b:employee');
 if(!manifest.synthetic||manifest.environment!=='local'||lead?.user.role!=='Apprenticeship Lead'||manager?.user.role!=='Line Manager'||lead.tenant.id!==manager.tenant.id||lead.tenant.id===other?.tenant.id||!/^learner-[a-f0-9-]{36}$/.test(learnerId))throw Error('Exact local genuine learner contexts required');
 const report=(name,ok)=>check(`Learner recovery: ${name}`,Boolean(ok)),headers={Origin:app,'X-LevyTate-Account':lead.user.email,'X-LevyTate-Organisation':lead.tenant.id},endpoint=`/api/levytate-learners/${learnerId}/progress`,url=`${app}${endpoint}`,page=lead.page;
 const read=async()=>{const r=await lead.context.request.get(`${app}/api/levytate-learners/${learnerId}`,{headers});report('Lead reads exact current enrolled Manager learner',r.status()===200);const d=(await r.json()).learner;report('current employee and lifecycle match the real enrolment',d?.learnerRecordId===learnerId&&d.learner.id===manager.user.personId&&d.lifecycleStatus==='enrolled');return d;};
 const snapshot=async()=>{const[records,progress,events,receipts,audit]=await Promise.all([
  backend(`rest/v1/levytate_learner_records?organisation_id=eq.${lead.tenant.id}&id=eq.${learnerId}&select=id,mutation_revision,lifecycle_status`),
  backend(`rest/v1/levytate_learner_progress_updates?organisation_id=eq.${lead.tenant.id}&learner_record_id=eq.${learnerId}&select=id,summary,target_progress_percentage,actual_progress_percentage,updated_by&order=id`),
  backend(`rest/v1/levytate_learner_lifecycle_events?organisation_id=eq.${lead.tenant.id}&learner_record_id=eq.${learnerId}&select=id,event_type&order=id`),
  backend(`rest/v1/levytate_learner_command_receipts?organisation_id=eq.${lead.tenant.id}&learner_record_id=eq.${learnerId}&select=request_id,actor_user_id&order=request_id`),
  backend(`rest/v1/levytate_audit_events?organisation_id=eq.${lead.tenant.id}&entity_type=eq.learner&entity_id=eq.${learnerId}&select=id,action&order=id`),
 ]);return{records,progress,events,receipts,audit};};
 const otherRows=()=>backend(`rest/v1/levytate_learner_records?organisation_id=eq.${other.tenant.id}&select=id,mutation_revision&order=id`),otherBefore=await otherRows(),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const detail=await read();
 for(const actor of[manager,other]){const denied=await actor.context.request.post(url,{headers:{Origin:app,'X-LevyTate-Account':actor.user.email,'X-LevyTate-Organisation':actor.tenant.id},data:{expectedActivityVersion:detail.activityVersion,idempotencyKey:randomUUID(),updateDate:new Date().toISOString().slice(0,10),targetProgressPercentage:5,actualProgressPercentage:5,progressSource:'provider_report',sourceReference:'Fictional forbidden update',summary:'Fictional forbidden update',supportAction:'No support required'}});report(`${actor.user.role} in ${actor.tenant.key} cannot create official progress`,denied.status()===403);}
 await page.goto(`${app}/levytate/app?module=Learners`);
 const row=page.getByTestId('learner-row').filter({has:page.getByText(detail.learner.name,{exact:true})});await row.getByTestId('learner-open-record').click();
 for(const fault of['lost','malformed']){
  const before=await snapshot(),summary=`Fictional progress recovery ${fault} ${randomUUID()}`;
  await page.getByRole('button',{name:'Add progress update',exact:true}).click();
  const form=page.getByRole('dialog',{name:'Add progress update',exact:true}),field=form.getByLabel('Progress summary',{exact:true}),recovery=page.getByRole('dialog',{name:'Update awaiting confirmation',exact:true});
  await form.getByLabel('Update date',{exact:true}).fill(new Date().toISOString().slice(0,10));
  await form.getByRole('combobox',{name:'Progress source',exact:true}).selectOption('provider_report');
  await form.getByLabel('Target progress percentage',{exact:true}).fill('5');await form.getByLabel('Actual progress percentage',{exact:true}).fill('5');
  await form.getByLabel('Source reference',{exact:true}).fill('Synthetic acceptance report; no actual provider delivery');await field.fill(summary);
  let intercepted=false,failed=false,command,release,mark;const held=new Promise(resolve=>{release=resolve;}),committed=new Promise(resolve=>{mark=resolve;});
  const intercept=async route=>{if(intercepted||route.request().method()!=='POST'){await route.continue();return;}intercepted=true;command=route.request().postData();try{const input=route.request().postDataJSON(),pins=route.request().headers();if(input.summary!==summary||pins['x-levytate-account']!==lead.user.email||pins['x-levytate-organisation']!==lead.tenant.id)throw Error('Unexpected owned command');const r=await route.fetch(),body=await r.json();if(r.status()!==200||body.learner?.learnerRecordId!==learnerId||!body.learner.progressHistory.some(item=>item.summary===summary))throw Error('Real progress did not commit');mark();await held;if(fault==='lost')await route.abort();else{body.learner.progressHistory=null;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});}}catch{failed=true;mark();try{await route.abort();}catch{}}};
  await page.route(url,intercept);
  try{
   await form.getByRole('button',{name:'Record progress update',exact:true}).click();let timeout;try{await Promise.race([committed,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Progress commit observation timed out')),30000);})]);}finally{clearTimeout(timeout);}
   report(`${fault}: actual progress commits before response delivery`,intercepted&&!failed);
   report(`${fault}: in-flight form retains and freezes original summary`,await field.inputValue()===summary&&await field.isDisabled());
   const durable=await snapshot(),added=durable.progress.filter(item=>item.summary===summary);
   report(`${fault}: exactly one progress, event, receipt, audit and revision committed`,added.length===1&&added[0].updated_by===lead.user.email&&durable.progress.length===before.progress.length+1&&durable.events.length===before.events.length+1&&durable.receipts.length===before.receipts.length+1&&durable.audit.length===before.audit.length+1&&durable.records[0].mutation_revision===before.records[0].mutation_revision+1);
   release();await recovery.waitFor();report(`${fault}: uncertain nested form stays mounted and locked`,await field.inputValue()===summary&&await field.isDisabled());
   const retried=page.waitForResponse(r=>new URL(r.url()).pathname===endpoint&&r.request().method()==='POST');await recovery.getByRole('button',{name:'Retry original update',exact:true}).click();const r=await retried,pins=r.request().headers();
   report(`${fault}: visible retry preserves exact command and original account`,r.status()===200&&r.request().postData()===command&&pins['x-levytate-account']===lead.user.email&&pins['x-levytate-organisation']===lead.tenant.id);
   await form.waitFor({state:'hidden'});report(`${fault}: receipt retry leaves durable evidence unchanged`,same(durable,await snapshot()));
   report(`${fault}: fresh service read retains the recorded progress`,(await read()).progressHistory.some(item=>item.summary===summary));
  }finally{release();await page.unroute(url,intercept);}
 }
 await page.reload();const current=await read();report('both fictional progress entries survive a browser reload',current.progressHistory.filter(item=>item.summary.startsWith('Fictional progress recovery ')).length===2);
 report('other employer learner records stay unchanged',same(otherBefore,await otherRows()));
 return{newSignIns:0,progressEntriesAdded:2,assessmentActivation:false};
}
