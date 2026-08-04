-- Exact, compact dashboard aggregates. Display pagination is intentionally
-- independent from these calculations: every aggregate reads the complete
-- eligible source population in one statement snapshot.

create or replace function public.dashboard_ground_overview(
  p_station_codes text[] default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  with eligible as materialized (
    select r.*
    from public.ground_handling_irregularity_report as r
    where p_station_codes is null
       or cardinality(p_station_codes) = 0
       or upper(coalesce(
            nullif(r.station_code, ''),
            nullif(r.branch, ''),
            nullif(r.reporting_branch, ''),
            ''
          )) = any (
            select upper(trim(code))
            from unnest(p_station_codes) as code
          )
  ),
  stats as (
    select
      count(*)::integer as total,
      count(*) filter (where upper(trim(coalesce(status, ''))) = 'CLOSED')::integer as resolved,
      count(*) filter (where upper(trim(coalesce(status, ''))) = 'OPEN')::integer as pending,
      count(*) filter (
        where upper(trim(coalesce(nullif(severity, ''), severity_level, '')))
          in ('TOP RISK', 'HIGH RISK', 'HIGH', 'CRITICAL')
      )::integer as high_severity,
      coalesce(
        jsonb_agg(distinct extract(year from coalesce(date_of_event::timestamptz, created_at))::integer)
          filter (where coalesce(date_of_event::timestamptz, created_at) is not null),
        '[]'::jsonb
      ) as years
    from eligible
  ),
  filter_options as (
    select jsonb_build_object(
      'hubs', coalesce(jsonb_agg(distinct trim(hub)) filter (where nullif(trim(hub), '') is not null), '[]'::jsonb),
      'branches', coalesce(jsonb_agg(distinct trim(coalesce(nullif(station_code, ''), nullif(branch, ''), reporting_branch)))
        filter (where nullif(trim(coalesce(nullif(station_code, ''), nullif(branch, ''), reporting_branch)), '') is not null), '[]'::jsonb),
      'airlines', coalesce(jsonb_agg(distinct trim(coalesce(nullif(airlines, ''), airline)))
        filter (where nullif(trim(coalesce(nullif(airlines, ''), airline)), '') is not null), '[]'::jsonb),
      'categories', coalesce(jsonb_agg(distinct trim(coalesce(nullif(main_category, ''), category)))
        filter (where nullif(trim(coalesce(nullif(main_category, ''), category)), '') is not null), '[]'::jsonb)
    ) as value
    from eligible
  ),
  tab_populations as (
    select jsonb_build_object(
      'summary', count(*)::integer,
      'sqi', count(*)::integer,
      'gse', count(*) filter (
        where nullif(trim(coalesce(category_case_gse, '')), '') is not null
           or nullif(trim(coalesce(gse_available_requirement, '')), '') is not null
           or nullif(trim(coalesce(gse_requirement, '')), '') is not null
           or concat_ws(' ', main_category, category, report, description, title, primary_tag) ~* '(^|[^a-z0-9])gse([^a-z0-9]|$)|ground support equipment'
      )::integer,
      'cgo_cargo', count(*) filter (
        where upper(trim(coalesce(primary_tag, ''))) = 'CGO'
           or upper(trim(coalesce(source_sheet, ''))) = 'CGO'
           or nullif(trim(coalesce(category_case_cargo, '')), '') is not null
           or nullif(trim(coalesce(case_cgo, '')), '') is not null
      )::integer,
      'delay', count(*)::integer,
      'status_details', count(*)::integer
    ) as value
    from eligible
  )
  select jsonb_build_object(
    'source', 'ground_handling',
    'sourceCounts', jsonb_build_object('ground_handling', s.total),
    'uniquePopulationCount', s.total,
    'filteredCount', s.total,
    'summary', jsonb_build_object(
      'total', s.total,
      'resolved', s.resolved,
      'pending', s.pending,
      'highSeverity', s.high_severity,
      'resolutionRate', case when s.total > 0 then round((s.resolved::numeric / s.total) * 100)::integer else 0 end,
      'years', s.years
    ),
    'filterOptions', f.value,
    'tabPopulations', t.value,
    'generatedAt', to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'completeness', 'complete'
  )
  from stats as s
  cross join filter_options as f
  cross join tab_populations as t;
$function$;

revoke execute on function public.dashboard_ground_overview(text[]) from public;
revoke execute on function public.dashboard_ground_overview(text[]) from anon;
revoke execute on function public.dashboard_ground_overview(text[]) from authenticated;
grant execute on function public.dashboard_ground_overview(text[]) to service_role;

comment on function public.dashboard_ground_overview(text[]) is
  'Exact all-row Ground Handling dashboard overview. Pagination never limits these calculations.';
