-- Supabase Export: schema.sql (V4)
-- Generated at: 2026-04-17
-- Updated: Removed unused HC tables (hc_requests, hc_request_attachments, hc_meeting_events)

-- 1. SCHEMAS
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;

-- 2. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- 3. CUSTOM ENUMS
CREATE TYPE public.division_type AS ENUM ('GENERAL', 'OS', 'OT', 'OP', 'UQ');

-- 4. FUNCTIONS
CREATE OR REPLACE FUNCTION public.update_reports_sync_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
  AS $function$
  BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
  END;
  $function$;

-- 5. STORAGE TABLES
CREATE TABLE storage.buckets (
    id text PRIMARY KEY,
    name text NOT NULL,
    owner uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    public boolean DEFAULT false,
    avif_autoprovision boolean DEFAULT false,
    allowed_mime_types text[],
    file_size_limit bigint,
    owner_id text
);

CREATE TABLE storage.objects (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    bucket_id text REFERENCES storage.buckets(id),
    name text,
    owner uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    last_accessed_at timestamptz DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text
);

-- 6. AUTH TABLES (Minimal definitions for migration)
CREATE TABLE auth.users (
    id uuid PRIMARY KEY,
    instance_id uuid,
    aud varchar(255),
    role varchar(255),
    email varchar(255) UNIQUE,
    encrypted_password varchar(255),
    email_confirmed_at timestamptz,
    invited_at timestamptz,
    confirmation_token varchar(255),
    confirmation_sent_at timestamptz,
    recovery_token varchar(255),
    recovery_sent_at timestamptz,
    email_change_token_new varchar(255),
    email_change varchar(255),
    email_change_sent_at timestamptz,
    last_sign_in_at timestamptz,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamptz,
    updated_at timestamptz,
    phone text UNIQUE DEFAULT NULL,
    phone_confirmed_at timestamptz,
    phone_change text DEFAULT '',
    phone_change_token varchar(255) DEFAULT '',
    phone_change_sent_at timestamptz,
    confirmed_at timestamptz GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current varchar(255) DEFAULT '',
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamptz,
    reauthentication_token varchar(255) DEFAULT '',
    reauthentication_sent_at timestamptz,
    is_sso_user boolean DEFAULT false,
    deleted_at timestamptz
);

-- 7. PUBLIC TABLES
CREATE TABLE public.users (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL UNIQUE,
    password text NOT NULL,
    full_name text NOT NULL,
    role text,
    status text,
    nik text,
    phone text,
    station_id text,
    unit_id text,
    position_id text,
    department text,
    division text DEFAULT 'GENERAL',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- [Remaining public tables same as V2...]
CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    actor_id uuid REFERENCES public.users(id),
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    old_value jsonb,
    new_value jsonb,
    ip_address text,
    user_agent text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.reports_sync (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    sheet_id text NOT NULL,
    user_id uuid REFERENCES public.users(id),
    title text,
    status text DEFAULT 'BARU'::text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    target_division text
);

-- 8. RLS FOR SYSTEM SCHEMAS
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Select Buckets" ON storage.buckets FOR SELECT USING (true);
CREATE POLICY "Public Select" ON storage.objects FOR SELECT USING (bucket_id = 'evidence');
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'evidence' AND auth.role() = 'authenticated');
CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'evidence');

-- [Remaining policies same as V2...]
