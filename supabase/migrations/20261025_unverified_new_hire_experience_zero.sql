CREATE OR REPLACE FUNCTION public.approve_employee_registration_request(p_request_id uuid, p_assigned_role text, p_assigned_department text, p_assigned_job_title text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_req record;
  v_auth_user record;
  v_existing_emp record;
  v_collision_emp record;
  v_reviewer_id text;
  v_reviewer_name text;
  v_clean_role text;
  v_clean_dept text;
  v_job_title text;
  v_employee_id text;
begin
  if not public.is_trusted_admin_context() then
    raise exception 'Access denied: only authorized administrators can approve employee registration requests.';
  end if;

  if p_request_id is null then
    raise exception 'Validation error: p_request_id is required.';
  end if;

  v_clean_role := pg_catalog.lower(pg_catalog.btrim(coalesce(p_assigned_role, '')));
  if v_clean_role not in ('employee', 'manager', 'hr', 'admin') then
    raise exception 'Validation error: assigned role must be one of employee, manager, hr, or admin.';
  end if;

  v_clean_dept := pg_catalog.btrim(coalesce(p_assigned_department, ''));
  if v_clean_dept = '' then
    raise exception 'Validation error: assigned department is required before approval.';
  end if;

  select *
  into v_req
  from public.employee_registration_requests
  where id = p_request_id
  for update;

  if v_req.id is null then
    raise exception 'Not found: registration request (%) does not exist.', p_request_id;
  end if;

  -- Prevent an active administrator from approving or modifying their own account
  if auth.uid() is not null and v_req.auth_user_id = auth.uid() then
    raise exception 'Validation error: you cannot approve or modify your own active administrator account.';
  end if;

  -- Verify the applicant's auth.users record exists and has confirmed their email
  select u.id, u.email, u.email_confirmed_at
  into v_auth_user
  from auth.users u
  where u.id = v_req.auth_user_id;

  if v_auth_user.id is null then
    raise exception 'Approval failed: auth.users account (%) no longer exists.', v_req.auth_user_id;
  end if;

  if v_auth_user.email_confirmed_at is null then
    raise exception 'Security policy: cannot approve registration for "%" until the user has verified their email address.', v_req.email;
  end if;

  -- Resolve reviewer directly by auth.uid() without relying on modified current_employee_id()
  if auth.uid() is not null then
    select e.id, e.name
    into v_reviewer_id, v_reviewer_name
    from public.employees e
    where e.auth_user_id = auth.uid()
    limit 1;
  end if;
  v_reviewer_name := coalesce(v_reviewer_name, 'Organization Administrator');

  v_job_title := coalesce(
    nullif(pg_catalog.btrim(p_assigned_job_title), ''),
    nullif(pg_catalog.btrim(v_req.requested_job_title), ''),
    case v_clean_role
      when 'admin' then 'Workforce Administrator'
      when 'hr' then 'HR People Operations Lead'
      when 'manager' then 'Workforce Delivery Manager'
      else 'Workforce Specialist'
    end
  );

  -- Detect email collision with another already-linked employee account
  select e.id, e.auth_user_id
  into v_collision_emp
  from public.employees e
  where pg_catalog.lower(pg_catalog.btrim(e.email)) = pg_catalog.lower(pg_catalog.btrim(v_req.email))
    and e.auth_user_id is not null
    and e.auth_user_id != v_req.auth_user_id
  limit 1;

  if v_collision_emp.id is not null then
    raise exception 'Conflict: employee record (%) with email "%" is already linked to a different user account.', v_collision_emp.id, v_req.email;
  end if;

  -- Locate an existing employee row belonging to this applicant (by auth_user_id or unlinked email)
  select e.id, e.auth_user_id, e.name
  into v_existing_emp
  from public.employees e
  where e.auth_user_id = v_req.auth_user_id
     or (
       e.auth_user_id is null
       and pg_catalog.lower(pg_catalog.btrim(e.email)) = pg_catalog.lower(pg_catalog.btrim(v_req.email))
     )
  order by (case when e.auth_user_id = v_req.auth_user_id then 0 else 1 end) asc
  limit 1;

  -- Guard against duplicate email on a different employee row
  if exists (
    select 1
    from public.employees e
    where pg_catalog.lower(pg_catalog.btrim(e.email)) = pg_catalog.lower(pg_catalog.btrim(v_req.email))
      and (v_existing_emp.id is null or e.id != v_existing_emp.id)
  ) then
    raise exception 'Conflict: another employee record with email "%" already exists.', v_req.email;
  end if;

  -- 1. Transition registration request to 'approved' and clear any prior 'rejected'
  --    flag in auth.users BEFORE mutating public.employees, so
  --    trg_zz_prevent_rejected_employee_identity_link sees the approved state
  --    without relying on any custom session/transaction GUC setting.
  update public.employee_registration_requests
  set status = 'approved',
      assigned_role = v_clean_role,
      assigned_department = v_clean_dept,
      assigned_job_title = v_job_title,
      employee_id = v_existing_emp.id,
      reviewer_id = v_reviewer_id,
      reviewer_name = v_reviewer_name,
      reviewed_at = pg_catalog.now(),
      rejection_reason = null,
      updated_at = pg_catalog.now()
  where id = p_request_id;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || pg_catalog.jsonb_build_object(
        'system_role', v_clean_role,
        'role', v_clean_role,
        'department', v_clean_dept,
        'job_title', v_job_title,
        'registration_status', 'approved'
      ),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || pg_catalog.jsonb_build_object(
        'role', v_clean_role,
        'department', v_clean_dept,
        'full_name', v_req.applicant_name,
        'requires_admin_mapping', false,
        'registration_status', 'approved'
      ),
      updated_at = pg_catalog.now()
  where id = v_req.auth_user_id;

  -- 2. Link or create the employee row in public.employees
  if v_existing_emp.id is not null then
    v_employee_id := v_existing_emp.id;

    update public.employees
    set auth_user_id = v_req.auth_user_id,
        name = coalesce(nullif(pg_catalog.btrim(v_req.applicant_name), ''), name),
        role = v_job_title,
        department = v_clean_dept,
        email = pg_catalog.btrim(v_req.email),
        system_role = v_clean_role,
        updated_at = pg_catalog.now()
    where id = v_employee_id;
  else
    -- Generate a deterministic, collision-free employee ID that never overwrites existing seeded IDs
    v_employee_id := 'emp-' || pg_catalog.substr(pg_catalog.replace(v_req.auth_user_id::text, '-', ''), 1, 8);
    if exists (select 1 from public.employees where id = v_employee_id) then
      v_employee_id := 'emp-' || pg_catalog.substr(pg_catalog.replace(v_req.auth_user_id::text, '-', ''), 1, 12);
    end if;

    insert into public.employees (
      id,
      auth_user_id,
      name,
      role,
      department,
      email,
      avatar_color,
      availability,
      years_experience,
      target_utilization,
      system_role
    )
    values (
      v_employee_id,
      v_req.auth_user_id,
      v_req.applicant_name,
      v_job_title,
      v_clean_dept,
      pg_catalog.btrim(v_req.email),
      '#0078D4',
      'available',
      0.0,
      100,
      v_clean_role
    );
  end if;

  -- 3. Finalize employee_id on auth.users and public.employee_registration_requests
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || pg_catalog.jsonb_build_object(
        'employee_id', v_employee_id,
        'system_role', v_clean_role,
        'role', v_clean_role,
        'department', v_clean_dept,
        'job_title', v_job_title,
        'registration_status', 'approved'
      ),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || pg_catalog.jsonb_build_object(
        'employee_id', v_employee_id,
        'role', v_clean_role,
        'department', v_clean_dept,
        'full_name', v_req.applicant_name,
        'requires_admin_mapping', false,
        'registration_status', 'approved'
      ),
      updated_at = pg_catalog.now()
  where id = v_req.auth_user_id;

  update public.employee_registration_requests
  set status = 'approved',
      assigned_role = v_clean_role,
      assigned_department = v_clean_dept,
      assigned_job_title = v_job_title,
      employee_id = v_employee_id,
      reviewer_id = v_reviewer_id,
      reviewer_name = v_reviewer_name,
      reviewed_at = pg_catalog.now(),
      rejection_reason = null,
      updated_at = pg_catalog.now()
  where id = p_request_id
  returning * into v_req;

  -- Record organizational activity (non-blocking)
  begin
    insert into public.activities (id, message, type, timestamp)
    values (
      'act-' || pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 12),
      'Approved employee registration for ' || v_req.applicant_name || ' (' || v_clean_dept || ' · ' || pg_catalog.upper(v_clean_role) || ')',
      'system',
      pg_catalog.now()
    );
  exception when others then
    null;
  end;

  return pg_catalog.to_jsonb(v_req);
end;
$function$


