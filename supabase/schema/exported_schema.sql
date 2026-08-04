BEGIN;
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS graphql;
CREATE SCHEMA IF NOT EXISTS vault;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS uuid-ossp WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE TABLE IF NOT EXISTS public.ai_audit_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  feature text NOT NULL,
  prompt text NOT NULL,
  raw_response text,
  parsed_response jsonb,
  model text,
  execution_time_ms integer,
  status text NOT NULL,
  error_message text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.ai_audit_logs ADD CONSTRAINT ai_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id);

CREATE TABLE IF NOT EXISTS public.ai_cache_entries (
  cache_key text NOT NULL,
  insights jsonb NOT NULL,
  supporting_charts jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (cache_key)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users (id);

CREATE TABLE IF NOT EXISTS public.blocked_ips (
  ip_address text NOT NULL,
  reason text,
  blocked_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  metadata jsonb,
  PRIMARY KEY (ip_address)
);

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  event_date date NOT NULL,
  event_time time without time zone,
  notes text,
  meeting_minutes_link text,
  is_recurring boolean DEFAULT false NOT NULL,
  recurrence_pattern text,
  recurrence_end_date date,
  parent_event_id uuid,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  calendar_type text,
  PRIMARY KEY (id)
);
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_parent_event_id_fkey FOREIGN KEY (parent_event_id) REFERENCES public.calendar_events (id);
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users (id);

CREATE TABLE IF NOT EXISTS public.custom_dashboards (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  description text,
  created_by uuid,
  is_public boolean DEFAULT true,
  slug text NOT NULL,
  config jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  folder text,
  PRIMARY KEY (id),
  UNIQUE (slug)
);
ALTER TABLE public.custom_dashboards ADD CONSTRAINT custom_dashboards_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users (id);

CREATE TABLE IF NOT EXISTS public.dashboard_charts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  dashboard_id uuid,
  title text NOT NULL,
  chart_type text NOT NULL,
  data_field text NOT NULL,
  "position" integer DEFAULT 0,
  width text DEFAULT 'half'::text,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  query_config jsonb,
  visualization_config jsonb,
  layout jsonb,
  page_name text DEFAULT 'Ringkasan Umum'::text,
  PRIMARY KEY (id)
);
ALTER TABLE public.dashboard_charts ADD CONSTRAINT dashboard_charts_dashboard_id_fkey FOREIGN KEY (dashboard_id) REFERENCES public.custom_dashboards (id);

CREATE TABLE IF NOT EXISTS public.incident_types (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  default_severity text DEFAULT 'low'::text,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.locations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  area text,
  station_id text,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.positions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  level integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.report_comments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  report_id text NOT NULL,
  user_id uuid,
  content text,
  attachments jsonb DEFAULT '[]'::jsonb,
  is_system_message boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  sheet_id text,
  PRIMARY KEY (id)
);
ALTER TABLE public.report_comments ADD CONSTRAINT report_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id);

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  title text,
  description text,
  status text DEFAULT 'OPEN'::text,
  severity text DEFAULT 'low'::text,
  location text,
  flight_number text,
  aircraft_reg text,
  date_of_event timestamp with time zone,
  station_id text,
  incident_type_id text,
  sheet_id text,
  reporter_name text,
  action_taken text,
  root_caused text,
  delay_code text,
  delay_duration text,
  evidence_urls text[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  primary_tag text,
  target_division text,
  remarks_gapura_kps text,
  category text,
  priority text,
  PRIMARY KEY (id)
);
ALTER TABLE public.reports ADD CONSTRAINT reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id);

CREATE TABLE IF NOT EXISTS public.security_alerts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  description text,
  severity text NOT NULL,
  status text DEFAULT 'OPEN'::text,
  source_events uuid[],
  metadata jsonb,
  assigned_to uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.security_alerts ADD CONSTRAINT security_alerts_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users (id);

CREATE TABLE IF NOT EXISTS public.security_configs (
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  source text NOT NULL,
  event_type text NOT NULL,
  severity text,
  payload jsonb NOT NULL,
  ip_address text,
  actor_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.security_events ADD CONSTRAINT security_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users (id);

CREATE TABLE IF NOT EXISTS public.security_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  session_id text NOT NULL,
  ip_address text,
  user_agent text,
  device_name text,
  is_revoked boolean DEFAULT false,
  last_active timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (session_id)
);
ALTER TABLE public.security_sessions ADD CONSTRAINT security_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id);

CREATE TABLE IF NOT EXISTS public.units (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.users (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  email text NOT NULL,
  password text NOT NULL,
  full_name text NOT NULL,
  role text,
  status text,
  nik text,
  phone text,
  station_id text,
  unit_id text,
  position_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  department text,
  division text DEFAULT 'GENERAL'::text,
  PRIMARY KEY (id),
  UNIQUE (email)
);

COMMIT;
