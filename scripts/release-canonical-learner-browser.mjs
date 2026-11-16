/** One genuine Lead context, existing enrolled learner, read-only navigation. */
import { localUrl } from './release-local-fixtures.mjs';
import { matchesCanonicalEnrolment } from './release-operations-intelligence-browser.mjs';
export async function verifyCanonicalLearnerNavigation({app:origin,manifest,lead,backend,learnerId,check}) {
 const app=localUrl(origin,'canonical learner app');let stage='scope preflight';
 const report=(name,ok)=>{check(`Canonical learner: ${name}`,Boolean(ok));if(!ok)throw Error('Canonical learner check failed');};
 try{
  if(!manifest.synthetic||manifest.environment!=='local'||lead?.user.role!=='Apprenticeship Lead'||!lead.context||!lead.page||!/^learner-[a-f0-9-]{36}$/.test(learnerId??''))throw Error('Existing fictional learner and genuine Lead required');
  const tenant=manifest.tenants.find(item=>item.key==='a'),member=tenant?.users.find(item=>item.key==='lead');
  if(tenant?.id!==lead.tenant.id||member?.membershipId!==lead.user.membershipId||member.email!==lead.user.email)throw Error('Canonical Lead identity mismatch');
  const headers={Origin:app,'X-LevyTate-Account':lead.user.email,'X-LevyTate-Organisation':tenant.id},page=lead.page;
  const read=async()=>{const response=await lead.context.request.get(`${app}/api/levytate-learners/${learnerId}`,{headers});report('actual current-tenant learner read succeeds',response.status()===200);return(await response.json()).learner;};
  const detail=await read(),applicationId=detail?.programme?.applicationReference;
  if(applicationId!==`browser-${manifest.run}`||detail?.learnerRecordId!==learnerId)throw Error('Exact original current-run application required');
  const select=(table,columns,filter='')=>backend(`rest/v1/${table}?organisation_id=eq.${tenant.id}&select=${columns}${filter}&order=${columns}`);
  const rows=await select('levytate_learner_records','id,organisation_id,application_id,mutation_revision,lifecycle_status',`&application_id=eq.${encodeURIComponent(applicationId)}`),applications=await select('levytate_applications','id,organisation_id,employee_id,status',`&id=eq.${encodeURIComponent(applicationId)}`);
  report('one exact application and enrolled learner retain canonical ownership',matchesCanonicalEnrolment(detail,learnerId,applications,rows,tenant.id));
  const snapshot=()=>Promise.all([
   select('levytate_learner_records','id,mutation_revision,lifecycle_status'),select('levytate_applications','id,status'),select('levytate_learner_command_receipts','request_id,actor_user_id'),select('levytate_learner_lifecycle_events','id'),select('levytate_operational_actions','id,status,version'),select('levytate_operational_action_receipts','action_id,expected_version,actor_user_id'),select('levytate_intelligence_command_receipts','request_id,actor_user_id'),select('levytate_audit_events','id'),
  ]);
  const before=await snapshot(),url=`${app}/levytate/app?module=Learners&learner=${encodeURIComponent(learnerId)}`;
  const heading=()=>page.getByRole('heading',{name:detail.learner.name,exact:true,level:2});
  stage='open existing canonical application';await page.goto(`${app}/levytate/app?module=Applications&application=${encodeURIComponent(applicationId)}`);
  const modal=page.getByRole('dialog').filter({has:page.getByRole('region',{name:'Enrolment handoff',exact:true})}),link=modal.getByRole('link',{name:'Open learner record',exact:true});await link.waitFor();
  report('existing learner link is exact and duplicate handoff is unavailable',await link.getAttribute('href')===`/levytate/app?module=Learners&learner=${encodeURIComponent(learnerId)}`&&await modal.getByRole('button',{name:'Start pre-enrolment',exact:true}).count()===0);
  stage='click canonical learner link';await link.click();stage='wait for actual learner detail';await heading().waitFor();
  report('canonical link opens the actual learner on the same origin',new URL(page.url()).origin===app&&new URL(page.url()).searchParams.get('learner')===learnerId);
  stage='reload learner detail';await page.reload();await heading().waitFor();report('normal reload preserves exact learner detail',true);
  stage='return to list';await page.getByRole('button',{name:'Back to learners',exact:true}).click();await page.getByTestId('learner-row').waitFor();report('explicit Back removes the selected learner from the URL',!new URL(page.url()).searchParams.has('learner'));
  await page.reload();await page.getByTestId('learner-row').waitFor();report('list reload does not reopen stale learner detail',await heading().count()===0);
  stage='direct learner URL';await page.goto(url);await heading().waitFor();report('direct canonical URL resolves the same learner',true);
  const after=await read();report('read-only navigation preserves learner revision and all command/audit records',after.activityVersion===detail.activityVersion&&JSON.stringify(before)===JSON.stringify(await snapshot()));
 }catch(cause){const error=new Error('Canonical learner navigation stopped safely');error.safeStage=stage;error.safeErrorClass=['TimeoutError','TypeError'].includes(cause?.name)?cause.name:'Error';throw error;}
}
