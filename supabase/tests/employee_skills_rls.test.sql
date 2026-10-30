BEGIN;

CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid; $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE TABLE public.employees (
  id text PRIMARY KEY,
  auth_user_id uuid UNIQUE,
  system_role text NOT NULL,
  employment_status text NOT NULL
);
CREATE FUNCTION public.current_employee_id() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT e.id FROM public.employees AS e
  WHERE e.auth_user_id = auth.uid() AND e.employment_status = 'active'
  LIMIT 1;
$$;
CREATE FUNCTION public.is_reviewer_or_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT COALESCE(NULLIF(current_setting('test.system_role', true), ''), 'employee') IN ('manager','hr','admin'); $$;
GRANT EXECUTE ON FUNCTION public.current_employee_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_reviewer_or_admin() TO authenticated;

CREATE TABLE public.employee_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL REFERENCES public.employees(id),
  skill_id text NOT NULL,
  level integer NOT NULL CHECK (level BETWEEN 1 AND 5)
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_skills ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.employees, public.employee_skills TO authenticated;
CREATE POLICY "Employees directory is visible to authenticated users"
  ON public.employees FOR SELECT TO authenticated
  USING (employment_status = 'active' OR auth_user_id = auth.uid() OR public.is_reviewer_or_admin());
CREATE POLICY "Anyone authenticated can view employee skills"
  ON public.employee_skills FOR SELECT TO authenticated USING (true);

INSERT INTO public.employees (id,auth_user_id,system_role,employment_status) VALUES
  ('active-own','00000000-0000-0000-0000-000000000001','employee','active'),
  ('active-peer','00000000-0000-0000-0000-000000000002','employee','active'),
  ('offboarded-own','00000000-0000-0000-0000-000000000003','employee','offboarded'),
  ('offboarded-peer','00000000-0000-0000-0000-000000000004','employee','offboarded');
INSERT INTO public.employee_skills (employee_id,skill_id,level) VALUES
  ('active-own','python',3),
  ('active-peer','azure',4),
  ('offboarded-own','linux',2),
  ('offboarded-peer','aws',5);

\ir ../migrations/20261030100000_employee_skills_visibility.sql

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT set_config('test.system_role','employee',true);
DO $$
DECLARE v_count integer; v_hidden integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.employee_skills;
  SELECT count(*) INTO v_hidden FROM public.employee_skills WHERE employee_id='offboarded-peer';
  IF v_count <> 2 OR v_hidden <> 0 THEN
    RAISE EXCEPTION 'Active employee saw % skills and % offboarded-peer skills; expected 2 and 0',v_count,v_hidden;
  END IF;
END $$;

-- Offboarded users retain access to their own history but not another former colleague's history.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
DO $$
DECLARE v_count integer; v_own integer; v_other integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.employee_skills;
  SELECT count(*) INTO v_own FROM public.employee_skills WHERE employee_id='offboarded-own';
  SELECT count(*) INTO v_other FROM public.employee_skills WHERE employee_id='offboarded-peer';
  IF v_count <> 3 OR v_own <> 1 OR v_other <> 0 THEN
    RAISE EXCEPTION 'Offboarded user visibility incorrect: total %, own %, other former employee %',v_count,v_own,v_other;
  END IF;
END $$;

-- Reviewers retain access to all employee skill records for legitimate verification and audit work.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT set_config('test.system_role','hr',true);
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.employee_skills;
  IF v_count <> 4 THEN RAISE EXCEPTION 'Reviewer expected 4 skills, found %',v_count; END IF;
END $$;

RESET ROLE;
ROLLBACK;
\echo 'PASS: employee skill RLS exposes active directory, own history and reviewer access only'
