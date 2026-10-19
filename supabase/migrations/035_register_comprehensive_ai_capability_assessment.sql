-- LevyTate Assessments V2: publish the comprehensive AI capability framework.
-- Additive registry data only. Existing V1 frameworks, campaigns, submissions,
-- result snapshots, grants, RLS policies and tenant data are unchanged.

do $$
begin
  if to_regclass('public.levytate_assessment_framework_versions') is null then
    raise exception 'Migration 034 must be applied before registering Assessments V2';
  end if;
end $$;

insert into public.levytate_assessment_framework_versions (
  framework_key,
  questionnaire_version,
  interpretation_version,
  title,
  status,
  questionnaire_snapshot,
  source_urls
) values (
  'ai_automation_data',
  'ai-capability-v2',
  'ai-capability-rules-v2',
  'Comprehensive AI Capability Assessment',
  'active',
  '[
    {"section":"experience","questions":["ex1","ex2","ex3","ex4","ex5","ex6","ex7","personalUseCases","workplaceUseCases"]},
    {"section":"understanding","questions":["un1","un2","un3","un4","un5"]},
    {"section":"responsible","questions":["re1","re2","re3","re4","re5"]},
    {"section":"application","questions":["ap1","ap2","ap3","ap4","ap5"]},
    {"section":"verification","questions":["ve1","ve2","ve3","ve4","ve5"]},
    {"section":"contribution","questions":["co1","co2","co3","co4","co5"]},
    {"section":"practical","questions":["pv1","pv2","pv3","pv4"]},
    {"section":"opportunities","questions":["barrier","opportunity"]}
  ]'::jsonb,
  '["Ground Control Current AI Capability Assessment (approved internal functional reference)"]'::jsonb
)
on conflict (framework_key, questionnaire_version, interpretation_version) do nothing;

notify pgrst, 'reload schema';
