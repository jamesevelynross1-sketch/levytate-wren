/** Render actual components/current fictional data. No browser Auth or workflow claim. */
import React from 'react';import{renderToStaticMarkup}from'react-dom/server';import{readFileSync,writeFileSync}from'node:fs';import{pathToFileURL}from'node:url';import{spawnSync}from'node:child_process';
async function main(){
 const root=process.env.RELEASE_LOCAL_RUNTIME,repo=process.env.RELEASE_PRESENTATION_REPO;
 if(!root?.startsWith('/private/tmp/levytate-release-runtime.')||repo!=='/Users/jamesross/Documents/levytate-wren/engineering-worktrees/lg-01')throw Error('Reviewed local paths required');
 Object.assign(globalThis,{React});
 const data=JSON.parse(readFileSync(`${root}/presentation-current-data.json`,'utf8'));
 const {EmployerExecutiveReport}=await import(pathToFileURL(`${repo}/components/levytate-mvp/EmployerExecutiveReport.tsx`).href),{MvpWorkspaceProvider}=await import(pathToFileURL(`${repo}/components/levytate-mvp/MvpWorkspaceStore.tsx`).href),{EmployeeHomeModule}=await import(pathToFileURL(`${repo}/components/levytate-mvp/EmployeeExperienceModule.tsx`).href);
 const {chromium}=await import(pathToFileURL(process.env.RELEASE_PLAYWRIGHT_MODULE!).href),browser=await chromium.launch({headless:true});
 const oldCss=spawnSync('git',['show','d2457ca:app/globals.css'],{cwd:repo,encoding:'utf8'});if(oldCss.status)throw Error('Historical print CSS unavailable');
 const css=readFileSync(`${repo}/app/globals.css`,'utf8'),evidence=[]; const cssCommit=spawnSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim();let modeVisibility=true;
 try{const page=await browser.newPage({viewport:{width:1280,height:900}});await page.route('**/*',(r:{abort():Promise<void>})=>r.abort());
 for(const kind of ['employee','employer'])for(const version of ['before','after']){
  const markup=kind==='employer'?renderToStaticMarkup(<EmployerExecutiveReport report={data.report}/>):renderToStaticMarkup(<MvpWorkspaceProvider initialWorkspace={data.employee}><div className="levytate-workspace"><div><EmployeeHomeModule onNavigate={()=>{}}/></div></div></MvpWorkspaceProvider>);
  await page.setContent(`<!doctype html><html><head><style>${version==='before'?oldCss.stdout:css}</style></head><body class="${kind==='employer'?'employer-intelligence-printing':''}">${markup}</body></html>`);
  await page.emulateMedia({media:'print'});
  const file=`${root}/standalone-${kind}-print-${version}.pdf`;await page.pdf({path:file,format:'A4',printBackground:true});
  const tool='/Users/jamesross/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/poppler/bin/';
  const text=spawnSync(`${tool}pdftotext`,[file,'-'],{encoding:'utf8'});if(text.status!==0||typeof text.stdout!=='string')throw Error('PDF text extraction failed');
  const pages=text.stdout.split('\f').filter(v=>v.trim()),characters=pages.map(v=>v.trim().length);
  evidence.push({kind,version,path:file,pages:pages.length,characters,hasExpectedText:kind==='employer'?text.stdout.includes('Executive operating brief')&&text.stdout.includes('715'):text.stdout.includes('Your next step')&&text.stdout.includes('Good to see you')});
 }
 for(const [mode,selector]of [['assessment-report-printing','assessment-campaign-report'],['employer-intelligence-printing','employer-intelligence-report'],['','opportunity-review-report']]){await page.setContent(`<html><head><style>${css}</style></head><body class="${mode}"><article class="${selector}"><h1>Scope visibility probe</h1></article><p class="outside">Hidden outside report</p></body></html>`);const visible=await page.evaluate(()=>{const h=document.querySelector('h1')!,outside=document.querySelector('.outside')!;return getComputedStyle(h).visibility==='visible'&&getComputedStyle(outside).visibility==='hidden';});modeVisibility&&=visible;}
 }finally{await browser.close();}
 const employeeOld=evidence.find(x=>x.kind==='employee'&&x.version==='before')!,employeeNew=evidence.find(x=>x.kind==='employee'&&x.version==='after')!,reportNew=evidence.find(x=>x.kind==='employer'&&x.version==='after')!;
 const result={kind:'standalone-component-and-css-presentation-not-auth-proof',dataCommit:data.commit,cssCommit,checks:{modeVisibility,oldBlankReproduced:employeeOld.pages===0,employeeTextVisible:employeeNew.hasExpectedText&&employeeNew.characters.every(x=>x>80),employerEvidenceVisible:reportNew.hasExpectedText&&reportNew.characters.every(x=>x>80)},artifacts:evidence};writeFileSync(`${root}/standalone-print-evidence.json`,JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify(result));if(Object.values(result.checks).some(v=>!v))process.exitCode=1;
}
void main().catch(error=>{console.error(`Standalone presentation failed: ${error instanceof Error?error.name:'unknown'}`);process.exitCode=1});
