-- Fix auth signup failure when there is no pre-provisioned employee row.
-- Scalar SELECT INTO targets are set to NULL when no row matches; an unassigned RECORD is not.
create or replace function public.handle_auth_user_registration_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emp_id text;
  v_emp_name text;
  v_emp_role text;
  v_emp_department text;
  v_emp_system_role text;
  v_applicant_name text;
  v_req_dept text;
  v_req_title text;
begin
  if new.email is null or pg_catalog.btrim(new.email) = '' then
    return new;
  end if;

  v_applicant_name := coalesce(
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'name'), ''),
    pg_catalog.initcap(pg_catalog.replace(pg_catalog.split_part(new.email, '@', 1), '.', ' '))
  );

  v_req_dept := coalesce(
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'requested_department'), ''),
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'department'), ''),
    'Engineering'
  );

  v_req_title := nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'requested_job_title'), '');

  -- Strictly check whether this user is already linked by auth_user_id (never by unlinked email)
  if new.email_confirmed_at is not null then
    select e.id, e.name, e.role, e.department, e.system_role
    into v_emp_id, v_emp_name, v_emp_role, v_emp_department, v_emp_system_role
    from public.employees e
    where e.auth_user_id = new.id
    limit 1;
  end if;

  if v_emp_id is not null
     and coalesce(new.raw_app_meta_data ->> 'registration_status', '') != 'rejected' then
    insert into public.employee_registration_requests (
      auth_user_id,
      applicant_name,
      email,
      requested_department,
      requested_job_title,
      assigned_role,
      assigned_department,
      assigned_job_title,
      employee_id,
      status,
      reviewer_name,
      reviewed_at,
      created_at,
      updated_at
    )
    values (
      new.id,
      coalesce(v_emp_name, v_applicant_name),
      pg_catalog.btrim(new.email),
      coalesce(v_emp_department, v_req_dept),
      v_req_title,
      v_emp_system_role,
      v_emp_department,
      v_emp_role,
      v_emp_id,
      'approved',
      'System Provisioning',
      pg_catalog.now(),
      coalesce(new.created_at, pg_catalog.now()),
      pg_catalog.now()
    )
    on conflict (auth_user_id) do update set
      email = excluded.email,
      assigned_role = excluded.assigned_role,
      assigned_department = excluded.assigned_department,
      assigned_job_title = excluded.assigned_job_title,
      employee_id = excluded.employee_id,
      status = 'approved',
      updated_at = pg_catalog.now()
    where public.employee_registration_requests.status != 'rejected';
  else
    insert into public.employee_registration_requests (
      auth_user_id,
      applicant_name,
      email,
      requested_department,
      requested_job_title,
      status,
      created_at,
      updated_at
    )
    values (
      new.id,
      v_applicant_name,
      pg_catalog.btrim(new.email),
      v_req_dept,
      v_req_title,
      case
        when coalesce(new.raw_app_meta_data ->> 'registration_status', '') = 'rejected' then 'rejected'
        else 'pending'
      end,
      coalesce(new.created_at, pg_catalog.now()),
      pg_catalog.now()
    )
    on conflict (auth_user_id) do update set
      email = excluded.email,
      applicant_name = case
        when public.employee_registration_requests.status = 'pending'
        then coalesce(nullif(excluded.applicant_name, ''), public.employee_registration_requests.applicant_name)
        else public.employee_registration_requests.applicant_name
      end,
      requested_department = case
        when public.employee_registration_requests.status = 'pending'
        then coalesce(nullif(excluded.requested_department, ''), public.employee_registration_requests.requested_department)
        else public.employee_registration_requests.requested_department
      end,
      requested_job_title = case
        when public.employee_registration_requests.status = 'pending'
        then coalesce(excluded.requested_job_title, public.employee_registration_requests.requested_job_title)
        else public.employee_registration_requests.requested_job_title
      end,
      updated_at = pg_catalog.now();
  end if;

  return new;
end;
$$;
REVOKE ALL ON FUNCTION public.handle_auth_user_registration_request() FROM PUBLIC, anon;

NOTIFY pgrst, 'reload schema';
