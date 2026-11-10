\set ON_ERROR_STOP on

-- Emits one canonical JSON line per application-owned schema catalogue object.
-- Run with psql -X -A -t -f and hash the exact output bytes with SHA-256.
with application_tables as (
  select c.oid, c.relname, c.relowner, c.relkind, c.relpersistence, c.relacl,
         c.relrowsecurity, c.relforcerowsecurity, n.nspname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and (c.relname like 'levytate\_%' escape '\' or c.relname like 'provider\_intelligence\_%' escape '\')
),
application_functions as (
  select p.*, n.nspname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (p.proname like 'levytate\_%' escape '\' or p.proname = 'set_current_timestamp_updated_at')
),
objects(kind, object_key, definition) as (
  select 'table', format('%I.%I', t.nspname, t.relname),
         jsonb_build_object(
           'kind', t.relkind, 'owner', pg_get_userbyid(t.relowner),
           'persistence', t.relpersistence, 'rls', t.relrowsecurity,
           'forceRls', t.relforcerowsecurity
         )
  from application_tables t

  union all
  select 'column', format('%I.%I.%s', t.nspname, t.relname, a.attnum),
         jsonb_build_object(
           'name', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
           'notNull', a.attnotnull, 'identity', a.attidentity,
           'generated', a.attgenerated,
           'default', pg_get_expr(d.adbin, d.adrelid, true)
         )
  from application_tables t
  join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum

  union all
  select 'constraint', format('%I.%I.%I', t.nspname, t.relname, c.conname),
         jsonb_build_object(
           'type', c.contype, 'deferrable', c.condeferrable,
           'deferred', c.condeferred, 'validated', c.convalidated,
           'definition', pg_get_constraintdef(c.oid, true)
         )
  from application_tables t
  join pg_constraint c on c.conrelid = t.oid

  union all
  select 'index', format('%I.%I', ni.nspname, i.relname),
         jsonb_build_object(
           'table', format('%I.%I', t.nspname, t.relname),
           'valid', x.indisvalid, 'ready', x.indisready,
           'unique', x.indisunique, 'primary', x.indisprimary,
           'definition', pg_get_indexdef(i.oid)
         )
  from application_tables t
  join pg_index x on x.indrelid = t.oid
  join pg_class i on i.oid = x.indexrelid
  join pg_namespace ni on ni.oid = i.relnamespace

  union all
  select 'policy', format('%I.%I.%I', t.nspname, t.relname, p.polname),
         jsonb_build_object(
           'permissive', p.polpermissive, 'command', p.polcmd,
           'roles', (
             select jsonb_agg(case when role_oid = 0 then 'PUBLIC' else pg_get_userbyid(role_oid) end order by role_oid)
             from unnest(p.polroles) role_oid
           ),
           'using', pg_get_expr(p.polqual, p.polrelid, true),
           'check', pg_get_expr(p.polwithcheck, p.polrelid, true)
         )
  from application_tables t
  join pg_policy p on p.polrelid = t.oid

  union all
  select 'trigger', format('%I.%I.%I', t.nspname, t.relname, g.tgname),
         jsonb_build_object('enabled', g.tgenabled, 'definition', pg_get_triggerdef(g.oid, true))
  from application_tables t
  join pg_trigger g on g.tgrelid = t.oid and not g.tgisinternal

  union all
  select 'function', f.oid::regprocedure::text,
         jsonb_build_object(
           'owner', pg_get_userbyid(f.proowner), 'language', l.lanname,
           'result', pg_get_function_result(f.oid),
           'identityArguments', pg_get_function_identity_arguments(f.oid),
           'securityDefiner', f.prosecdef, 'volatility', f.provolatile,
           'strict', f.proisstrict, 'parallel', f.proparallel,
           'configuration', coalesce(to_jsonb(f.proconfig), '[]'::jsonb),
           'definition', pg_get_functiondef(f.oid)
         )
  from application_functions f
  join pg_language l on l.oid = f.prolang

  union all
  select 'table-grant',
         format('%I.%I:%s:%s', t.nspname, t.relname,
           case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end,
           acl.privilege_type),
         jsonb_build_object('grantable', acl.is_grantable)
  from application_tables t
  cross join lateral aclexplode(coalesce(t.relacl, acldefault('r', t.relowner))) acl
  where acl.grantee = 0 or pg_get_userbyid(acl.grantee) in ('anon', 'authenticated', 'service_role')

  union all
  select 'sequence-grant',
         format('%I.%I:%s:%s', n.nspname, c.relname,
           case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end,
           acl.privilege_type),
         jsonb_build_object('grantable', acl.is_grantable)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(coalesce(c.relacl, acldefault('S', c.relowner))) acl
  where n.nspname = 'public' and c.relkind = 'S' and c.relname like 'levytate\_%' escape '\'
    and (acl.grantee = 0 or pg_get_userbyid(acl.grantee) in ('anon', 'authenticated', 'service_role'))

  union all
  select 'function-grant',
         format('%s:%s:%s', f.oid::regprocedure,
           case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end,
           acl.privilege_type),
         jsonb_build_object('grantable', acl.is_grantable)
  from application_functions f
  cross join lateral aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) acl
  where acl.grantee = 0 or pg_get_userbyid(acl.grantee) in ('anon', 'authenticated', 'service_role')
)
select jsonb_build_object('kind', kind, 'key', object_key, 'definition', definition)::text
from objects
order by kind, object_key, definition::text;
