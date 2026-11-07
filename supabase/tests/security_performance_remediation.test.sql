\set ON_ERROR_STOP on
BEGIN;

-- Minimal disposable PostgreSQL fixture for the V1 security/performance migration.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE TABLE public.employees (
  id text PRIMARY KEY,
  auth_user_id uuid UNIQUE,
  employment_status text NOT NULL,
  system_role text NOT NULL,
  offboarded_by text REFERENCES public.employees(id)
);
CREATE TABLE public.skills (id text PRIMARY KEY);
CREATE TABLE public.employee_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL REFERENCES public.employees(id),
  skill_id text NOT NULL REFERENCES public.skills(id),
  level integer NOT NULL
);
CREATE TABLE public.employee_offboarding_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offboarded_by text REFERENCES public.employees(id)
);
CREATE TABLE public.employee_profile_claim_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_employee_id text REFERENCES public.employees(id),
  employee_id text REFERENCES public.employees(id)
);
CREATE TABLE public.employee_profile_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_employee_id text REFERENCES public.employees(id),
  skill_id text REFERENCES public.skills(id)
);
CREATE TABLE public.employee_registration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid,
  status text,
  assigned_role text,
  employee_id text REFERENCES public.employees(id),
  reviewer_id text REFERENCES public.employees(id)
);
CREATE TABLE public.project_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id text REFERENCES public.skills(id)
);
CREATE TABLE public.tinyfish_agent_runs (
  run_id text PRIMARY KEY,
  owner_auth_user_id uuid,
  owner_employee_id text REFERENCES public.employees(id),
  owner_role text
);
CREATE TABLE public.training_submissions (
  id text PRIMARY KEY,
  employee_id text REFERENCES public.employees(id),
  status text,
  skill_id text REFERENCES public.skills(id)
);
CREATE TABLE public.training_assignments (
  id text PRIMARY KEY,
  employee_id text NOT NULL REFERENCES public.employees(id),
  verification_status text NOT NULL,
  submission_id text REFERENCES public.training_submissions(id),
  skill_id text REFERENCES public.skills(id)
);
CREATE TABLE public.verification_audit_logs (
  id text PRIMARY KEY,
  submission_id text REFERENCES public.training_submissions(id)
);

CREATE FUNCTION public.current_employee_id() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT e.id FROM public.employees e WHERE e.auth_user_id = auth.uid() AND e.employment_status = 'active' LIMIT 1 $$;
CREATE FUNCTION public.current_system_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT COALESCE((SELECT e.system_role FROM public.employees e WHERE e.auth_user_id = auth.uid() AND e.employment_status = 'active' LIMIT 1),'none') $$;
CREATE FUNCTION public.is_reviewer_or_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.employees e WHERE e.auth_user_id = auth.uid() AND e.employment_status = 'active' AND e.system_role IN ('manager','hr','admin')) $$;
GRANT EXECUTE ON FUNCTION public.current_employee_id(), public.current_system_role(), public.is_reviewer_or_admin() TO authenticated;

-- Trigger-only functions: their ACLs should not be exposed as callable RPCs.
CREATE FUNCTION public.enforce_employees_security_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$ BEGIN RETURN NEW; END $$;
CREATE FUNCTION public.enforce_registration_request_security_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$ BEGIN RETURN NEW; END $$;
CREATE FUNCTION public.enforce_training_assignment_update_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$ BEGIN RETURN NEW; END $$;
CREATE FUNCTION public.enforce_training_submission_integrity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$ BEGIN RETURN NEW; END $$;
CREATE FUNCTION public.enforce_verification_audit_log_integrity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$ BEGIN RETURN NEW; END $$;
CREATE FUNCTION public.handle_auth_user_registration_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$ BEGIN RETURN NEW; END $$;
CREATE FUNCTION public.handle_verified_auth_user_link() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$ BEGIN RETURN NEW; END $$;
CREATE FUNCTION public.prevent_rejected_employee_identity_link() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$ BEGIN RETURN NEW; END $$;
CREATE FUNCTION public.sync_employee_claims_to_auth_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$ BEGIN RETURN NEW; END $$;
CREATE FUNCTION public.sync_employee_to_registration_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$ BEGIN RETURN NEW; END $$;

CREATE TRIGGER trg_test_employees_guard BEFORE INSERT ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.enforce_employees_security_guard();

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tinyfish_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_assignments ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;

CREATE POLICY "Employees directory is visible to authenticated users"
  ON public.employees FOR SELECT TO authenticated
  USING (employment_status = 'active' OR auth_user_id = auth.uid() OR public.is_reviewer_or_admin());
CREATE POLICY "Employees can view their own training assignments"
  ON public.training_assignments FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id());

-- Seed synthetic users only.
INSERT INTO public.employees (id,auth_user_id,employment_status,system_role) VALUES
 ('employee-a','00000000-0000-0000-0000-000000000001','active','employee'),
 ('employee-b','00000000-0000-0000-0000-000000000002','active','employee'),
 ('former-c','00000000-0000-0000-0000-000000000003','offboarded','employee'),
 ('hr-d','00000000-0000-0000-0000-000000000004','active','hr');
INSERT INTO public.skills(id) VALUES ('sql'),('python');
INSERT INTO public.employee_skills(employee_id,skill_id,level) VALUES
 ('employee-a','sql',3),('employee-b','python',4),('former-c','sql',2);
INSERT INTO public.training_assignments(id,employee_id,verification_status,skill_id) VALUES
 ('assign-a','employee-a','in-progress','sql'),('assign-b','employee-b','in-progress','python');

-- Run twice: the migration must be repeatable.
\ir ../migrations/20261107160000_security_performance_remediation.sql
\ir ../migrations/20261107160000_security_performance_remediation.sql

DO $$
DECLARE v_count integer;
BEGIN
  IF has_function_privilege('authenticated','public.enforce_employees_security_guard()','EXECUTE') THEN
    RAISE EXCEPTION 'SECURITY TEST FAILED: authenticated can execute trigger-only function';
  END IF;
  IF has_function_privilege('anon','public.enforce_employees_security_guard()','EXECUTE') THEN
    RAISE EXCEPTION 'SECURITY TEST FAILED: anon can execute trigger-only function';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_test_employees_guard' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'SECURITY TEST FAILED: trigger was removed';
  END IF;
  IF to_regclass('public.idx_employee_skills_employee') IS NOT NULL
     OR to_regclass('public.employee_skills_employee_skill_uidx') IS NOT NULL THEN
    RAISE EXCEPTION 'PERFORMANCE TEST FAILED: redundant employee_skills indexes remain';
  END IF;
  SELECT count(*) INTO v_count FROM pg_class
  WHERE relkind='i' AND relname IN (
    'idx_employee_offboarding_audit_offboarded_by',
    'idx_employee_profile_claim_audit_actor_employee',
    'idx_employee_profile_claim_audit_employee',
    'idx_employee_profile_claims_reviewer',
    'idx_employee_profile_claims_skill',
    'idx_employee_registration_requests_employee',
    'idx_employee_registration_requests_reviewer',
    'idx_employees_offboarded_by',
    'idx_project_requirements_skill',
    'idx_tinyfish_agent_runs_owner_employee',
    'idx_training_assignments_submission',
    'idx_training_assignments_skill',
    'idx_training_submissions_skill'
  );
  IF v_count <> 13 THEN
    RAISE EXCEPTION 'PERFORMANCE TEST FAILED: expected 13 foreign-key indexes, found %',v_count;
  END IF;
END $$;

-- The trigger must still execute after its direct EXECUTE grant is revoked.
INSERT INTO public.employees(id,employment_status,system_role) VALUES ('trigger-test','active','employee');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT set_config('togetherly.verified_assignment_update_id','assign-a',true);

DO $$
DECLARE v_count integer; v_other integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.employee_skills;
  SELECT count(*) INTO v_other FROM public.employee_skills WHERE employee_id='former-c';
  IF v_count <> 2 OR v_other <> 0 THEN
    RAISE EXCEPTION 'RLS TEST FAILED: employee visibility total %, offboarded peer %',v_count,v_other;
  END IF;

  UPDATE public.training_assignments SET verification_status='in-progress'
  WHERE id='assign-a';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN RAISE EXCEPTION 'RLS TEST FAILED: employee could not update own training assignment'; END IF;

  UPDATE public.training_assignments SET verification_status='in-progress'
  WHERE id='assign-b';
  GET DIAGNOSTICS v_other = ROW_COUNT;
  IF v_other <> 0 THEN RAISE EXCEPTION 'RLS TEST FAILED: employee updated another employee assignment'; END IF;
END $$;

RESET ROLE;
ROLLBACK;
\echo 'PASS: security/performance migration, trigger ACLs, indexes and employee RLS regression checks'
