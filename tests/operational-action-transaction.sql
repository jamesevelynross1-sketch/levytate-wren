-- Fictional local PostgreSQL regression. Always rolled back, no external effects.
begin;
select set_config('request.jwt.claim.role','service_role',true);
insert into public.levytate_organisations(id,name,slug) values('94000000-0000-4000-a000-000000000001','Synthetic Operations','synthetic-operations');
insert into public.levytate_users(id,organisation_id,email,role,access_level,active) values
 ('94000000-0000-4000-a000-000000000002','94000000-0000-4000-a000-000000000001','lead-ops@example.invalid','Apprenticeship Lead','Employer',true),
 ('94000000-0000-4000-a000-000000000003','94000000-0000-4000-a000-000000000001','manager-ops@example.invalid','Line Manager','Employer',true),
 ('94000000-0000-4000-a000-000000000004','94000000-0000-4000-a000-000000000001','employee-ops@example.invalid','Employee','Employer',true);
insert into public.levytate_employees(organisation_id,id,employee_number,name,email,job_title,department,platform_role,status,start_date,manager_id) values
 ('94000000-0000-4000-a000-000000000001','ops-manager','OPS-M','Fictional Manager','manager-ops@example.invalid','Manager','Synthetic','Line Manager','Active','2025-01-01',''),
 ('94000000-0000-4000-a000-000000000001','ops-employee','OPS-E','Fictional Employee','employee-ops@example.invalid','Engineer','Synthetic','Employee','Active','2025-01-01','ops-manager');
insert into public.levytate_apprenticeship_standards(id,title,reference_code,status,level,occupational_route) values('OPS-SYNTHETIC','Fictional Operations standard','STOPS','Approved for delivery',4,'Synthetic');
insert into public.levytate_applications(organisation_id,id,employee_id,apprenticeship_standard_id,status,current_owner) values('94000000-0000-4000-a000-000000000001','ops-application','ops-employee','OPS-SYNTHETIC','Submitted to Line Manager','Line Manager');
insert into public.levytate_application_history(organisation_id,id,application_id,status,owner) values('94000000-0000-4000-a000-000000000001','ops-occurrence','ops-application','Submitted to Line Manager','Line Manager');
create function pg_temp.reject_operations_audit() returns trigger language plpgsql as $$begin raise exception 'synthetic audit failure';end$$;
do $$
declare org uuid:='94000000-0000-4000-a000-000000000001';lead uuid:='94000000-0000-4000-a000-000000000002';manager uuid:='94000000-0000-4000-a000-000000000003';emp uuid:='94000000-0000-4000-a000-000000000004';data jsonb;result jsonb;source_at timestamptz;
begin
 select updated_at into source_at from public.levytate_applications where organisation_id=org and id='ops-application';
 data:=jsonb_build_object('organisation_id',org,'id','ops-action','learner_record_id',null,'application_id','ops-application','employee_id','ops-employee','source_type','application_workflow','source_key','ops-application:manager-review:ops-occurrence','action_type','review_application','title','Review fictional application','description','Synthetic only','priority','High','priority_rank',1,'status','open','owner_type','Line Manager','owner_user_id',manager::text,'owner_display_name','Fictional Manager','due_date',null,'source_url','/levytate/app?module=Approvals','metadata','{"sourceCondition":"manager_review_required","occurrenceId":"ops-occurrence"}'::jsonb,'version',1);
 begin perform public.levytate_apply_operational_action(org,emp,'ops-action',0,'create',data,source_at);raise exception 'Employee created Operations action';exception when sqlstate 'PT403' then null;end;
 begin perform public.levytate_apply_operational_action(org,lead,'ops-action',0,'create',data,null);raise exception 'Missing source version accepted';exception when sqlstate 'PT409' then null;end;
 result:=public.levytate_apply_operational_action(org,lead,'ops-action',0,'create',data,source_at);
 if public.levytate_apply_operational_action(org,lead,'ops-action',0,'create',data,source_at)<>result or (select count(*) from public.levytate_operational_action_events where organisation_id=org)<>1 then raise exception 'Create retry duplicated evidence';end if;
 create trigger reject_operations_audit before insert on public.levytate_audit_events for each row when(new.entity_type='operational_action') execute function pg_temp.reject_operations_audit();
 begin perform public.levytate_apply_operational_action(org,manager,'ops-action',1,'transition','{"status":"acknowledged"}',null);raise exception 'Audit failure ignored';exception when raise_exception then if sqlerrm<>'synthetic audit failure' then raise;end if;end;
 if (select version from public.levytate_operational_actions where organisation_id=org and id='ops-action')<>1 or (select count(*) from public.levytate_operational_action_events where organisation_id=org)<>1 then raise exception 'State/history survived failed audit';end if;
 drop trigger reject_operations_audit on public.levytate_audit_events;
 perform public.levytate_apply_operational_action(org,manager,'ops-action',1,'transition','{"status":"acknowledged","acknowledged_by":"forged"}',null,'','{"action":"acknowledge"}');
 if public.levytate_apply_operational_action(org,manager,'ops-action',1,'transition','{}',null,'','{"action":"acknowledge"}',true)->>'status'<>'acknowledged' then raise exception 'Original request receipt probe failed';end if;
 begin perform public.levytate_apply_operational_action(org,manager,'ops-action',1,'transition','{}',null,'','{"action":"start"}',true);raise exception 'Changed request replay accepted';exception when sqlstate 'PT409' then null;end;
 if (select acknowledged_by from public.levytate_operational_actions where organisation_id=org and id='ops-action')<>manager::text then raise exception 'Actor not stamped';end if;
 begin perform public.levytate_apply_operational_action(org,lead,'ops-action',1,'transition','{"status":"in_progress"}',null);raise exception 'Stale revision accepted';exception when sqlstate 'PT409' then null;end;
 begin perform public.levytate_apply_operational_action(org,lead,'ops-action',2,'transition','{"status":"completed","completion_method":"user_completed","completion_note":"Fictional completion note"}',source_at);raise exception 'Application approval bypass accepted';exception when sqlstate 'PT403' then null;end;
 begin perform public.levytate_apply_operational_action(org,lead,'ops-action',2,'source_resolve','{"status":"completed","completion_method":"source_condition_resolved"}',source_at);raise exception 'Active review resolved';exception when sqlstate 'PT409' then null;end;
 update public.levytate_employees set manager_id='' where organisation_id=org and id='ops-employee';
 begin perform public.levytate_apply_operational_action(org,manager,'ops-action',1,'transition','{}',null,'','{"action":"acknowledge"}',true);raise exception 'Reassigned manager receipt accepted';exception when sqlstate 'PT403' then null;end;
 update public.levytate_employees set manager_id='ops-manager' where organisation_id=org and id='ops-employee';
 update public.levytate_applications set status='Awaiting Final Approval',current_owner='Apprenticeship Lead' where organisation_id=org and id='ops-application';
 select updated_at into source_at from public.levytate_applications where organisation_id=org and id='ops-application';
 perform public.levytate_apply_operational_action(org,lead,'ops-action',2,'source_resolve','{"status":"completed","completion_method":"source_condition_resolved"}',source_at);
 if (select count(*) from public.levytate_operational_action_events where organisation_id=org)<>3 or (select count(*) from public.levytate_audit_events where organisation_id=org)<>3 then raise exception 'Atomic event/audit count wrong';end if;
 begin perform public.levytate_apply_operational_action(org,lead,'ops-action',3,'transition','{"status":"in_progress"}',null);raise exception 'Terminal reversal accepted';exception when sqlstate 'PT409' then null;end;
 if has_table_privilege('service_role','public.levytate_operational_actions','update') or has_table_privilege('service_role','public.levytate_operational_action_events','insert') or has_function_privilege('authenticated','public.levytate_apply_operational_action(uuid,uuid,text,integer,text,jsonb,timestamptz,text,jsonb,boolean)','execute') then raise exception 'Unsafe Operations grants';end if;
 raise notice 'Operations local atomic/source/manager/receipt regressions passed';
end $$;
rollback;
