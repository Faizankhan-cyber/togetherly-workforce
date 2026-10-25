-- Togetherly employee offboarding: preserve records, remove active staffing, and revoke access.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employment_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS offboarded_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS offboarded_by text NULL REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offboarding_reason text NULL;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.employees'::regclass
      AND conname = 'employees_employment_status_valid'
  ) THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_employment_status_valid
      CHECK (employment_status IN ('active', 'offboarded'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.employees'::regclass
      AND conname = 'employees_offboarded_fields_valid'
  ) THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_offboarded_fields_valid
      CHECK (
        (employment_status = 'active' AND offboarded_at IS NULL AND offboarding_reason IS NULL)
        OR (employment_status = 'offboarded' AND offboarded_at IS NOT NULL AND nullif(btrim(offboarding_reason), '') IS NOT NULL)
      );
  END IF;
END;
$block$;

CREATE TABLE IF NOT EXISTS public.employee_offboarding_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  employee_name text NOT NULL,
  offboarded_by text NULL REFERENCES public.employees(id) ON DELETE SET NULL,
  actor_name text NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('manager', 'hr', 'admin')),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 5 AND 1000),
  unassigned_project_allocations integer NOT NULL DEFAULT 0 CHECK (unassigned_project_allocations >= 0),
  removed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employee_offboarding_audit_employee_idx
  ON public.employee_offboarding_audit (employee_id, removed_at DESC);
CREATE INDEX IF NOT EXISTS employee_offboarding_audit_removed_at_idx
  ON public.employee_offboarding_audit (removed_at DESC);
ALTER TABLE public.employee_offboarding_audit ENABLE ROW LEVEL SECURITY;

-- Role helpers only recognize currently active accounts. An offboarded manager/HR user
-- can no longer review claims, mutate projects, or act as a member of the organization.
CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT e.id FROM public.employees e
  WHERE e.auth_user_id = auth.uid() AND e.employment_status = 'active'
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.current_system_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT coalesce((
    SELECT e.system_role FROM public.employees e
    WHERE e.auth_user_id = auth.uid() AND e.employment_status = 'active'
    LIMIT 1
  ), 'none');
$function$;

CREATE OR REPLACE FUNCTION public.is_reviewer_or_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.auth_user_id = auth.uid()
      AND e.employment_status = 'active'
      AND e.system_role IN ('manager', 'hr', 'admin')
  );
$function$;

-- Active employees can see the active directory. An employee can still read only their
-- own offboarded row so the auth client can show the explicit access-removed screen.
DROP POLICY IF EXISTS "Employees directory is visible to authenticated users" ON public.employees;
CREATE POLICY "Employees directory is visible to authenticated users"
  ON public.employees FOR SELECT TO authenticated
  USING (employment_status = 'active' OR auth_user_id = auth.uid() OR public.is_reviewer_or_admin());

-- Offboarded users cannot update their own profile fields.
DROP POLICY IF EXISTS "Employees can update their own profile contact info" ON public.employees;
CREATE POLICY "Employees can update their own profile contact info"
  ON public.employees FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() AND employment_status = 'active')
  WITH CHECK (
    auth_user_id = auth.uid()
    AND employment_status = 'active'
    AND id = COALESCE(current_setting('togetherly.verified_self_update_emp_id'::text, true), ''::text)
    AND system_role = COALESCE(current_setting('togetherly.verified_self_update_role'::text, true), ''::text)
  );

-- Projects and active allocations are not readable by an offboarded authenticated session.
DROP POLICY IF EXISTS "Anyone authenticated can view projects" ON public.projects;
CREATE POLICY "Anyone authenticated can view projects"
  ON public.projects FOR SELECT TO authenticated
  USING (public.current_employee_id() IS NOT NULL);
DROP POLICY IF EXISTS "Anyone authenticated can view project members" ON public.project_members;
CREATE POLICY "Anyone authenticated can view project members"
  ON public.project_members FOR SELECT TO authenticated
  USING (public.current_employee_id() IS NOT NULL);

DROP POLICY IF EXISTS "Active reviewers can read employee offboarding audit" ON public.employee_offboarding_audit;
CREATE POLICY "Active reviewers can read employee offboarding audit"
  ON public.employee_offboarding_audit FOR SELECT TO authenticated
  USING (public.is_reviewer_or_admin());
GRANT SELECT ON public.employee_offboarding_audit TO authenticated;
REVOKE ALL ON public.employee_offboarding_audit FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.employee_offboarding_audit FROM authenticated;

-- Disable direct employee hard-deletes. All removals must go through the audited RPC below.
DROP POLICY IF EXISTS "Reviewers and Admins can delete employees" ON public.employees;

CREATE OR REPLACE FUNCTION public.offboard_employee(
  p_employee_id text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor_id text := public.current_employee_id();
  v_actor_role text := public.current_system_role();
  v_actor_name text;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_target public.employees%rowtype;
  v_unassigned_count integer := 0;
  v_removed_at timestamptz := pg_catalog.now();
BEGIN
  IF auth.uid() IS NULL OR v_actor_id IS NULL OR NOT public.is_reviewer_or_admin() THEN
    RAISE EXCEPTION 'Only an active, authenticated manager, HR reviewer, or administrator can offboard employees.';
  END IF;
  IF v_reason IS NULL OR pg_catalog.length(v_reason) < 5 OR pg_catalog.length(v_reason) > 1000 THEN
    RAISE EXCEPTION 'A reason between 5 and 1000 characters is required for employee offboarding.';
  END IF;
  IF p_employee_id IS NULL OR pg_catalog.btrim(p_employee_id) = '' THEN
    RAISE EXCEPTION 'Select an employee to offboard.';
  END IF;
  IF p_employee_id = v_actor_id THEN
    RAISE EXCEPTION 'You cannot offboard your own account.';
  END IF;
  IF v_actor_role NOT IN ('manager', 'hr', 'admin') THEN
    RAISE EXCEPTION 'Your role is not authorized to offboard employees.';
  END IF;

  SELECT e.* INTO v_target
  FROM public.employees e
  WHERE e.id = p_employee_id
  FOR UPDATE;
  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'Employee not found.';
  END IF;
  IF v_target.employment_status <> 'active' THEN
    RAISE EXCEPTION 'This employee has already been offboarded.';
  END IF;
  IF v_target.system_role = 'admin' AND v_actor_role <> 'admin' THEN
    RAISE EXCEPTION 'Only an administrator can offboard another administrator.';
  END IF;

  SELECT e.name INTO v_actor_name
  FROM public.employees e
  WHERE e.id = v_actor_id AND e.auth_user_id = auth.uid() AND e.employment_status = 'active';
  IF v_actor_name IS NULL THEN
    RAISE EXCEPTION 'The active reviewer profile could not be verified.';
  END IF;

  UPDATE public.employees
  SET employment_status = 'offboarded',
      offboarded_at = v_removed_at,
      offboarded_by = v_actor_id,
      offboarding_reason = v_reason,
      updated_at = v_removed_at
  WHERE id = v_target.id AND employment_status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee status changed before offboarding could be completed.';
  END IF;

  DELETE FROM public.project_members WHERE employee_id = v_target.id;
  GET DIAGNOSTICS v_unassigned_count = ROW_COUNT;

  INSERT INTO public.employee_offboarding_audit (
    employee_id, employee_name, offboarded_by, actor_name, actor_role,
    reason, unassigned_project_allocations, removed_at
  ) VALUES (
    v_target.id, v_target.name, v_actor_id, v_actor_name, v_actor_role,
    v_reason, v_unassigned_count, v_removed_at
  );

  RETURN jsonb_build_object(
    'employee_id', v_target.id,
    'employee_name', v_target.name,
    'employment_status', 'offboarded',
    'offboarded_at', v_removed_at,
    'unassigned_project_allocations', v_unassigned_count
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.offboard_employee(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.offboard_employee(text, text) TO authenticated;
COMMENT ON TABLE public.employee_offboarding_audit IS 'Append-only audit log for employee offboarding decisions, including actor, reason, timestamp and unassigned active project allocations.';
