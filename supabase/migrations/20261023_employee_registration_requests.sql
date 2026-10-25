-- =============================================================================
-- TOGETHERLY WORKFORCE INTELLIGENCE
-- Incremental Migration: Employee Registration & Verification Queue
-- File: supabase/migrations/20261023_employee_registration_requests.sql
--
-- PURPOSE:
--   Minimal, non-destructive incremental migration for the populated Togetherly
--   production database. Creates `public.employee_registration_requests`, its
--   indexes, security guard trigger, signup/employee sync triggers, RLS policies,
--   and registration queue RPCs.
--
-- PRODUCTION COMPATIBILITY & SAFETY GUARANTEES:
--   1. Preserves existing production objects: Does NOT replace, drop, or
--      recreate `public.current_employee_id()`, `public.current_system_role()`,
--      `public.is_reviewer_or_admin()`, `public.is_trusted_admin_context()`,
--      `public.sync_employee_claims_to_auth_user()`,
--      `public.provision_workforce_user(...)`, or existing `public.employees`
--      and `public.activities` table definitions, triggers, or policies.
--   2. No recursive trigger loops: `trg_on_auth_user_registration_request`
--      fires only `AFTER INSERT OR UPDATE OF email ON auth.users` (never on
--      `raw_user_meta_data` or `raw_app_meta_data`) and never mutates
--      `public.employees`.
--   3. No unverified or email-only auto-linking: Registration queue triggers,
--      backfill, and synchronization never modify `public.employees.auth_user_id`
--      and never link accounts based solely on a matching email address.
--   4. Rejected-account protection: Synchronization, triggers, and backfill
--      never overwrite `rejected` requests or resurrect rejected accounts to
--      `approved`. A dedicated `BEFORE INSERT OR UPDATE` trigger on
--      `public.employees` (`trg_zz_prevent_rejected_employee_identity_link`,
--      which fires alphabetically after `trg_employees_security_guard`) ensures
--      that `enforce_employees_security_guard()`, `handle_verified_auth_user_link()`,
--      or `claim_preprovisioned_employee_profile()` cannot automatically relink
--      a rejected user to a matching `public.employees` row unless an
--      administrator explicitly approves the request via
--      `approve_employee_registration_request(...)`.
--   5. Self-action & collision protection: Prevents administrators from
--      approving or rejecting their own active account, requires verified email
--      before approval, and raises a clear error on email collisions with
--      another linked employee record.
-- =============================================================================

-- =============================================================================
-- 0. READ-ONLY PREREQUISITE VERIFICATION
-- Verifies that the base schema and security functions exist in production
-- without replacing or altering any existing tables, functions, or triggers.
-- =============================================================================

do $$
begin
  if pg_catalog.to_regclass('public.employees') is null then
    raise exception 'Prerequisite table public.employees does not exist. Apply 20261016_initial_schema.sql first.';
  end if;

  if pg_catalog.to_regprocedure('public.current_system_role()') is null
     or pg_catalog.to_regprocedure('public.is_reviewer_or_admin()') is null
     or pg_catalog.to_regprocedure('public.is_trusted_admin_context()') is null
     or pg_catalog.to_regprocedure('public.provision_workforce_user(text,text,text,text,text,text,text)') is null then
    raise exception 'Prerequisite security functions from 20261016_initial_schema.sql are missing.';
  end if;
end $$;

-- =============================================================================
-- 1. TABLE & INDEXES: public.employee_registration_requests
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

-- =============================================================================
-- 2. INTEGRITY & SECURITY GUARD TRIGGER ON employee_registration_requests
-- Prevents non-admin callers from forging status, assigned_role, or reviewer fields
-- =============================================================================

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
  new.requested_department := coalesce(nullif(pg_catalog.btrim(new.requested_department), ''), 'Engineering');

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

-- =============================================================================
-- 3. AUTOMATIC QUEUE CAPTURE TRIGGER ON auth.users
-- - Fires ONLY on `AFTER INSERT OR UPDATE OF email ON auth.users` so metadata
--   updates from `trg_sync_employee_claims_to_auth_user` never re-trigger it.
-- - Never modifies `public.employees`.
-- - Only marks a request `approved` if `public.employees.auth_user_id = new.id`
--   and `new.email_confirmed_at is not null` and the request is not `rejected`.
-- =============================================================================

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
    into v_emp
    from public.employees e
    where e.auth_user_id = new.id
    limit 1;
  end if;

  if v_emp.id is not null
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
      coalesce(v_emp.name, v_applicant_name),
      pg_catalog.btrim(new.email),
      coalesce(v_emp.department, v_req_dept),
      v_req_title,
      v_emp.system_role,
      v_emp.department,
      v_emp.role,
      v_emp.id,
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

revoke all on function public.handle_auth_user_registration_request() from public;

drop trigger if exists trg_on_auth_user_registration_request on auth.users;
create trigger trg_on_auth_user_registration_request
  after insert or update of email on auth.users
  for each row
  execute function public.handle_auth_user_registration_request();

-- =============================================================================
-- 4. REJECTION LINK GUARD & SYNC TRIGGERS ON public.employees
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 4.1 BEFORE Trigger: public.prevent_rejected_employee_identity_link()
-- Trigger name: `trg_zz_prevent_rejected_employee_identity_link`
--
-- PostgreSQL fires multiple BEFORE row-level triggers in alphabetical order by
-- trigger name. Because `trg_zz_prevent_rejected_employee_identity_link` sorts
-- after the existing `trg_employees_security_guard` trigger, all existing
-- security validations run first. If `enforce_employees_security_guard()`,
-- `handle_verified_auth_user_link()`, `claim_preprovisioned_employee_profile()`,
-- or any direct table write attempts to link `new.auth_user_id` to an account
-- whose registration status is `rejected` in `public.employee_registration_requests`
-- or `auth.users.raw_app_meta_data`, this trigger clears `new.auth_user_id := null`
-- before the row is written to disk.
-- -----------------------------------------------------------------------------
create or replace function public.prevent_rejected_employee_identity_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_rejected boolean := false;
begin
  if new.auth_user_id is null then
    return new;
  end if;

  -- Prevent automatic or manual relinking of any account whose registration is rejected.
  -- Only approve_employee_registration_request() (or an authorized administrator updating
  -- the registration request status away from 'rejected' first) can clear this state.
  select exists (
    select 1
    from public.employee_registration_requests r
    where r.auth_user_id = new.auth_user_id
      and r.status = 'rejected'
  ) or exists (
    select 1
    from auth.users u
    where u.id = new.auth_user_id
      and coalesce(u.raw_app_meta_data ->> 'registration_status', '') = 'rejected'
  )
  into v_is_rejected;

  if v_is_rejected then
    new.auth_user_id := null;
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_rejected_employee_identity_link() from public;

drop trigger if exists trg_zz_prevent_rejected_employee_identity_link on public.employees;
create trigger trg_zz_prevent_rejected_employee_identity_link
  before insert or update on public.employees
  for each row
  execute function public.prevent_rejected_employee_identity_link();

-- -----------------------------------------------------------------------------
-- 4.2 AFTER Trigger: public.sync_employee_to_registration_request()
-- Keeps the queue record synchronized when an employee record is linked or
-- updated in `public.employees`, but NEVER transitions a `rejected` request
-- back to `approved`. Explicit administrator re-review must go through
-- `approve_employee_registration_request(...)`.
-- -----------------------------------------------------------------------------
create or replace function public.sync_employee_to_registration_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') and new.auth_user_id is not null then
    -- Never create or update an approved queue entry for a rejected account via trigger sync
    if exists (
      select 1
      from public.employee_registration_requests r
      where r.auth_user_id = new.auth_user_id
        and r.status = 'rejected'
    ) or exists (
      select 1
      from auth.users u
      where u.id = new.auth_user_id
        and coalesce(u.raw_app_meta_data ->> 'registration_status', '') = 'rejected'
    ) then
      return new;
    end if;

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
      updated_at = pg_catalog.now()
    where public.employee_registration_requests.status != 'rejected';
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

-- =============================================================================
-- 5. SAFE, READ-ONLY BACKFILL OF REGISTRATION REQUESTS
-- - Does NOT modify `public.employees` or `public.employees.auth_user_id`.
-- - Records `auth.users` accounts already linked via `e.auth_user_id = u.id`
--   (with confirmed email and non-rejected status) as `approved`.
-- - Queues unlinked `auth.users` accounts as `pending` (or `rejected` if
--   already marked rejected in `raw_app_meta_data`).
-- - Never overwrites existing `rejected` rows when re-run.
-- =============================================================================

do $$
begin
  -- 5.1 Backfill already-linked, email-verified employees into the queue as 'approved'
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
    e.name,
    coalesce(nullif(pg_catalog.btrim(u.email), ''), e.email),
    e.department,
    e.role,
    e.system_role,
    e.department,
    e.role,
    e.id,
    'approved',
    'System Provisioning',
    coalesce(e.updated_at, e.created_at, pg_catalog.now()),
    coalesce(u.created_at, e.created_at, pg_catalog.now()),
    pg_catalog.now()
  from auth.users u
  join public.employees e
    on e.auth_user_id = u.id
  where u.email is not null
    and u.email_confirmed_at is not null
    and coalesce(u.raw_app_meta_data ->> 'registration_status', '') != 'rejected'
  on conflict (auth_user_id) do update set
    assigned_role = excluded.assigned_role,
    assigned_department = excluded.assigned_department,
    assigned_job_title = excluded.assigned_job_title,
    employee_id = excluded.employee_id,
    status = 'approved',
    rejection_reason = null,
    reviewed_at = coalesce(public.employee_registration_requests.reviewed_at, excluded.reviewed_at),
    updated_at = pg_catalog.now()
  where public.employee_registration_requests.status != 'rejected';

  -- 5.2 Backfill unlinked auth.users accounts as 'pending' (or 'rejected' if flagged)
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
  select
    u.id,
    coalesce(
      nullif(pg_catalog.btrim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(pg_catalog.btrim(u.raw_user_meta_data ->> 'name'), ''),
      pg_catalog.initcap(pg_catalog.replace(pg_catalog.split_part(coalesce(u.email, 'Applicant'), '@', 1), '.', ' '))
    ),
    pg_catalog.btrim(u.email),
    coalesce(
      nullif(pg_catalog.btrim(u.raw_user_meta_data ->> 'requested_department'), ''),
      nullif(pg_catalog.btrim(u.raw_user_meta_data ->> 'department'), ''),
      'Engineering'
    ),
    nullif(pg_catalog.btrim(u.raw_user_meta_data ->> 'requested_job_title'), ''),
    case
      when coalesce(u.raw_app_meta_data ->> 'registration_status', '') = 'rejected' then 'rejected'
      else 'pending'
    end,
    coalesce(u.created_at, pg_catalog.now()),
    pg_catalog.now()
  from auth.users u
  where u.email is not null
    and pg_catalog.btrim(u.email) != ''
    and not exists (
      select 1
      from public.employees e
      where e.auth_user_id = u.id
    )
  on conflict (auth_user_id) do nothing;
end $$;

-- =============================================================================
-- 6. ADMINISTRATOR RPC: sync_missing_registration_requests()
-- Synchronizes `auth.users` with `public.employee_registration_requests`
-- without mutating `public.employees`, without matching unlinked rows by email,
-- and without overwriting existing `rejected` requests.
-- =============================================================================

create or replace function public.sync_missing_registration_requests()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_approved_synced integer := 0;
  v_pending_inserted integer := 0;
begin
  if not public.is_trusted_admin_context() then
    raise exception 'Access denied: only authorized administrators can synchronize registration requests.';
  end if;

  -- 1. Reconcile actively linked, email-verified employees as 'approved' (never overwriting 'rejected')
  with synced_approved as (
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
      e.name,
      coalesce(nullif(pg_catalog.btrim(u.email), ''), e.email),
      e.department,
      e.role,
      e.system_role,
      e.department,
      e.role,
      e.id,
      'approved',
      'System Provisioning',
      coalesce(e.updated_at, e.created_at, pg_catalog.now()),
      coalesce(u.created_at, e.created_at, pg_catalog.now()),
      pg_catalog.now()
    from auth.users u
    join public.employees e
      on e.auth_user_id = u.id
    where u.email is not null
      and u.email_confirmed_at is not null
      and coalesce(u.raw_app_meta_data ->> 'registration_status', '') != 'rejected'
    on conflict (auth_user_id) do update set
      assigned_role = excluded.assigned_role,
      assigned_department = excluded.assigned_department,
      assigned_job_title = excluded.assigned_job_title,
      employee_id = excluded.employee_id,
      status = 'approved',
      rejection_reason = null,
      reviewed_at = coalesce(public.employee_registration_requests.reviewed_at, excluded.reviewed_at),
      updated_at = pg_catalog.now()
    where public.employee_registration_requests.status != 'rejected'
      and (
        public.employee_registration_requests.status != 'approved'
        or public.employee_registration_requests.employee_id is distinct from excluded.employee_id
        or public.employee_registration_requests.assigned_role is distinct from excluded.assigned_role
      )
    returning 1
  )
  select count(*) into v_approved_synced from synced_approved;

  -- 2. Insert unlinked auth.users accounts that do not yet have a request row
  with inserted_pending as (
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
    select
      u.id,
      coalesce(
        nullif(pg_catalog.btrim(u.raw_user_meta_data ->> 'full_name'), ''),
        nullif(pg_catalog.btrim(u.raw_user_meta_data ->> 'name'), ''),
        pg_catalog.initcap(pg_catalog.replace(pg_catalog.split_part(coalesce(u.email, 'Applicant'), '@', 1), '.', ' '))
      ),
      pg_catalog.btrim(u.email),
      coalesce(
        nullif(pg_catalog.btrim(u.raw_user_meta_data ->> 'requested_department'), ''),
        nullif(pg_catalog.btrim(u.raw_user_meta_data ->> 'department'), ''),
        'Engineering'
      ),
      nullif(pg_catalog.btrim(u.raw_user_meta_data ->> 'requested_job_title'), ''),
      case
        when coalesce(u.raw_app_meta_data ->> 'registration_status', '') = 'rejected' then 'rejected'
        else 'pending'
      end,
      coalesce(u.created_at, pg_catalog.now()),
      pg_catalog.now()
    from auth.users u
    where u.email is not null
      and pg_catalog.btrim(u.email) != ''
      and not exists (
        select 1
        from public.employees e
        where e.auth_user_id = u.id
      )
    on conflict (auth_user_id) do nothing
    returning 1
  )
  select count(*) into v_pending_inserted from inserted_pending;

  return pg_catalog.jsonb_build_object(
    'synced', true,
    'newly_added', v_pending_inserted,
    'approved_reconciled', v_approved_synced
  );
end;
$$;

revoke all on function public.sync_missing_registration_requests() from public;
grant execute on function public.sync_missing_registration_requests() to authenticated, service_role;

-- =============================================================================
-- 7. APPLICANT RPC: ensure_my_registration_request(...)
-- Allows an authenticated user to ensure their registration request row exists
-- and optionally update their name, requested department, or requested job title
-- while the application is still in `pending` status. Never links accounts by
-- email and never overrides a `rejected` status.
-- =============================================================================

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
  v_initial_status text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Authentication required.';
  end if;

  select u.id, u.email, u.email_confirmed_at, u.created_at, u.raw_user_meta_data, u.raw_app_meta_data
  into v_user
  from auth.users u
  where u.id = v_uid;

  if v_user.id is null then
    raise exception 'Authenticated user record not found.';
  end if;

  -- Strictly check whether caller is already linked in public.employees by auth_user_id
  if v_user.email_confirmed_at is not null then
    select e.id, e.name, e.role, e.department, e.system_role
    into v_emp
    from public.employees e
    where e.auth_user_id = v_uid
    limit 1;
  end if;

  v_name := coalesce(
    nullif(pg_catalog.btrim(p_applicant_name), ''),
    nullif(pg_catalog.btrim(v_user.raw_user_meta_data ->> 'full_name'), ''),
    nullif(pg_catalog.btrim(v_user.raw_user_meta_data ->> 'name'), ''),
    pg_catalog.initcap(pg_catalog.replace(pg_catalog.split_part(coalesce(v_user.email, 'User'), '@', 1), '.', ' '))
  );

  v_dept := coalesce(
    nullif(pg_catalog.btrim(p_requested_department), ''),
    nullif(pg_catalog.btrim(v_user.raw_user_meta_data ->> 'requested_department'), ''),
    nullif(pg_catalog.btrim(v_user.raw_user_meta_data ->> 'department'), ''),
    'Engineering'
  );

  v_title := coalesce(
    nullif(pg_catalog.btrim(p_requested_job_title), ''),
    nullif(pg_catalog.btrim(v_user.raw_user_meta_data ->> 'requested_job_title'), '')
  );

  if coalesce(v_user.raw_app_meta_data ->> 'registration_status', '') = 'rejected' then
    v_initial_status := 'rejected';
  elsif v_emp.id is not null then
    v_initial_status := 'approved';
  else
    v_initial_status := 'pending';
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
    created_at,
    updated_at
  )
  values (
    v_uid,
    coalesce(v_emp.name, v_name),
    pg_catalog.btrim(coalesce(v_user.email, '')),
    coalesce(v_emp.department, v_dept),
    v_title,
    case when v_initial_status = 'approved' then v_emp.system_role else null end,
    case when v_initial_status = 'approved' then v_emp.department else null end,
    case when v_initial_status = 'approved' then v_emp.role else null end,
    case when v_initial_status = 'approved' then v_emp.id else null end,
    v_initial_status,
    coalesce(v_user.created_at, pg_catalog.now()),
    pg_catalog.now()
  )
  on conflict (auth_user_id) do update set
    applicant_name = case
      when public.employee_registration_requests.status = 'pending'
           and nullif(pg_catalog.btrim(p_applicant_name), '') is not null
      then pg_catalog.btrim(p_applicant_name)
      else public.employee_registration_requests.applicant_name
    end,
    requested_department = case
      when public.employee_registration_requests.status = 'pending'
           and nullif(pg_catalog.btrim(p_requested_department), '') is not null
      then pg_catalog.btrim(p_requested_department)
      else public.employee_registration_requests.requested_department
    end,
    requested_job_title = case
      when public.employee_registration_requests.status = 'pending'
           and p_requested_job_title is not null
      then nullif(pg_catalog.btrim(p_requested_job_title), '')
      else public.employee_registration_requests.requested_job_title
    end,
    updated_at = pg_catalog.now()
  returning * into v_req;

  return pg_catalog.to_jsonb(v_req);
end;
$$;

revoke all on function public.ensure_my_registration_request(text, text, text) from public;
grant execute on function public.ensure_my_registration_request(text, text, text) to authenticated, service_role;

-- =============================================================================
-- 8. ADMINISTRATOR RPC: approve_employee_registration_request(...)
-- - Restricted to `public.is_trusted_admin_context()`.
-- - Prevents administrators from approving/modifying their own account.
-- - Requires the applicant's `auth.users` email to be confirmed before granting
--   employee or administrator privileges.
-- - Resolves reviewer identity directly via `auth.uid()` against `public.employees`.
-- - Detects email collisions with other linked accounts and raises a clear error.
-- =============================================================================

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
      3.0,
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
$$;

revoke all on function public.approve_employee_registration_request(uuid, text, text, text) from public;
grant execute on function public.approve_employee_registration_request(uuid, text, text, text) to authenticated, service_role;

-- =============================================================================
-- 9. ADMINISTRATOR RPC: reject_employee_registration_request(...)
-- - Restricted to `public.is_trusted_admin_context()`.
-- - Prevents administrators from rejecting their own account or any active
--   administrator profile.
-- - Resolves reviewer identity directly via `auth.uid()` against `public.employees`.
-- - Persists `status = 'rejected'` in `public.employee_registration_requests`
--   and `registration_status = 'rejected'` in `auth.users` BEFORE unlinking
--   `public.employees`, so `trg_zz_prevent_rejected_employee_identity_link`
--   guarantees `auth_user_id` remains NULL even if `enforce_employees_security_guard()`
--   attempts to relink by matching email.
-- =============================================================================

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

  if auth.uid() is not null and v_req.auth_user_id = auth.uid() then
    raise exception 'Validation error: you cannot reject your own active administrator account.';
  end if;

  if exists (
    select 1
    from public.employees e
    where e.auth_user_id = v_req.auth_user_id
      and e.system_role = 'admin'
  ) then
    raise exception 'Security policy: cannot reject an active administrator account from the registration queue.';
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
  v_clean_reason := nullif(pg_catalog.btrim(coalesce(p_rejection_reason, '')), '');

  -- 1. Update registration request status to 'rejected' FIRST so that
  --    trg_zz_prevent_rejected_employee_identity_link and
  --    trg_sync_employee_to_registration_request immediately observe the
  --    rejected state when public.employees is updated below.
  update public.employee_registration_requests
  set status = 'rejected',
      assigned_role = null,
      assigned_department = null,
      assigned_job_title = null,
      employee_id = null,
      reviewer_id = v_reviewer_id,
      reviewer_name = v_reviewer_name,
      reviewed_at = pg_catalog.now(),
      rejection_reason = v_clean_reason,
      updated_at = pg_catalog.now()
  where id = p_request_id
  returning * into v_req;

  -- 2. Mark user's auth metadata as rejected / unmapped
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

  -- 3. Unlink any non-admin employee record previously linked to this auth_user_id.
  --    Even if trg_employees_security_guard (firing 1st) attempts to relink by
  --    matching confirmed email, trg_zz_prevent_rejected_employee_identity_link
  --    (firing 2nd) sees status = 'rejected' from Step 1 and forces
  --    new.auth_user_id := null before the row is written to disk.
  update public.employees
  set auth_user_id = null,
      updated_at = pg_catalog.now()
  where auth_user_id = v_req.auth_user_id
    and system_role != 'admin';

  -- Record organizational activity (non-blocking)
  begin
    insert into public.activities (id, message, type, timestamp)
    values (
      'act-' || pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 12),
      'Rejected employee registration request for ' || v_req.applicant_name || ' (' || v_req.email || ')',
      'system',
      pg_catalog.now()
    );
  exception when others then
    null;
  end;

  return pg_catalog.to_jsonb(v_req);
end;
$$;

revoke all on function public.reject_employee_registration_request(uuid, text) from public;
grant execute on function public.reject_employee_registration_request(uuid, text) to authenticated, service_role;

-- =============================================================================
-- 10. ROW-LEVEL SECURITY (RLS) POLICIES & TABLE GRANTS
-- =============================================================================

alter table public.employee_registration_requests enable row level security;

grant select, insert, update, delete on table public.employee_registration_requests to authenticated, service_role;

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

-- =============================================================================
-- 11. RELOAD POSTGREST SCHEMA CACHE
-- Ensures Supabase REST / RPC endpoints immediately recognize the new table & RPCs
-- =============================================================================
notify pgrst, 'reload schema';
