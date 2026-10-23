-- =============================================================================
-- Migration: 20261023_employee_registration_requests.sql
-- Description: Employee Verification & Approval System (Incremental Migration)
-- Notes:
--   - Can be applied standalone if 20261016_initial_schema.sql was already run,
--     or included as Section 18 of 20261016_initial_schema.sql.
--   - Idempotent and non-destructive.
-- =============================================================================

create table if not exists public.employee_registration_requests (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  applicant_name text not null,
  email text not null,
  requested_department text not null default 'Engineering',
  requested_job_title text,
  assigned_role text
    check (assigned_role is null or assigned_role in ('employee', 'manager', 'hr', 'admin')),
  assigned_department text,
  assigned_job_title text,
  employee_id text references public.employees(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewer_id text references public.employees(id) on delete set null,
  reviewer_name text,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index if not exists idx_emp_reg_requests_status
  on public.employee_registration_requests(status);
create index if not exists idx_emp_reg_requests_email
  on public.employee_registration_requests(pg_catalog.lower(email));
create index if not exists idx_emp_reg_requests_dept
  on public.employee_registration_requests(requested_department);
create index if not exists idx_emp_reg_requests_role
  on public.employee_registration_requests(assigned_role);
create index if not exists idx_emp_reg_requests_created_at
  on public.employee_registration_requests(created_at desc);

-- Security Guard Trigger
create or replace function public.enforce_registration_request_security_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin_ctx boolean;
begin
  v_is_admin_ctx := public.is_trusted_admin_context();

  if tg_op = 'DELETE' then
    if not v_is_admin_ctx then
      raise exception 'Access denied: only an authorized administrator can delete registration requests.';
    end if;
    return old;
  end if;

  new.email := pg_catalog.btrim(coalesce(new.email, ''));
  new.applicant_name := pg_catalog.btrim(coalesce(new.applicant_name, 'Applicant'));
  new.requested_department := coalesce(pg_catalog.nullif(pg_catalog.btrim(new.requested_department), ''), 'Engineering');

  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, pg_catalog.now());
    new.updated_at := pg_catalog.now();

    if not v_is_admin_ctx then
      if auth.uid() is null or new.auth_user_id != auth.uid() then
        raise exception 'Security violation: you can only create a registration request for your own auth_user_id.';
      end if;
      new.status := 'pending';
      new.assigned_role := null;
      new.assigned_department := null;
      new.assigned_job_title := null;
      new.employee_id := null;
      new.reviewer_id := null;
      new.reviewer_name := null;
      new.reviewed_at := null;
      new.rejection_reason := null;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.auth_user_id := old.auth_user_id;
    new.created_at := old.created_at;
    new.updated_at := pg_catalog.now();

    if not v_is_admin_ctx then
      if auth.uid() is null or old.auth_user_id != auth.uid() then
        raise exception 'Access denied: you can only update your own pending registration request.';
      end if;
      if old.status != 'pending' then
        raise exception 'Security violation: processed registration requests cannot be modified by the applicant.';
      end if;
      if new.status is distinct from old.status
         or new.assigned_role is distinct from old.assigned_role
         or new.assigned_department is distinct from old.assigned_department
         or new.assigned_job_title is distinct from old.assigned_job_title
         or new.employee_id is distinct from old.employee_id
         or new.reviewer_id is distinct from old.reviewer_id
         or new.reviewer_name is distinct from old.reviewer_name
         or new.reviewed_at is distinct from old.reviewed_at
         or new.rejection_reason is distinct from old.rejection_reason then
        raise exception 'Security violation: applicants cannot modify approval status, role assignments, or review fields.';
      end if;
    end if;
    return new;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_registration_request_security_guard() from public;

drop trigger if exists trg_registration_requests_security_guard on public.employee_registration_requests;
create trigger trg_registration_requests_security_guard
  before insert or update or delete on public.employee_registration_requests
  for each row
  execute function public.enforce_registration_request_security_guard();

-- Automatic Queue Capture Trigger on auth.users
create or replace function public.handle_auth_user_registration_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emp record;
  v_applicant_name text;
  v_req_dept text;
  v_req_title text;
begin
  if new.email is null or pg_catalog.btrim(new.email) = '' then
    return new;
  end if;

  v_applicant_name := coalesce(
    pg_catalog.nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    pg_catalog.nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'name'), ''),
    pg_catalog.initcap(pg_catalog.replace(pg_catalog.split_part(new.email, '@', 1), '.', ' '))
  );

  v_req_dept := coalesce(
    pg_catalog.nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'requested_department'), ''),
    pg_catalog.nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'department'), ''),
    'Engineering'
  );

  v_req_title := pg_catalog.nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'requested_job_title'), '');

  select e.id, e.name, e.role, e.department, e.system_role
  into v_emp
  from public.employees e
  where e.auth_user_id = new.id
  limit 1;

  if v_emp.id is not null then
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
      reviewed_at,
      created_at,
      updated_at
    )
    values (
      new.id,
      coalesce(v_emp.name, v_applicant_name),
      new.email,
      coalesce(v_emp.department, v_req_dept),
      v_req_title,
      v_emp.system_role,
      v_emp.department,
      v_emp.role,
      v_emp.id,
      'approved',
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
      updated_at = pg_catalog.now();
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
      new.email,
      v_req_dept,
      v_req_title,
      'pending',
      coalesce(new.created_at, pg_catalog.now()),
      pg_catalog.now()
    )
    on conflict (auth_user_id) do update set
      email = excluded.email,
      applicant_name = case
        when public.employee_registration_requests.status = 'pending'
        then coalesce(pg_catalog.nullif(excluded.applicant_name, ''), public.employee_registration_requests.applicant_name)
        else public.employee_registration_requests.applicant_name
      end,
      requested_department = case
        when public.employee_registration_requests.status = 'pending'
        then coalesce(pg_catalog.nullif(excluded.requested_department, ''), public.employee_registration_requests.requested_department)
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

revoke all on function public.handle_auth_user_registration_request() from public;

drop trigger if exists trg_on_auth_user_registration_request on auth.users;
create trigger trg_on_auth_user_registration_request
  after insert or update of email, raw_user_meta_data on auth.users
  for each row
  execute function public.handle_auth_user_registration_request();

-- Keep registration requests synced when public.employees is updated
create or replace function public.sync_employee_to_registration_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') and new.auth_user_id is not null then
    insert into public.employee_registration_requests (
      auth_user_id,
      applicant_name,
      email,
      requested_department,
      assigned_role,
      assigned_department,
      assigned_job_title,
      employee_id,
      status,
      reviewed_at,
      updated_at
    )
    values (
      new.auth_user_id,
      new.name,
      new.email,
      new.department,
      new.system_role,
      new.department,
      new.role,
      new.id,
      'approved',
      pg_catalog.now(),
      pg_catalog.now()
    )
    on conflict (auth_user_id) do update set
      applicant_name = excluded.applicant_name,
      email = excluded.email,
      assigned_role = excluded.assigned_role,
      assigned_department = excluded.assigned_department,
      assigned_job_title = excluded.assigned_job_title,
      employee_id = excluded.employee_id,
      status = 'approved',
      rejection_reason = null,
      reviewed_at = coalesce(public.employee_registration_requests.reviewed_at, pg_catalog.now()),
      updated_at = pg_catalog.now();
  end if;
  return new;
end;
$$;

revoke all on function public.sync_employee_to_registration_request() from public;

drop trigger if exists trg_sync_employee_to_registration_request on public.employees;
create trigger trg_sync_employee_to_registration_request
  after insert or update on public.employees
  for each row
  execute function public.sync_employee_to_registration_request();

-- Initial Administrator Bootstrap & Backfill of Existing auth.users
do $$
declare
  v_first_user record;
  v_admin_emp_id text;
begin
  if not exists (
    select 1
    from public.employees e
    where e.auth_user_id is not null
      and e.system_role = 'admin'
  ) then
    select u.id, u.email, u.raw_user_meta_data
    into v_first_user
    from auth.users u
    where u.email is not null
    order by
      (case when u.email_confirmed_at is not null then 0 else 1 end) asc,
      u.created_at asc
    limit 1;

    if v_first_user.id is not null then
      select e.id
      into v_admin_emp_id
      from public.employees e
      where pg_catalog.lower(e.email) = pg_catalog.lower(v_first_user.email)
      limit 1;

      if v_admin_emp_id is null then
        if not exists (select 1 from public.employees where id = 'emp-001' and auth_user_id is not null) then
          v_admin_emp_id := 'emp-admin-001';
        else
          v_admin_emp_id := 'emp-' || pg_catalog.substr(pg_catalog.replace(v_first_user.id::text, '-', ''), 1, 8);
        end if;
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
        v_admin_emp_id,
        v_first_user.id,
        coalesce(
          pg_catalog.nullif(pg_catalog.btrim(v_first_user.raw_user_meta_data ->> 'full_name'), ''),
          pg_catalog.initcap(pg_catalog.replace(pg_catalog.split_part(v_first_user.email, '@', 1), '.', ' '))
        ),
        'Workforce Intelligence Administrator',
        'Engineering',
        v_first_user.email,
        '#0078D4',
        'available',
        6.0,
        100,
        'admin'
      )
      on conflict (id) do update set
        auth_user_id = excluded.auth_user_id,
        email = excluded.email,
        system_role = 'admin',
        updated_at = pg_catalog.now();
    end if;
  end if;

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
  select
    u.id,
    coalesce(
      e.name,
      pg_catalog.nullif(pg_catalog.btrim(u.raw_user_meta_data ->> 'full_name'), ''),
      pg_catalog.nullif(pg_catalog.btrim(u.raw_user_meta_data ->> 'name'), ''),
      pg_catalog.initcap(pg_catalog.replace(pg_catalog.split_part(coalesce(u.email, 'User'), '@', 1), '.', ' '))
    ),
    coalesce(u.email, ''),
    coalesce(
      e.department,
      pg_catalog.nullif(pg_catalog.btrim(u.raw_user_meta_data ->> 'requested_department'), ''),
      pg_catalog.nullif(pg_catalog.btrim(u.raw_user_meta_data ->> 'department'), ''),
      'Engineering'
    ),
    pg_catalog.nullif(pg_catalog.btrim(u.raw_user_meta_data ->> 'requested_job_title'), ''),
    e.system_role,
    e.department,
    e.role,
    e.id,
    case when e.id is not null then 'approved' else 'pending' end,
    case when e.id is not null then 'System Provisioning' else null end,
    case when e.id is not null then pg_catalog.now() else null end,
    coalesce(u.created_at, pg_catalog.now()),
    pg_catalog.now()
  from auth.users u
  left join public.employees e on e.auth_user_id = u.id
  where u.email is not null
  on conflict (auth_user_id) do nothing;
end $$;

-- Sync Missing Registration Requests RPC
create or replace function public.sync_missing_registration_requests()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer := 0;
begin
  if not public.is_trusted_admin_context() then
    raise exception 'Access denied: only authorized administrators can synchronize registration requests.';
  end if;

  with inserted_rows as (
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
    select
      u.id,
      coalesce(
        e.name,
        pg_catalog.nullif(pg_catalog.btrim(u.raw_user_meta_data ->> 'full_name'), ''),
        pg_catalog.nullif(pg_catalog.btrim(u.raw_user_meta_data ->> 'name'), ''),
        pg_catalog.initcap(pg_catalog.replace(pg_catalog.split_part(coalesce(u.email, 'User'), '@', 1), '.', ' '))
      ),
      coalesce(u.email, ''),
      coalesce(
        e.department,
        pg_catalog.nullif(pg_catalog.btrim(u.raw_user_meta_data ->> 'requested_department'), ''),
        pg_catalog.nullif(pg_catalog.btrim(u.raw_user_meta_data ->> 'department'), ''),
        'Engineering'
      ),
      pg_catalog.nullif(pg_catalog.btrim(u.raw_user_meta_data ->> 'requested_job_title'), ''),
      e.system_role,
      e.department,
      e.role,
      e.id,
      case when e.id is not null then 'approved' else 'pending' end,
      case when e.id is not null then 'System Provisioning' else null end,
      case when e.id is not null then pg_catalog.now() else null end,
      coalesce(u.created_at, pg_catalog.now()),
      pg_catalog.now()
    from auth.users u
    left join public.employees e on e.auth_user_id = u.id
    where u.email is not null
    on conflict (auth_user_id) do nothing
    returning 1
  )
  select count(*) into v_inserted from inserted_rows;

  return pg_catalog.jsonb_build_object(
    'synced', true,
    'newly_added', v_inserted
  );
end;
$$;

revoke all on function public.sync_missing_registration_requests() from public;
grant execute on function public.sync_missing_registration_requests() to authenticated, service_role;

-- Applicant RPC: Ensure & Retrieve Own Registration Request
create or replace function public.ensure_my_registration_request(
  p_applicant_name text default null,
  p_requested_department text default null,
  p_requested_job_title text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_user record;
  v_emp record;
  v_req record;
  v_name text;
  v_dept text;
  v_title text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Authentication required.';
  end if;

  select u.id, u.email, u.created_at, u.raw_user_meta_data
  into v_user
  from auth.users u
  where u.id = v_uid;

  if v_user.id is null then
    raise exception 'Authenticated user record not found.';
  end if;

  select e.id, e.name, e.role, e.department, e.system_role
  into v_emp
  from public.employees e
  where e.auth_user_id = v_uid
  limit 1;

  v_name := coalesce(
    pg_catalog.nullif(pg_catalog.btrim(p_applicant_name), ''),
    pg_catalog.nullif(pg_catalog.btrim(v_user.raw_user_meta_data ->> 'full_name'), ''),
    pg_catalog.nullif(pg_catalog.btrim(v_user.raw_user_meta_data ->> 'name'), ''),
    pg_catalog.initcap(pg_catalog.replace(pg_catalog.split_part(coalesce(v_user.email, 'User'), '@', 1), '.', ' '))
  );

  v_dept := coalesce(
    pg_catalog.nullif(pg_catalog.btrim(p_requested_department), ''),
    pg_catalog.nullif(pg_catalog.btrim(v_user.raw_user_meta_data ->> 'requested_department'), ''),
    pg_catalog.nullif(pg_catalog.btrim(v_user.raw_user_meta_data ->> 'department'), ''),
    'Engineering'
  );

  v_title := coalesce(
    pg_catalog.nullif(pg_catalog.btrim(p_requested_job_title), ''),
    pg_catalog.nullif(pg_catalog.btrim(v_user.raw_user_meta_data ->> 'requested_job_title'), '')
  );

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
    created_at,
    updated_at
  )
  values (
    v_uid,
    coalesce(v_emp.name, v_name),
    coalesce(v_user.email, ''),
    coalesce(v_emp.department, v_dept),
    v_title,
    v_emp.system_role,
    v_emp.department,
    v_emp.role,
    v_emp.id,
    case when v_emp.id is not null then 'approved' else 'pending' end,
    coalesce(v_user.created_at, pg_catalog.now()),
    pg_catalog.now()
  )
  on conflict (auth_user_id) do update set
    applicant_name = case
      when public.employee_registration_requests.status = 'pending' and pg_catalog.nullif(pg_catalog.btrim(p_applicant_name), '') is not null
      then pg_catalog.btrim(p_applicant_name)
      else public.employee_registration_requests.applicant_name
    end,
    requested_department = case
      when public.employee_registration_requests.status = 'pending' and pg_catalog.nullif(pg_catalog.btrim(p_requested_department), '') is not null
      then pg_catalog.btrim(p_requested_department)
      else public.employee_registration_requests.requested_department
    end,
    requested_job_title = case
      when public.employee_registration_requests.status = 'pending' and p_requested_job_title is not null
      then pg_catalog.nullif(pg_catalog.btrim(p_requested_job_title), '')
      else public.employee_registration_requests.requested_job_title
    end,
    updated_at = pg_catalog.now()
  returning * into v_req;

  return pg_catalog.to_jsonb(v_req);
end;
$$;

revoke all on function public.ensure_my_registration_request(text, text, text) from public;
grant execute on function public.ensure_my_registration_request(text, text, text) to authenticated, service_role;

-- Approve Employee Registration Request RPC
create or replace function public.approve_employee_registration_request(
  p_request_id uuid,
  p_assigned_role text,
  p_assigned_department text,
  p_assigned_job_title text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req record;
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

  v_reviewer_id := public.current_employee_id();
  if v_reviewer_id is not null then
    select e.name
    into v_reviewer_name
    from public.employees e
    where e.id = v_reviewer_id;
  end if;
  v_reviewer_name := coalesce(v_reviewer_name, 'Organization Administrator');

  v_job_title := coalesce(
    pg_catalog.nullif(pg_catalog.btrim(p_assigned_job_title), ''),
    pg_catalog.nullif(pg_catalog.btrim(v_req.requested_job_title), ''),
    case v_clean_role
      when 'admin' then 'Workforce Administrator'
      when 'hr' then 'HR People Operations Lead'
      when 'manager' then 'Workforce Delivery Manager'
      else 'Workforce Specialist'
    end
  );

  select e.id
  into v_employee_id
  from public.employees e
  where e.auth_user_id = v_req.auth_user_id
     or pg_catalog.lower(e.email) = pg_catalog.lower(v_req.email)
  order by (case when e.auth_user_id = v_req.auth_user_id then 0 else 1 end) asc
  limit 1;

  if v_employee_id is null then
    v_employee_id := coalesce(
      v_req.employee_id,
      'emp-' || pg_catalog.substr(pg_catalog.replace(v_req.auth_user_id::text, '-', ''), 1, 8)
    );
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
    v_req.email,
    '#0078D4',
    'available',
    3.0,
    100,
    v_clean_role
  )
  on conflict (id) do update set
    auth_user_id = excluded.auth_user_id,
    name = excluded.name,
    role = excluded.role,
    department = excluded.department,
    email = excluded.email,
    system_role = excluded.system_role,
    updated_at = pg_catalog.now();

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

  insert into public.activities (id, message, type, timestamp)
  values (
    'act-' || pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 12),
    'Approved employee registration for ' || v_req.applicant_name || ' (' || v_clean_dept || ' · ' || pg_catalog.upper(v_clean_role) || ')',
    'system',
    pg_catalog.now()
  );

  return pg_catalog.to_jsonb(v_req);
end;
$$;

revoke all on function public.approve_employee_registration_request(uuid, text, text, text) from public;
grant execute on function public.approve_employee_registration_request(uuid, text, text, text) to authenticated, service_role;

-- Reject Employee Registration Request RPC
create or replace function public.reject_employee_registration_request(
  p_request_id uuid,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req record;
  v_reviewer_id text;
  v_reviewer_name text;
  v_clean_reason text;
begin
  if not public.is_trusted_admin_context() then
    raise exception 'Access denied: only authorized administrators can reject employee registration requests.';
  end if;

  if p_request_id is null then
    raise exception 'Validation error: p_request_id is required.';
  end if;

  select *
  into v_req
  from public.employee_registration_requests
  where id = p_request_id
  for update;

  if v_req.id is null then
    raise exception 'Not found: registration request (%) does not exist.', p_request_id;
  end if;

  if v_req.auth_user_id = auth.uid() then
    raise exception 'Validation error: you cannot reject your own active administrator account.';
  end if;

  v_reviewer_id := public.current_employee_id();
  if v_reviewer_id is not null then
    select e.name
    into v_reviewer_name
    from public.employees e
    where e.id = v_reviewer_id;
  end if;
  v_reviewer_name := coalesce(v_reviewer_name, 'Organization Administrator');
  v_clean_reason := pg_catalog.nullif(pg_catalog.btrim(coalesce(p_rejection_reason, '')), '');

  update public.employees
  set auth_user_id = null,
      updated_at = pg_catalog.now()
  where auth_user_id = v_req.auth_user_id;

  update auth.users
  set raw_app_meta_data = (
        coalesce(raw_app_meta_data, '{}'::jsonb) - 'employee_id' - 'system_role' - 'department' - 'job_title'
      ) || pg_catalog.jsonb_build_object(
        'role', 'unassigned',
        'registration_status', 'rejected'
      ),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || pg_catalog.jsonb_build_object(
          'role', 'unassigned',
          'requires_admin_mapping', true,
          'registration_status', 'rejected'
        ) - 'employee_id',
      updated_at = pg_catalog.now()
  where id = v_req.auth_user_id;

  update public.employee_registration_requests
  set status = 'rejected',
      reviewer_id = v_reviewer_id,
      reviewer_name = v_reviewer_name,
      reviewed_at = pg_catalog.now(),
      rejection_reason = v_clean_reason,
      updated_at = pg_catalog.now()
  where id = p_request_id
  returning * into v_req;

  insert into public.activities (id, message, type, timestamp)
  values (
    'act-' || pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 12),
    'Rejected employee registration request for ' || v_req.applicant_name || ' (' || v_req.email || ')',
    'system',
    pg_catalog.now()
  );

  return pg_catalog.to_jsonb(v_req);
end;
$$;

revoke all on function public.reject_employee_registration_request(uuid, text) from public;
grant execute on function public.reject_employee_registration_request(uuid, text) to authenticated, service_role;

-- RLS Policies
alter table public.employee_registration_requests enable row level security;

drop policy if exists "Applicants can view their own registration request" on public.employee_registration_requests;
create policy "Applicants can view their own registration request"
  on public.employee_registration_requests for select
  to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists "Authorized administrators can view all registration requests" on public.employee_registration_requests;
create policy "Authorized administrators can view all registration requests"
  on public.employee_registration_requests for select
  to authenticated
  using (public.current_system_role() = 'admin');

drop policy if exists "Applicants can insert their own pending registration request" on public.employee_registration_requests;
create policy "Applicants can insert their own pending registration request"
  on public.employee_registration_requests for insert
  to authenticated
  with check (
    auth_user_id = auth.uid()
    and status = 'pending'
    and assigned_role is null
    and employee_id is null
    and reviewer_id is null
  );

drop policy if exists "Authorized administrators can insert registration requests" on public.employee_registration_requests;
create policy "Authorized administrators can insert registration requests"
  on public.employee_registration_requests for insert
  to authenticated
  with check (public.current_system_role() = 'admin');

drop policy if exists "Applicants can update their own pending request details" on public.employee_registration_requests;
create policy "Applicants can update their own pending request details"
  on public.employee_registration_requests for update
  to authenticated
  using (
    auth_user_id = auth.uid()
    and status = 'pending'
  )
  with check (
    auth_user_id = auth.uid()
    and status = 'pending'
    and assigned_role is null
    and employee_id is null
    and reviewer_id is null
  );

drop policy if exists "Authorized administrators can update registration requests" on public.employee_registration_requests;
create policy "Authorized administrators can update registration requests"
  on public.employee_registration_requests for update
  to authenticated
  using (public.current_system_role() = 'admin')
  with check (public.current_system_role() = 'admin');

drop policy if exists "Authorized administrators can delete registration requests" on public.employee_registration_requests;
create policy "Authorized administrators can delete registration requests"
  on public.employee_registration_requests for delete
  to authenticated
  using (public.current_system_role() = 'admin');
