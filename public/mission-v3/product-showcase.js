/* View-only public illustrations. Nothing is transmitted, stored or applied to an employer account. */
(() => {
  'use strict';
  const root = document.querySelector('.product-showcase');
  if (!root) return;
  const one = (s, r = document) => r.querySelector(s);
  const all = (s, r = document) => [...r.querySelectorAll(s)];
  const cash = n => new Intl.NumberFormat('en-GB', {style:'currency',currency:'GBP',maximumFractionDigits:0}).format(n);
  const announce = document.createElement('p');
  announce.className = 'ps-sr-status'; announce.setAttribute('role','status'); root.append(announce);
  let announcement;
  function say(text) { clearTimeout(announcement); announcement=setTimeout(()=>{announce.textContent=text;},180); }
  all('[data-scene-group]').forEach(group => {
    all('[data-scene]',group).forEach(button => button.addEventListener('click',()=>{
      all('[data-scene]',group).forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      all('[data-scene-panel]',group).forEach(p=>{p.hidden=p.dataset.scenePanel!==button.dataset.scene;});
      say(button.textContent+' illustration selected.');
    }));
  });
  const selected = new Set(['engineering','finance']);
  function syncPortfolio() {
    all('[data-select-course]').forEach(b=>{
      const active=selected.has(b.dataset.selectCourse);b.setAttribute('aria-pressed',String(active));b.textContent=active?'Selected ✓':'Select +';
      const name=one('h4',b.closest('[data-course]')).textContent;
      b.setAttribute('aria-label',(active?'Remove ':'Select ')+name+' in this example');
    });
    all('[data-selected-count]').forEach(n=>{n.textContent=selected.size;});
    all('[data-portfolio-course]').forEach(row=>{row.hidden=!selected.has(row.dataset.portfolioCourse);});
    const empty=one('[data-portfolio-empty]');if(empty)empty.hidden=selected.size>0;
  }
  all('[data-select-course]').forEach(b=>b.addEventListener('click',()=>{
    const id=b.dataset.selectCourse;selected.has(id)?selected.delete(id):selected.add(id);syncPortfolio();say(selected.size+' programmes selected in the illustration. No account has changed.');
  }));
  function filterCourses(){
    const text=(one('[data-programme-search]')?.value||'').trim().toLowerCase();const area=one('[data-programme-filter]')?.value||'all';let count=0;
    all('[data-course]').forEach(card=>{card.hidden=!(card.dataset.search.includes(text)&&(area==='all'||card.dataset.course===area));if(!card.hidden)count++;});
    const empty=one('[data-search-empty]');if(empty)empty.hidden=count!==0;say(count+' example programmes shown.');
  }
  one('[data-programme-search]')?.addEventListener('input',filterCourses);one('[data-programme-filter]')?.addEventListener('change',filterCourses);
  const departments={all:[42,7,28500,'All departments'],engineering:[24,3,14700,'Engineering'],finance:[8,2,8100,'Finance'],people:[10,2,5700,'People']};
  one('[data-report-department]')?.addEventListener('change',e=>{
    const d=departments[e.target.value]||departments.all;['learners','decisions','report-spend'].forEach((key,i)=>{one('[data-metric="'+key+'"]').textContent=i===2?cash(d[i]):d[i];});
    all('.ps-department-rows>div').forEach((row,i)=>{row.hidden=e.target.value!=='all'&&['engineering','finance','people'][i]!==e.target.value;});say(d[3]+' report selected.');
  });
  const dialog=one('#ps-report-dialog');let reportTrigger;
  one('[data-open-report]')?.addEventListener('click',e=>{
    if(!dialog)return;reportTrigger=e.currentTarget;const key=one('[data-report-department]').value;const d=departments[key]||departments.all;
    one('[data-print-scope]',dialog).textContent=d[3]+' · Jul–Sep 2026';
    const copy=one('[data-report-copy]',dialog);copy.replaceChildren();
    [['Active learners',d[0]],['Awaiting decisions',d[1]],['Imported spending',cash(d[2])]].forEach(([label,value])=>{const div=document.createElement('div');div.className='ps-metric';const span=document.createElement('span'),strong=document.createElement('strong');span.textContent=label;strong.textContent=value;div.append(span,strong);copy.append(div);});
    dialog.showModal();one('[data-close-dialog]',dialog).focus();
  });
  all('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>dialog?.close()));dialog?.addEventListener('close',()=>reportTrigger?.focus());
  const stages={request:{status:'Draft request',heading:'Start with the role and the learning need.',copy:'The employee explains the development goal and selects an employer-published programme. One active application keeps the route clear.',owner:'Employee',checks:['Development goal recorded','Employer programme selected','Submit for manager review'],audit:'Draft preparation'},manager:{status:'Manager review',heading:'Is the workplace ready to support this?',copy:'Review the role fit, learning time and practical support before passing the application to the apprenticeship lead.',owner:'Line manager',checks:['Development need recorded','Programme selected','Manager decision required'],audit:'Request submitted'},lead:{status:'Final approval',heading:'Record the employer’s final decision.',copy:'The apprenticeship lead reviews the request and supporting information. A decision stays with its owner and the application history.',owner:'Apprenticeship lead',checks:['Manager review recorded','Supporting information available','Final employer decision required'],audit:'Manager review complete'},enrolment:{status:'Pre-enrolment',heading:'Approval is not the same as a completed start.',copy:'Keep the provider handover, eligibility evidence and outstanding readiness checks visible before the learner moves into enrolled status.',owner:'Apprenticeship lead',checks:['Employer approval recorded','Provider and programme confirmed','Readiness evidence to complete'],audit:'Approved for handover'}};
  all('[data-workflow-step]').forEach(b=>b.addEventListener('click',()=>{
    const d=stages[b.dataset.workflowStep];all('[data-workflow-step]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
    ['status','heading','copy','owner'].forEach(k=>{one('[data-workflow-'+k+']').textContent=d[k];});
    const checks=one('[data-workflow-checks]');checks.replaceChildren();d.checks.forEach((text,i)=>{const span=document.createElement('span');const mark=document.createElement('span');mark.textContent=i<2?'✓':'○';mark.setAttribute('aria-hidden','true');span.append(mark,document.createTextNode(' '+text));checks.append(span);});
    const audit=one('[data-workflow-audit]');audit.replaceChildren(document.createTextNode(d.audit),document.createElement('br'));const small=document.createElement('small');small.textContent='Fictional workflow state';audit.append(small);say(d.status+' example selected.');
  }));
  const perspectives={employee:['Employee workspace','My next step is clear.',[['My application','With my line manager'],['What I can do','Prepare for a conversation about study time'],['Who acts next','My manager, then the apprenticeship lead']]],manager:['Manager workspace','I know where my team needs me.',[['Review','A direct-report application'],['Support','Agree learning time and workplace opportunity'],['Visibility','My team’s authorised records']]],team:['Apprenticeship team','The whole operation is visible.',[['Applications','Outstanding employer decisions'],['Learners','Progress, reviews and exceptions'],['Providers','Relationships and agreed actions']]],leadership:['Executive report','I can see the recorded position.',[['Participation','Active learners across departments'],['Decisions','Approvals and operational priorities'],['Finance','Imported evidence and its reporting period']]]};
  all('[data-perspective]').forEach(b=>b.addEventListener('click',()=>{
    const d=perspectives[b.dataset.perspective];all('[data-perspective]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));one('[data-perspective-label]').textContent=d[0];one('[data-perspective-heading]').textContent=d[1];const rows=one('[data-perspective-rows]');rows.replaceChildren();d[2].forEach(([k,v])=>{const div=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;div.append(dt,dd);rows.append(div);});say(d[0]+' illustration selected.');
  }));
  all('[data-copilot-question]').forEach(b=>b.addEventListener('click',()=>{
    const review=b.dataset.copilotQuestion==='reviews';all('[data-copilot-question]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
    one('[data-copilot-answer]').textContent=review?'One provider review is seven days overdue in this example. The apprenticeship lead owns the follow-up. Open the action to agree the next review date.':'The next decision belongs to the line manager in this example. Review the role fit and learning-time support before the application moves to final employer approval.';
    one('[data-copilot-link]').href=review?'#ps-operation-0':'#ps-operation-1';say('Example Copilot answer updated.');
  }));
  one('[data-support-preview]')?.addEventListener('click',e=>{const panel=one('#ps-support-request');panel.hidden=!panel.hidden;e.currentTarget.setAttribute('aria-expanded',String(!panel.hidden));say(panel.hidden?'Support request preview closed.':'Support request preview opened. Nothing has been sent.');});
})();
