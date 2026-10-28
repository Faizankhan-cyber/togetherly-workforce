-- Allow a previously rejected, authenticated applicant to request a fresh review.
-- The applicant retains the same verified Auth identity; signup must not create a duplicate user.

CREATE OR REPLACE FUNCTION public.enforce_registration_request_security_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_is_admin_ctx boolean;
  v_is_self_reapply boolean;
BEGIN
  v_is_admin_ctx := public.is_trusted_admin_context();

  IF TG_OP = 'DELETE' THEN
    IF NOT v_is_admin_ctx THEN
      RAISE EXCEPTION 'Access denied: only an authorized administrator can delete registration requests.';
    END IF;
    RETURN OLD;
  END IF;

  NEW.email := pg_catalog.btrim(coalesce(NEW.email, ''));
  NEW.applicant_name := pg_catalog.btrim(coalesce(NEW.applicant_name, 'Applicant'));
  NEW.requested_department := coalesce(nullif(pg_catalog.btrim(NEW.requested_department), ''), 'Engineering');

  IF TG_OP = 'INSERT' THEN
    NEW.created_at := coalesce(NEW.created_at, pg_catalog.now());
    NEW.updated_at := pg_catalog.now();

    IF NOT v_is_admin_ctx THEN
      IF auth.uid() IS NULL OR NEW.auth_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Security violation: you can only create a registration request for your own auth_user_id.';
      END IF;
      NEW.status := 'pending';
      NEW.assigned_role := NULL;
      NEW.assigned_department := NULL;
      NEW.assigned_job_title := NULL;
      NEW.employee_id := NULL;
      NEW.reviewer_id := NULL;
      NEW.reviewer_name := NULL;
      NEW.reviewed_at := NULL;
      NEW.rejection_reason := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.id := OLD.id;
    NEW.auth_user_id := OLD.auth_user_id;

    v_is_self_reapply :=
      NOT v_is_admin_ctx
      AND auth.uid() IS NOT NULL
      AND OLD.auth_user_id = auth.uid()
      AND OLD.status = 'rejected'
      AND current_setting('togetherly.allow_registration_reapply', true) = auth.uid()::text;

    IF v_is_self_reapply THEN
      NEW.created_at := coalesce(NEW.created_at, pg_catalog.now());
    ELSE
      NEW.created_at := OLD.created_at;
    END IF;
    NEW.updated_at := pg_catalog.now();

    IF NOT v_is_admin_ctx THEN
      IF v_is_self_reapply THEN
        IF NEW.status IS DISTINCT FROM 'pending'
           OR NEW.email IS DISTINCT FROM OLD.email
           OR NEW.assigned_role IS NOT NULL
           OR NEW.assigned_department IS NOT NULL
           OR NEW.assigned_job_title IS NOT NULL
           OR NEW.employee_id IS NOT NULL
           OR NEW.reviewer_id IS NOT NULL
           OR NEW.reviewer_name IS NOT NULL
           OR NEW.reviewed_at IS NOT NULL
           OR NEW.rejection_reason IS NOT NULL THEN
          RAISE EXCEPTION 'Security violation: reapplication may only return a rejected request to pending review.';
        END IF;
        RETURN NEW;
      END IF;

      IF auth.uid() IS NULL OR OLD.auth_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Access denied: you can only update your own pending registration request.';
      END IF;
      IF OLD.status != 'pending' THEN
        RAISE EXCEPTION 'Security violation: processed registration requests cannot be modified by the applicant.';
      END IF;
      IF NEW.status IS DISTINCT FROM OLD.status
         OR NEW.assigned_role IS DISTINCT FROM OLD.assigned_role
         OR NEW.assigned_department IS DISTINCT FROM OLD.assigned_department
         OR NEW.assigned_job_title IS DISTINCT FROM OLD.assigned_job_title
         OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
         OR NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id
         OR NEW.reviewer_name IS DISTINCT FROM OLD.reviewer_name
         OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
         OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
        RAISE EXCEPTION 'Security violation: applicants cannot modify approval status, role assignments, or review fields.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reapply_my_registration_request(
  p_applicant_name text DEFAULT NULL,
  p_requested_department text DEFAULT NULL,
  p_requested_job_title text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid;
  v_user record;
  v_req record;
  v_name text;
  v_department text;
  v_title text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT u.id, u.email, u.email_confirmed_at, u.raw_user_meta_data, u.raw_app_meta_data
  INTO v_user
  FROM auth.users u
  WHERE u.id = v_uid;

  IF v_user.id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user record not found.';
  END IF;

  IF v_user.email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Verify your email address before reapplying.';
  END IF;

  SELECT *
  INTO v_req
  FROM public.employee_registration_requests
  WHERE auth_user_id = v_uid
  FOR UPDATE;

  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'No registration request exists for this account.';
  END IF;

  IF v_req.status != 'rejected' THEN
    RAISE EXCEPTION 'Only a previously rejected registration request can be resubmitted.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.auth_user_id = v_uid
      AND (e.system_role = 'admin' OR e.employment_status = 'active')
  ) THEN
    RAISE EXCEPTION 'An active employee identity is already linked to this account.';
  END IF;

  v_name := coalesce(
    nullif(pg_catalog.btrim(p_applicant_name), ''),
    nullif(pg_catalog.btrim(v_req.applicant_name), ''),
    nullif(pg_catalog.btrim(v_user.raw_user_meta_data ->> 'full_name'), ''),
    pg_catalog.initcap(pg_catalog.replace(pg_catalog.split_part(v_user.email, '@', 1), '.', ' '))
  );
  v_department := coalesce(
    nullif(pg_catalog.btrim(p_requested_department), ''),
    nullif(pg_catalog.btrim(v_req.requested_department), ''),
    'Engineering'
  );
  v_title := nullif(pg_catalog.btrim(coalesce(p_requested_job_title, v_req.requested_job_title, '')), '');

  -- This transaction-local marker is consumed by the trigger only for the exact signed-in
  -- applicant and only while moving their own rejected request back to pending.
  PERFORM pg_catalog.set_config('togetherly.allow_registration_reapply', v_uid::text, true);

  UPDATE public.employee_registration_requests
  SET applicant_name = v_name,
      email = pg_catalog.btrim(v_user.email),
      requested_department = v_department,
      requested_job_title = v_title,
      status = 'pending',
      assigned_role = NULL,
      assigned_department = NULL,
      assigned_job_title = NULL,
      employee_id = NULL,
      reviewer_id = NULL,
      reviewer_name = NULL,
      reviewed_at = NULL,
      rejection_reason = NULL,
      created_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  WHERE id = v_req.id
  RETURNING * INTO v_req;

  UPDATE auth.users
  SET raw_app_meta_data =
        (coalesce(raw_app_meta_data, '{}'::jsonb)
          - 'registration_status' - 'employee_id' - 'system_role' - 'department' - 'job_title')
        || pg_catalog.jsonb_build_object('role', 'unassigned'),
      raw_user_meta_data =
        (coalesce(raw_user_meta_data, '{}'::jsonb) - 'registration_status' - 'employee_id' - 'requested_job_title')
        || pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
          'full_name', v_name,
          'requested_department', v_department,
          'requested_job_title', v_title,
          'role', 'unassigned',
          'requires_admin_mapping', true
        )),
      updated_at = pg_catalog.now()
  WHERE id = v_uid;

  BEGIN
    INSERT INTO public.activities (id, message, type, timestamp)
    VALUES (
      'act-' || pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 12),
      'Applicant resubmitted registration for ' || v_name || ' (' || v_department || ')',
      'system',
      pg_catalog.now()
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN pg_catalog.to_jsonb(v_req);
END;
$function$;

REVOKE ALL ON FUNCTION public.reapply_my_registration_request(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reapply_my_registration_request(text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
