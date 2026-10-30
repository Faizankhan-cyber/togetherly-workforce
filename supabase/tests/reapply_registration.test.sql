\set ON_ERROR_STOP on

-- Disposable PostgreSQL fixture for the rejected-registration migration.
-- CI runs this against a throwaway PostgreSQL 17 service, never production.
BEGIN;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;

CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_app_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT jsonb_build_object('role', NULLIF(current_setting('request.jwt.claim.role', true), ''));
$$;

CREATE TABLE public.employees (
  id text PRIMARY KEY,
  auth_user_id uuid UNIQUE,
  system_role text NOT NULL,
  employment_status text NOT NULL
);

CREATE FUNCTION public.current_system_role() RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('test.system_role', true), ''), 'none');
$$;

CREATE FUNCTION public.is_trusted_admin_context() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT (
    auth.uid() IS NULL
    AND current_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role')
  )
  OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
  OR public.current_system_role() = 'admin';
$$;

CREATE TABLE public.employee_registration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  applicant_name text NOT NULL,
  email text NOT NULL,
  requested_department text NOT NULL DEFAULT 'Engineering',
  requested_job_title text,
  assigned_role text CHECK (assigned_role IS NULL OR assigned_role IN ('employee','manager','hr','admin')),
  assigned_department text,
  assigned_job_title text,
  employee_id text REFERENCES public.employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_id text REFERENCES public.employees(id) ON DELETE SET NULL,
  reviewer_name text,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.activities (
  id text PRIMARY KEY,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'system',
  timestamp timestamptz NOT NULL DEFAULT now()
);

-- Install the same trigger name and a permissive old body. The migration must replace it.
CREATE FUNCTION public.enforce_registration_request_security_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$ BEGIN RETURN NEW; END $$;
CREATE TRIGGER trg_registration_requests_security_guard
BEFORE INSERT OR DELETE OR UPDATE ON public.employee_registration_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_registration_request_security_guard();

ALTER TABLE public.employee_registration_requests ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.employee_registration_requests TO authenticated;
CREATE POLICY applicants_select_own ON public.employee_registration_requests
  FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
CREATE POLICY applicants_insert_own_pending ON public.employee_registration_requests
  FOR INSERT TO authenticated WITH CHECK (
    auth_user_id = auth.uid() AND status = 'pending'
    AND assigned_role IS NULL AND employee_id IS NULL AND reviewer_id IS NULL
  );
CREATE POLICY applicants_update_own_pending ON public.employee_registration_requests
  FOR UPDATE TO authenticated USING (auth_user_id = auth.uid() AND status = 'pending')
  WITH CHECK (
    auth_user_id = auth.uid() AND status = 'pending'
    AND assigned_role IS NULL AND employee_id IS NULL AND reviewer_id IS NULL
  );

-- Users: rejected user whose email has since been reverified to a new address; pending;
-- another rejected account; unconfirmed; rejected but already linked to an active employee;
-- and a new applicant with no request.
INSERT INTO auth.users (id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data,created_at) VALUES
  ('00000000-0000-0000-0000-000000000001','current.one@example.test',now(),
   '{"full_name":"Old One","role":"employee","registration_status":"rejected","requested_job_title":"Old title"}',
   '{"role":"unassigned","registration_status":"rejected","employee_id":"old-one","system_role":"employee","department":"Old","job_title":"Old title"}', now() - interval '30 days'),
  ('00000000-0000-0000-0000-000000000002','pending.two@example.test',now(),
   '{"full_name":"Pending Two"}','{"role":"unassigned"}',now() - interval '20 days'),
  ('00000000-0000-0000-0000-000000000003','rejected.three@example.test',now(),
   '{"full_name":"Rejected Three"}','{"role":"unassigned","registration_status":"rejected"}',now() - interval '20 days'),
  ('00000000-0000-0000-0000-000000000004','unconfirmed.four@example.test',NULL,
   '{"full_name":"Unconfirmed Four"}','{"role":"unassigned","registration_status":"rejected"}',now() - interval '20 days'),
  ('00000000-0000-0000-0000-000000000005','active.five@example.test',now(),
   '{"full_name":"Active Five"}','{"role":"employee","registration_status":"rejected"}',now() - interval '20 days'),
  ('00000000-0000-0000-0000-000000000006','new.six@example.test',now(),
   '{"full_name":"New Six"}','{"role":"unassigned"}',now());

INSERT INTO public.employees (id,auth_user_id,system_role,employment_status) VALUES
  ('reviewer-hr',NULL,'hr','active'),
  ('old-one', '00000000-0000-0000-0000-000000000001','employee','offboarded'),
  ('active-five','00000000-0000-0000-0000-000000000005','employee','active');

INSERT INTO public.employee_registration_requests (
  auth_user_id,applicant_name,email,requested_department,requested_job_title,
  assigned_role,assigned_department,assigned_job_title,employee_id,status,
  reviewer_id,reviewer_name,reviewed_at,rejection_reason,created_at
) VALUES
  ('00000000-0000-0000-0000-000000000001','Old One','old.one@example.test','Old Department','Old title',
   'employee','Old Department','Old title','old-one','rejected','reviewer-hr','HR Reviewer',now()-interval '1 day','Insufficient details',now()-interval '30 days'),
  ('00000000-0000-0000-0000-000000000002','Pending Two','pending.two@example.test','Engineering',NULL,
   NULL,NULL,NULL,NULL,'pending',NULL,NULL,NULL,NULL,now()-interval '2 days'),
  ('00000000-0000-0000-0000-000000000003','Rejected Three','rejected.three@example.test','Engineering',NULL,
   NULL,NULL,NULL,NULL,'rejected','reviewer-hr','HR Reviewer',now()-interval '1 day','Needs more detail',now()-interval '4 days'),
  ('00000000-0000-0000-0000-000000000004','Unconfirmed Four','unconfirmed.four@example.test','Engineering',NULL,
   NULL,NULL,NULL,NULL,'rejected','reviewer-hr','HR Reviewer',now()-interval '1 day','Needs email confirmation',now()-interval '4 days'),
  ('00000000-0000-0000-0000-000000000005','Active Five','active.five@example.test','Engineering',NULL,
   'employee','Engineering','Developer','active-five','rejected','reviewer-hr','HR Reviewer',now()-interval '1 day','Already linked',now()-interval '4 days');

-- Apply twice to prove the migration is repeatable in an existing schema.
\ir ../migrations/20261028_reapply_rejected_registration.sql
\ir ../migrations/20261028_reapply_rejected_registration.sql

-- The applicant must not be able to edit a rejected row directly, even by setting the
-- transaction-local trigger marker themselves. RLS must hide the rejected row from UPDATE.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
DO $$
DECLARE v_rows bigint;
BEGIN
  PERFORM set_config('togetherly.allow_registration_reapply', auth.uid()::text, true);
  UPDATE public.employee_registration_requests SET status='pending'
  WHERE auth_user_id=auth.uid();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'SECURITY TEST FAILED: direct rejected-row update affected % rows',v_rows; END IF;
END $$;

-- A previously rejected applicant can reapply only for their own account. The current
-- confirmed Auth email may differ from the email on the old rejected request.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
DO $$
DECLARE v_result jsonb;
BEGIN
  v_result := public.reapply_my_registration_request('Updated One','Security','Security Analyst');
  IF v_result->>'status' <> 'pending' THEN RAISE EXCEPTION 'Expected own request to become pending'; END IF;
  IF v_result->>'email' <> 'current.one@example.test' THEN RAISE EXCEPTION 'Expected the currently verified Auth email to be used'; END IF;
  IF v_result->>'assigned_role' IS NOT NULL OR v_result->>'employee_id' IS NOT NULL OR v_result->>'reviewer_id' IS NOT NULL THEN
    RAISE EXCEPTION 'Assignment/reviewer fields were not cleared';
  END IF;
END $$;

-- Repeated reapplication, pending applicants, unconfirmed emails, missing requests and
-- identities already linked to an active employee must all be rejected.
DO $$
DECLARE v_error text;
BEGIN
  v_error := NULL;
  BEGIN PERFORM public.reapply_my_registration_request('Again','Security',NULL);
  EXCEPTION WHEN OTHERS THEN v_error := SQLERRM; END;
  IF v_error IS NULL OR position('Only a previously rejected' in v_error)=0 THEN RAISE EXCEPTION 'Expected repeat reapply rejection, got: %',v_error; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
DO $$
DECLARE v_visible integer;
BEGIN
  SELECT count(*) INTO v_visible FROM public.employee_registration_requests WHERE auth_user_id='00000000-0000-0000-0000-000000000003';
  IF v_visible <> 0 THEN RAISE EXCEPTION 'Applicant can read another applicant registration'; END IF;
END $$;
DO $$
DECLARE v_error text;
BEGIN
  v_error := NULL;
  BEGIN PERFORM public.reapply_my_registration_request('Pending Two','Engineering',NULL);
  EXCEPTION WHEN OTHERS THEN v_error := SQLERRM; END;
  IF v_error IS NULL OR position('Only a previously rejected' in v_error)=0 THEN RAISE EXCEPTION 'Expected pending request rejection, got: %',v_error; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
DO $$
DECLARE v_error text;
BEGIN
  v_error := NULL;
  BEGIN PERFORM public.reapply_my_registration_request('Unconfirmed Four','Engineering',NULL);
  EXCEPTION WHEN OTHERS THEN v_error := SQLERRM; END;
  IF v_error IS NULL OR position('Verify your email address' in v_error)=0 THEN RAISE EXCEPTION 'Expected unconfirmed email rejection, got: %',v_error; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',true);
DO $$
DECLARE v_error text;
BEGIN
  v_error := NULL;
  BEGIN PERFORM public.reapply_my_registration_request('Active Five','Engineering',NULL);
  EXCEPTION WHEN OTHERS THEN v_error := SQLERRM; END;
  IF v_error IS NULL OR position('active employee identity' in v_error)=0 THEN RAISE EXCEPTION 'Expected active employee identity rejection, got: %',v_error; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','',true);
DO $$
DECLARE v_error text;
BEGIN
  v_error := NULL;
  BEGIN PERFORM public.reapply_my_registration_request('Anonymous','Engineering',NULL);
  EXCEPTION WHEN OTHERS THEN v_error := SQLERRM; END;
  IF v_error IS NULL OR position('Authentication required' in v_error)=0 THEN RAISE EXCEPTION 'Expected unauthenticated call rejection, got: %',v_error; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',true);
DO $$
DECLARE v_error text;
BEGIN
  v_error := NULL;
  BEGIN PERFORM public.reapply_my_registration_request('New Six','Engineering',NULL);
  EXCEPTION WHEN OTHERS THEN v_error := SQLERRM; END;
  IF v_error IS NULL OR position('No registration request exists' in v_error)=0 THEN RAISE EXCEPTION 'Expected missing request rejection, got: %',v_error; END IF;
END $$;

-- New applicants must still be able to create exactly one pending request. The trigger,
-- not the client payload, controls status and reviewer/assignment fields.
INSERT INTO public.employee_registration_requests (
  auth_user_id,applicant_name,email,requested_department,status,assigned_role,assigned_department,
  assigned_job_title,employee_id,reviewer_id,reviewer_name,reviewed_at,rejection_reason
) VALUES (
  auth.uid(),'New Six','new.six@example.test','Engineering','approved','admin','Admin',
  'Administrator','active-five','reviewer-hr','Forged Reviewer',now(),'forged'
);
DO $$
DECLARE v_req public.employee_registration_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.employee_registration_requests WHERE auth_user_id=auth.uid();
  IF v_req.status <> 'pending' OR v_req.assigned_role IS NOT NULL OR v_req.employee_id IS NOT NULL
     OR v_req.reviewer_id IS NOT NULL OR v_req.rejection_reason IS NOT NULL THEN
    RAISE EXCEPTION 'New registration insert did not normalize to a pending unassigned request';
  END IF;
END $$;
DO $$
DECLARE v_error text;
BEGIN
  v_error := NULL;
  BEGIN
    INSERT INTO public.employee_registration_requests (auth_user_id,applicant_name,email,requested_department)
    VALUES (auth.uid(),'New Six Duplicate','new.six@example.test','Engineering');
  EXCEPTION WHEN unique_violation THEN v_error := SQLERRM; END;
  IF v_error IS NULL THEN RAISE EXCEPTION 'Expected unique auth_user_id to reject duplicate registration request'; END IF;
END $$;

-- Applicants may edit details while pending, but may not approve or alter reviewer fields.
UPDATE public.employee_registration_requests
SET applicant_name='New Six Updated', requested_department='Security'
WHERE auth_user_id=auth.uid();
DO $$
DECLARE v_error text;
BEGIN
  v_error := NULL;
  BEGIN UPDATE public.employee_registration_requests SET status='approved' WHERE auth_user_id=auth.uid();
  EXCEPTION WHEN OTHERS THEN v_error := SQLERRM; END;
  IF v_error IS NULL OR position('applicants cannot modify approval status' in v_error)=0 THEN
    RAISE EXCEPTION 'Expected pending applicant approval-field protection, got: %',v_error;
  END IF;
END $$;

-- Authenticated applicants cannot directly edit Auth metadata, and anonymous callers cannot
-- execute the SECURITY DEFINER RPC. The RPC is granted to authenticated only.
RESET ROLE;
DO $$
BEGIN
  IF has_function_privilege('anon','public.reapply_my_registration_request(text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'SECURITY TEST FAILED: anon can execute reapply RPC';
  END IF;
  IF NOT has_function_privilege('authenticated','public.reapply_my_registration_request(text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'SECURITY TEST FAILED: authenticated cannot execute reapply RPC';
  END IF;
  IF has_table_privilege('authenticated','auth.users','UPDATE') THEN
    RAISE EXCEPTION 'SECURITY TEST FAILED: authenticated can directly update auth.users';
  END IF;
END $$;

DO $$
DECLARE v_req public.employee_registration_requests%ROWTYPE; v_user auth.users%ROWTYPE; v_count integer;
BEGIN
  SELECT * INTO v_req FROM public.employee_registration_requests
  WHERE auth_user_id='00000000-0000-0000-0000-000000000001';
  IF v_req.status <> 'pending' OR v_req.email <> 'current.one@example.test'
     OR v_req.applicant_name <> 'Updated One' OR v_req.requested_department <> 'Security'
     OR v_req.requested_job_title <> 'Security Analyst' OR v_req.rejection_reason IS NOT NULL
     OR v_req.reviewer_id IS NOT NULL OR v_req.reviewer_name IS NOT NULL OR v_req.reviewed_at IS NOT NULL
     OR v_req.assigned_role IS NOT NULL OR v_req.assigned_department IS NOT NULL
     OR v_req.assigned_job_title IS NOT NULL OR v_req.employee_id IS NOT NULL THEN
    RAISE EXCEPTION 'Reapplied request has unexpected fields';
  END IF;
  SELECT * INTO v_user FROM auth.users WHERE id='00000000-0000-0000-0000-000000000001';
  IF v_user.raw_app_meta_data ? 'registration_status' OR v_user.raw_app_meta_data ? 'employee_id'
     OR v_user.raw_app_meta_data ? 'system_role' OR v_user.raw_app_meta_data ? 'department'
     OR v_user.raw_app_meta_data ? 'job_title' OR v_user.raw_app_meta_data->>'role' IS DISTINCT FROM 'unassigned' THEN
    RAISE EXCEPTION 'App metadata was not reset as expected';
  END IF;
  IF v_user.raw_user_meta_data ? 'registration_status' OR v_user.raw_user_meta_data ? 'employee_id'
     OR v_user.raw_user_meta_data->>'role' IS DISTINCT FROM 'unassigned'
     OR v_user.raw_user_meta_data->>'requires_admin_mapping' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'User metadata was not reset as expected';
  END IF;
  SELECT count(*) INTO v_count FROM public.activities WHERE message LIKE 'Applicant resubmitted registration for Updated One%';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one activity entry, found %',v_count; END IF;
  SELECT count(*) INTO v_count FROM public.employee_registration_requests
  WHERE auth_user_id='00000000-0000-0000-0000-000000000003' AND status='rejected';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Another applicant request was modified'; END IF;
END $$;

ROLLBACK;

\echo 'PASS: rejected-registration migration, authorization and new-registration regression tests'
