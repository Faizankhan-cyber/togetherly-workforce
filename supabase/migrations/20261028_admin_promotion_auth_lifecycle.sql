-- Togetherly role governance and Auth-user lifecycle improvements.
-- Keep the employee/audit history while releasing the email and allowing permanent Auth cleanup.

ALTER TABLE public.employee_offboarding_audit
  ADD COLUMN IF NOT EXISTS employee_email text;

-- Store historical emails in the audit before changing inactive employee profiles.
UPDATE public.employee_offboarding_audit AS audit
SET employee_email = employee.email
FROM public.employees AS employee
WHERE audit.employee_id = employee.id
  AND audit.employee_email IS NULL;

-- Release emails from older offboarded profiles while retaining their original email in audit.
UPDATE public.employees AS employee
SET email = 'offboarded+' ||
  pg_catalog.regexp_replace(employee.id, '[^a-zA-Z0-9_-]', '-', 'g') ||
  '@removed.invalid',
  updated_at = pg_catalog.now()
WHERE employee.employment_status = 'offboarded'
  AND employee.email NOT LIKE 'offboarded+%@removed.invalid';

ALTER TABLE public.admin_access_audit_logs
  DROP CONSTRAINT IF EXISTS admin_access_audit_logs_from_system_role_check;
ALTER TABLE public.admin_access_audit_logs
  ADD CONSTRAINT admin_access_audit_logs_from_system_role_check
  CHECK (from_system_role IN ('employee', 'manager', 'hr', 'admin'));
ALTER TABLE public.admin_access_audit_logs
  DROP CONSTRAINT IF EXISTS admin_access_audit_logs_to_system_role_check;
ALTER TABLE public.admin_access_audit_logs
  ADD CONSTRAINT admin_access_audit_logs_to_system_role_check
  CHECK (to_system_role IN ('employee', 'manager', 'hr', 'admin'));

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
  v_original_email text;
  v_placeholder_email text;
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

  v_original_email := v_target.email;
  v_placeholder_email := 'offboarded+' ||
    pg_catalog.regexp_replace(v_target.id, '[^a-zA-Z0-9_-]', '-', 'g') ||
    '@removed.invalid';

  SELECT e.name INTO v_actor_name
  FROM public.employees e
  WHERE e.id = v_actor_id AND e.auth_user_id = auth.uid() AND e.employment_status = 'active';
  IF v_actor_name IS NULL THEN
    RAISE EXCEPTION 'The active reviewer profile could not be verified.';
  END IF;

  UPDATE public.employees
  SET employment_status = 'offboarded',
      email = v_placeholder_email,
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
    employee_id, employee_name, employee_email, offboarded_by, actor_name, actor_role,
    reason, unassigned_project_allocations, removed_at
  ) VALUES (
    v_target.id, v_target.name, v_original_email, v_actor_id, v_actor_name, v_actor_role,
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
COMMENT ON FUNCTION public.offboard_employee(text, text) IS
  'Audited offboarding that preserves the original email, releases it from the historical employee row, removes active allocations, and blocks former workspace access. Auth identity deletion is completed by workspace-identity-lifecycle.';

CREATE OR REPLACE FUNCTION public.list_promotable_employee_accounts()
RETURNS TABLE (
  employee_id text,
  auth_user_id uuid,
  full_name text,
  email text,
  department text,
  system_role text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.current_system_role() <> 'admin' THEN
    RAISE EXCEPTION 'Access denied: only an active administrator can manage role promotions.';
  END IF;
  RETURN QUERY
    SELECT e.id, e.auth_user_id, e.name, e.email, e.department, e.system_role
    FROM public.employees AS e
    WHERE e.employment_status = 'active'
      AND e.auth_user_id IS NOT NULL
      AND e.system_role IN ('employee', 'manager', 'hr')
    ORDER BY e.name, e.email;
END;
$function$;
REVOKE ALL ON FUNCTION public.list_promotable_employee_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_promotable_employee_accounts() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_offboarded_auth_cleanup_accounts()
RETURNS TABLE (
  employee_id text,
  auth_user_id uuid,
  full_name text,
  email text,
  department text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.current_system_role() <> 'admin' THEN
    RAISE EXCEPTION 'Access denied: only an active administrator can review Auth cleanup.';
  END IF;
  RETURN QUERY
    SELECT e.id, e.auth_user_id, e.name,
           COALESCE(a.employee_email, e.email) AS email,
           e.department
    FROM public.employees AS e
    LEFT JOIN LATERAL (
      SELECT audit.employee_email
      FROM public.employee_offboarding_audit AS audit
      WHERE audit.employee_id = e.id
      ORDER BY audit.removed_at DESC
      LIMIT 1
    ) AS a ON true
    WHERE e.employment_status = 'offboarded'
      AND e.auth_user_id IS NOT NULL
    ORDER BY e.offboarded_at DESC NULLS LAST, e.name;
END;
$function$;
REVOKE ALL ON FUNCTION public.list_offboarded_auth_cleanup_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_offboarded_auth_cleanup_accounts() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_employee_system_role(p_employee_id text, p_target_role text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_employee_id text;
  v_actor_name text;
  v_target_id text;
  v_target_auth_user_id uuid;
  v_target_name text;
  v_target_email text;
  v_target_role text;
  v_target_status text;
  v_new_role text := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_target_role, '')));
BEGIN
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(780281, 4271);

  SELECT e.id, e.name INTO v_actor_employee_id, v_actor_name
  FROM public.employees AS e
  WHERE e.auth_user_id = v_actor_id
    AND e.system_role = 'admin'
    AND e.employment_status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Access denied: only an active administrator can promote accounts.'; END IF;
  IF p_employee_id IS NULL OR pg_catalog.btrim(p_employee_id) = '' THEN
    RAISE EXCEPTION 'Select an account to promote.';
  END IF;
  IF v_new_role NOT IN ('manager', 'hr', 'admin') THEN
    RAISE EXCEPTION 'Choose Manager, HR, or Administrator as the target role.';
  END IF;

  SELECT e.id, e.auth_user_id, e.name, e.email, e.system_role, e.employment_status
  INTO v_target_id, v_target_auth_user_id, v_target_name, v_target_email, v_target_role, v_target_status
  FROM public.employees AS e
  WHERE e.id = p_employee_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The selected account was not found.'; END IF;
  IF v_target_auth_user_id = v_actor_id THEN
    RAISE EXCEPTION 'You cannot change your own role from the promotion panel.';
  END IF;
  IF v_target_status <> 'active' OR v_target_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Only active, linked workspace accounts can be promoted.';
  END IF;
  IF v_target_role = 'admin' THEN
    RAISE EXCEPTION 'Administrator accounts must be changed through the Admin Access demotion workflow.';
  END IF;
  IF v_target_role = v_new_role THEN RAISE EXCEPTION 'This account already has the selected role.'; END IF;

  IF v_new_role = 'admin' THEN
    IF v_target_role NOT IN ('employee', 'manager', 'hr') THEN
      RAISE EXCEPTION 'This role transition is not allowed.';
    END IF;
  ELSIF v_target_role <> 'employee' OR v_new_role NOT IN ('manager', 'hr') THEN
    RAISE EXCEPTION 'Promotions are limited to Employee to Manager/HR/Admin or Manager/HR to Admin.';
  END IF;

  UPDATE public.employees AS e
  SET system_role = v_new_role, updated_at = pg_catalog.now()
  WHERE e.id = v_target_id AND e.employment_status = 'active' AND e.system_role = v_target_role;
  IF NOT FOUND THEN RAISE EXCEPTION 'The account changed before the promotion could be completed. Refresh and try again.'; END IF;

  INSERT INTO public.admin_access_audit_logs (
    actor_auth_user_id, actor_employee_id, actor_name,
    target_auth_user_id, target_employee_id, target_name, target_email,
    from_system_role, to_system_role
  ) VALUES (
    v_actor_id, v_actor_employee_id, v_actor_name,
    v_target_auth_user_id, v_target_id, v_target_name, v_target_email,
    v_target_role, v_new_role
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true, 'employee_id', v_target_id, 'name', v_target_name,
    'email', v_target_email, 'previous_system_role', v_target_role, 'new_system_role', v_new_role
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.set_employee_system_role(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_employee_system_role(text, text) TO authenticated;

DO $publication$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'employees'
     ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.employees';
  END IF;
END;
$publication$;
