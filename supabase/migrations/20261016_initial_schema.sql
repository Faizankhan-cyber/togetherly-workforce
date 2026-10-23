-- =============================================================================
-- Migration: 20261016_initial_schema.sql
-- Description: Togetherly Workforce Intelligence - Production Schema, RBAC,
--              Workforce Provisioning & Training Verification Security
-- Notes:
--   - Non-destructive and idempotent (safe to re-run without dropping tables/data)
--   - All SECURITY DEFINER functions use a fixed empty search_path = '' and
--     fully schema-qualified object references (pg_catalog, public, auth, storage)
--   - Enforces column-level and row-level security via triggers + RLS policies
--   - Prevents self-approval, reviewer impersonation, role escalation, and
--     audit trail forgery
--   - Securely links verified auth.users accounts to public.employees and syncs
--     app_metadata claims required by AuthContext without allowing self-service
--     administrator assignment
-- =============================================================================

-- Enable pgcrypto extension if not already enabled
create extension if not exists "pgcrypto";

-- =============================================================================
-- 1. SKILLS TABLE
-- =============================================================================
create table if not exists public.skills (
  id text primary key,
  name text not null,
  category text not null,
  created_at timestamptz not null default pg_catalog.now()
);

-- Seed baseline skills catalog idempotently so foreign keys succeed immediately
insert into public.skills (id, name, category)
values
  ('skl-react', 'React', 'Frontend'),
  ('skl-typescript', 'TypeScript', 'Languages'),
  ('skl-node', 'Node.js', 'Backend'),
  ('skl-python', 'Python', 'Languages'),
  ('skl-go', 'Go', 'Languages'),
  ('skl-sql', 'SQL', 'Database'),
  ('skl-postgres', 'PostgreSQL', 'Database'),
  ('skl-aws', 'AWS', 'Cloud & DevOps'),
  ('skl-docker', 'Docker', 'Cloud & DevOps'),
  ('skl-kubernetes', 'Kubernetes', 'Cloud & DevOps'),
  ('skl-terraform', 'Terraform', 'Cloud & DevOps'),
  ('skl-uiux', 'UI/UX Design', 'Design'),
  ('skl-ml', 'Machine Learning', 'Data & AI'),
  ('skl-qa', 'QA Automation', 'Quality'),
  ('skl-security', 'Application Security', 'Security'),
  ('skl-graphQL', 'GraphQL', 'Backend'),
  ('skl-linux', 'Linux', 'Infrastructure')
on conflict (id) do nothing;

-- =============================================================================
-- 2. EMPLOYEES TABLE
-- Supports workforce profiles and links to Supabase auth.users via auth_user_id
-- =============================================================================
create table if not exists public.employees (
  id text primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  role text not null, -- job title (e.g., 'Senior Full Stack Engineer')
  department text not null,
  email text not null unique,
  avatar_color text not null default '#8B5CF6',
  availability text not null default 'available'
    check (availability in ('available', 'busy', 'unavailable', 'partially-available')),
  years_experience numeric(4, 1) not null default 0
    check (years_experience >= 0),
  target_utilization integer not null default 100
    check (target_utilization between 0 and 200),
  system_role text not null default 'employee'
    check (system_role in ('employee', 'manager', 'hr', 'admin')),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index if not exists idx_employees_auth_user_id on public.employees(auth_user_id);
create index if not exists idx_employees_email on public.employees(email);
create unique index if not exists idx_employees_email_lower on public.employees(pg_catalog.lower(email));
create index if not exists idx_employees_department on public.employees(department);
create index if not exists idx_employees_system_role on public.employees(system_role);

-- =============================================================================
-- 3. EMPLOYEE SKILLS TABLE
-- =============================================================================
create table if not exists public.employee_skills (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  employee_id text not null references public.employees(id) on delete cascade,
  skill_id text not null references public.skills(id) on delete cascade,
  level integer not null check (level between 1 and 5),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (employee_id, skill_id)
);

create index if not exists idx_employee_skills_employee on public.employee_skills(employee_id);
create index if not exists idx_employee_skills_skill on public.employee_skills(skill_id);

-- =============================================================================
-- 4. PROJECTS TABLE
-- =============================================================================
create table if not exists public.projects (
  id text primary key,
  name text not null,
  description text not null default '',
  department text not null,
  status text not null default 'planning'
    check (status in ('planning', 'active', 'completed', 'on-hold')),
  target_team_size integer not null default 1
    check (target_team_size >= 1),
  start_date date,
  deadline date,
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index if not exists idx_projects_status on public.projects(status);
create index if not exists idx_projects_department on public.projects(department);

-- =============================================================================
-- 5. PROJECT MEMBERS TABLE (Employee Project Allocations)
-- =============================================================================
create table if not exists public.project_members (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  employee_id text not null references public.employees(id) on delete cascade,
  assigned_at timestamptz not null default pg_catalog.now(),
  unique (project_id, employee_id)
);

create index if not exists idx_project_members_project on public.project_members(project_id);
create index if not exists idx_project_members_employee on public.project_members(employee_id);

-- =============================================================================
-- 6. PROJECT REQUIREMENTS TABLE
-- =============================================================================
create table if not exists public.project_requirements (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  skill_id text not null references public.skills(id) on delete cascade,
  min_level integer not null check (min_level between 1 and 5),
  importance text not null default 'required'
    check (importance in ('required', 'preferred')),
  unique (project_id, skill_id)
);

create index if not exists idx_project_requirements_project on public.project_requirements(project_id);

-- =============================================================================
-- 7. TRAINING ASSIGNMENTS TABLE
-- Tracks assigned courses and learning progress
-- =============================================================================
create table if not exists public.training_assignments (
  id text primary key,
  employee_id text not null references public.employees(id) on delete cascade,
  course_name text not null,
  provider text not null,
  skill_id text not null references public.skills(id) on delete cascade,
  status text not null default 'not-started'
    check (status in ('not-started', 'in-progress', 'completed')),
  progress integer not null default 0
    check (progress between 0 and 100),
  reason text,
  assigned_date date,
  completed_date date,
  verification_status text not null default 'not-started'
    check (verification_status in (
      'not-started',
      'in-progress',
      'pending-verification',
      'verified',
      'rejected',
      'needs-more-evidence'
    )),
  submission_id text, -- linked to training_submissions.id via FK below
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index if not exists idx_training_assignments_employee on public.training_assignments(employee_id);
create index if not exists idx_training_assignments_status on public.training_assignments(status);
create index if not exists idx_training_assignments_verification on public.training_assignments(verification_status);

-- =============================================================================
-- 8. TRAINING SUBMISSIONS TABLE
-- Core verification claims table: contains evidence references, reviewer records,
-- and database-enforced integrity constraints
-- =============================================================================
create table if not exists public.training_submissions (
  id text primary key,
  employee_id text not null references public.employees(id) on delete cascade,
  employee_name text not null,
  employee_role text not null,
  employee_department text not null,
  employee_avatar_color text,
  course_name text not null,
  provider text not null,
  skill_id text not null references public.skills(id) on delete cascade,
  completion_date date not null,
  submission_date date not null default current_date,
  credential_id text,
  verification_url text,
  notes text,
  evidence_file_name text,
  evidence_file_type text
    check (evidence_file_type in ('pdf', 'image', 'link', 'none')),
  evidence_file_size bigint
    check (evidence_file_size is null or (evidence_file_size >= 0 and evidence_file_size <= 5242880)),
  evidence_data_url text, -- supports inline fallback or SVG previews
  evidence_storage_path text, -- points to secure object path inside training-evidence bucket
  status text not null default 'pending-verification'
    check (status in (
      'not-started',
      'in-progress',
      'pending-verification',
      'verified',
      'rejected',
      'needs-more-evidence'
    )),
  assignment_id text references public.training_assignments(id) on delete set null,
  reviewer_id text references public.employees(id) on delete set null,
  reviewer_name text,
  review_timestamp timestamptz,
  reviewer_notes text,
  rejection_reason text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  -- Database constraint preventing self-approval
  constraint chk_no_self_approval check (
    reviewer_id is null or reviewer_id != employee_id
  )
);

-- Ensure review decision integrity constraint exists idempotently
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'training_submissions'
      and constraint_name = 'chk_training_submissions_review_state'
  ) then
    alter table public.training_submissions
      add constraint chk_training_submissions_review_state check (
        (
          status in ('not-started', 'in-progress', 'pending-verification')
          and reviewer_id is null
          and review_timestamp is null
        )
        or (
          status in ('verified', 'rejected', 'needs-more-evidence')
          and reviewer_id is not null
          and reviewer_id != employee_id
          and review_timestamp is not null
          and (status != 'rejected' or (rejection_reason is not null and pg_catalog.length(pg_catalog.btrim(rejection_reason)) > 0))
          and (status != 'needs-more-evidence' or (reviewer_notes is not null and pg_catalog.length(pg_catalog.btrim(reviewer_notes)) > 0))
        )
      );
  end if;
end $$;

create index if not exists idx_training_submissions_employee on public.training_submissions(employee_id);
create index if not exists idx_training_submissions_status on public.training_submissions(status);
create index if not exists idx_training_submissions_reviewer on public.training_submissions(reviewer_id);
create index if not exists idx_training_submissions_assignment on public.training_submissions(assignment_id);
create index if not exists idx_training_submissions_storage_path on public.training_submissions(evidence_storage_path);

-- Foreign key linking training_assignments.submission_id to training_submissions.id
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'training_assignments'
      and constraint_name = 'fk_training_assignments_submission'
  ) then
    alter table public.training_assignments
      add constraint fk_training_assignments_submission
      foreign key (submission_id)
      references public.training_submissions(id)
      on delete set null;
  end if;
end $$;

-- =============================================================================
-- 9. VERIFICATION AUDIT LOGS TABLE
-- Immutable append-only audit trail for submission lifecycle events
-- =============================================================================
create table if not exists public.verification_audit_logs (
  id text primary key,
  submission_id text not null references public.training_submissions(id) on delete cascade,
  action text not null
    check (action in ('submitted', 'resubmitted', 'approved', 'rejected', 'requested_more_evidence')),
  actor_id text not null,
  actor_name text not null,
  actor_role text not null
    check (actor_role in ('employee', 'manager', 'hr', 'admin')),
  timestamp timestamptz not null default pg_catalog.now(),
  note text
);

create index if not exists idx_verification_audit_submission on public.verification_audit_logs(submission_id);
create index if not exists idx_verification_audit_timestamp on public.verification_audit_logs(timestamp);

-- =============================================================================
-- 10. ACTIVITIES TABLE
-- Feed of organizational events
-- =============================================================================
create table if not exists public.activities (
  id text primary key,
  message text not null,
  timestamp timestamptz not null default pg_catalog.now(),
  type text not null default 'system'
    check (type in ('assignment', 'training', 'simulation', 'project', 'system'))
);

create index if not exists idx_activities_timestamp on public.activities(timestamp desc);

-- =============================================================================
-- 11. APP SETTINGS TABLE
-- =============================================================================
create table if not exists public.app_settings (
  id text primary key default 'default',
  organization_name text not null default 'Togetherly Enterprise',
  email_notifications boolean not null default true,
  workload_alerts boolean not null default true,
  team_reminders boolean not null default false,
  weekly_digest boolean not null default true,
  overloaded_threshold integer not null default 90
    check (overloaded_threshold between 1 and 100),
  underutilized_threshold integer not null default 50
    check (underutilized_threshold between 1 and 100),
  match_weights_skills integer not null default 50
    check (match_weights_skills between 0 and 100),
  match_weights_experience integer not null default 25
    check (match_weights_experience between 0 and 100),
  match_weights_availability integer not null default 25
    check (match_weights_availability between 0 and 100),
  updated_at timestamptz not null default pg_catalog.now()
);

insert into public.app_settings (
  id,
  organization_name,
  email_notifications,
  workload_alerts,
  team_reminders,
  weekly_digest,
  overloaded_threshold,
  underutilized_threshold,
  match_weights_skills,
  match_weights_experience,
  match_weights_availability
)
values (
  'default',
  'Togetherly Enterprise',
  true,
  true,
  false,
  true,
  90,
  50,
  50,
  25,
  25
)
on conflict (id) do nothing;

-- =============================================================================
-- 12. STORAGE BUCKET CONFIGURATION (Private training-evidence bucket)
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'training-evidence',
  'training-evidence',
  false,
  5242880, -- 5 MB in bytes
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

-- =============================================================================
-- 13. HARDENED SECURITY DEFINER HELPER FUNCTIONS (Fixed search_path = '')
-- =============================================================================

-- 13.1 Resolves the current employee ID matching auth.uid()
create or replace function public.current_employee_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.employees e
  where e.auth_user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_employee_id() from public;
grant execute on function public.current_employee_id() to authenticated, service_role;

-- 13.2 Resolves the current system role ('employee', 'manager', 'hr', 'admin') from public.employees
create or replace function public.current_system_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select e.system_role
      from public.employees e
      where e.auth_user_id = auth.uid()
      limit 1
    ),
    'none'
  );
$$;

revoke all on function public.current_system_role() from public;
grant execute on function public.current_system_role() to authenticated, service_role;

-- 13.3 Checks if the authenticated caller has reviewer privileges (Manager, HR, or Admin)
create or replace function public.is_reviewer_or_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.employees e
    where e.auth_user_id = auth.uid()
      and e.system_role in ('manager', 'hr', 'admin')
  );
$$;

revoke all on function public.is_reviewer_or_admin() from public;
grant execute on function public.is_reviewer_or_admin() to authenticated, service_role;

-- 13.4 Extracts the owning employee_id from a training-evidence storage object path.
-- Supports both "<employee_id>/<filename>" and "evidence/<employee_id>/<filename>"
-- while rejecting path traversal segments ("..").
create or replace function public.storage_evidence_owner_id(p_object_name text)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_folders text[];
  v_segments text[];
begin
  if p_object_name is null or pg_catalog.btrim(p_object_name) = '' then
    return null;
  end if;

  -- Reject any path traversal sequences
  v_segments := pg_catalog.string_to_array(p_object_name, '/');
  if '..' = any(v_segments) or '.' = any(v_segments) then
    return null;
  end if;

  v_folders := storage.foldername(p_object_name);
  if v_folders is null or pg_catalog.array_length(v_folders, 1) is null then
    return null;
  end if;

  if v_folders[1] = 'evidence' then
    if pg_catalog.array_length(v_folders, 1) >= 2 and pg_catalog.btrim(v_folders[2]) != '' then
      return v_folders[2];
    end if;
    return null;
  end if;

  if pg_catalog.btrim(v_folders[1]) != '' then
    return v_folders[1];
  end if;

  return null;
end;
$$;

revoke all on function public.storage_evidence_owner_id(text) from public;
grant execute on function public.storage_evidence_owner_id(text) to authenticated, service_role;

-- 13.5 Checks whether a caller is executing in a trusted database admin / service_role context
create or replace function public.is_trusted_admin_context()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    auth.uid() is null
    and current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role')
  )
  or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
  or public.current_system_role() = 'admin';
$$;

revoke all on function public.is_trusted_admin_context() from public;
grant execute on function public.is_trusted_admin_context() to authenticated, service_role;

-- =============================================================================
-- 14. DATABASE TRIGGERS FOR SECURITY, IMMUTABILITY & AUTH PROVISIONING
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 14.1 Employees Security Guard & Verified Auth User Linking (BEFORE Trigger)
-- Prevents role self-escalation, protects organizational fields on self-update,
-- and auto-links pre-provisioned employee records to existing verified auth.users.
-- -----------------------------------------------------------------------------
create or replace function public.enforce_employees_security_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_role text;
  v_is_admin_ctx boolean;
  v_matched_auth_id uuid;
begin
  v_is_admin_ctx := public.is_trusted_admin_context();
  v_caller_role := public.current_system_role();

  if tg_op = 'DELETE' then
    if not v_is_admin_ctx then
      if v_caller_role not in ('manager', 'hr') then
        raise exception 'Access denied: insufficient privileges to remove employee records.';
      end if;
      if old.auth_user_id is not distinct from auth.uid() then
        raise exception 'Access denied: you cannot delete your own employee profile.';
      end if;
      if old.system_role = 'admin' then
        raise exception 'Access denied: only a system administrator can remove an admin profile.';
      end if;
    end if;
    return old;
  end if;

  -- Normalize email
  new.email := pg_catalog.btrim(new.email);

  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, pg_catalog.now());
    new.updated_at := pg_catalog.now();

    if not v_is_admin_ctx then
      if v_caller_role not in ('manager', 'hr') then
        raise exception 'Access denied: only Managers, HR, or Administrators can create employee records.';
      end if;
      -- Never allow non-admins to create an 'admin' account or assign themselves
      if new.system_role = 'admin' then
        raise exception 'Access denied: only an Administrator can grant the admin system_role.';
      end if;
      if new.auth_user_id is not null and new.auth_user_id = auth.uid() then
        raise exception 'Access denied: self-provisioning of employee records is prohibited.';
      end if;
    end if;

    -- If auth_user_id is not explicitly provided, automatically link to an existing
    -- verified auth.users account with a matching email (if not already linked elsewhere).
    if new.auth_user_id is null and new.email is not null then
      select u.id
      into v_matched_auth_id
      from auth.users u
      where pg_catalog.lower(u.email) = pg_catalog.lower(new.email)
        and u.email_confirmed_at is not null
        and not exists (
          select 1
          from public.employees e
          where e.auth_user_id = u.id
        )
      order by u.created_at asc
      limit 1;

      if v_matched_auth_id is not null then
        new.auth_user_id := v_matched_auth_id;
      end if;
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Immutable primary key and creation timestamp
    new.id := old.id;
    new.created_at := old.created_at;
    new.updated_at := pg_catalog.now();

    if not v_is_admin_ctx then
      -- Case 1: Employee updating their own linked record
      if old.auth_user_id is not null and old.auth_user_id = auth.uid() then
        if new.system_role is distinct from old.system_role then
          raise exception 'Security violation: you cannot modify your own system_role.';
        end if;
        if new.auth_user_id is distinct from old.auth_user_id then
          raise exception 'Security violation: you cannot modify your own auth_user_id link.';
        end if;
        if pg_catalog.lower(new.email) is distinct from pg_catalog.lower(old.email) then
          raise exception 'Security violation: you cannot modify your own primary workforce email.';
        end if;
        if new.role is distinct from old.role
           or new.department is distinct from old.department
           or new.years_experience is distinct from old.years_experience
           or new.target_utilization is distinct from old.target_utilization then
          raise exception 'Security violation: employees may only update personal profile fields (name, avatar_color, availability) on their own record.';
        end if;
        perform pg_catalog.set_config('togetherly.verified_self_update_emp_id', old.id, true);
        perform pg_catalog.set_config('togetherly.verified_self_update_role', old.system_role, true);
      -- Case 2: Manager or HR updating another employee's record
      elsif v_caller_role in ('manager', 'hr') then
        if old.system_role = 'admin' or new.system_role = 'admin' then
          raise exception 'Security violation: only an Administrator can assign or modify the admin system_role.';
        end if;
        if old.auth_user_id is not null and new.auth_user_id is distinct from old.auth_user_id then
          raise exception 'Security violation: only an Administrator can reassign an existing auth_user_id link.';
        end if;
        if new.auth_user_id is not null and new.auth_user_id = auth.uid() then
          raise exception 'Security violation: you cannot link another employee profile to your own auth account.';
        end if;
      else
        raise exception 'Access denied: unauthorized update on public.employees.';
      end if;
    else
      if old.auth_user_id is not null and old.auth_user_id = auth.uid() then
        perform pg_catalog.set_config('togetherly.verified_self_update_emp_id', old.id, true);
        perform pg_catalog.set_config('togetherly.verified_self_update_role', new.system_role, true);
      end if;
    end if;

    -- If auth_user_id is still null, check if a verified auth.users account matches new.email
    if new.auth_user_id is null and new.email is not null then
      select u.id
      into v_matched_auth_id
      from auth.users u
      where pg_catalog.lower(u.email) = pg_catalog.lower(new.email)
        and u.email_confirmed_at is not null
        and not exists (
          select 1
          from public.employees e
          where e.auth_user_id = u.id
            and e.id != new.id
        )
      order by u.created_at asc
      limit 1;

      if v_matched_auth_id is not null then
        new.auth_user_id := v_matched_auth_id;
      end if;
    end if;

    return new;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_employees_security_guard() from public;

drop trigger if exists trg_employees_security_guard on public.employees;
create trigger trg_employees_security_guard
  before insert or update or delete on public.employees
  for each row
  execute function public.enforce_employees_security_guard();

-- -----------------------------------------------------------------------------
-- 14.2 Sync Employee Claims to auth.users (AFTER Trigger on public.employees)
-- Keeps auth.users.raw_app_meta_data (employee_id, role, system_role, department)
-- synchronized with public.employees so AuthContext resolves mappedEmployee.
-- -----------------------------------------------------------------------------
create or replace function public.sync_employee_claims_to_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Clear claims on old auth_user_id if unlinked or deleted
  if (tg_op = 'DELETE' and old.auth_user_id is not null)
     or (tg_op = 'UPDATE' and old.auth_user_id is not null and old.auth_user_id is distinct from new.auth_user_id) then
    update auth.users
    set raw_app_meta_data = (
          coalesce(raw_app_meta_data, '{}'::jsonb) - 'employee_id' - 'system_role' - 'department' - 'job_title'
        ) || pg_catalog.jsonb_build_object('role', 'unassigned'),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
          || pg_catalog.jsonb_build_object('role', 'unassigned', 'requires_admin_mapping', true)
          - 'employee_id',
        updated_at = pg_catalog.now()
    where id = old.auth_user_id;
  end if;

  -- Synchronize claims to new.auth_user_id when linked
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') and new.auth_user_id is not null then
    update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
          || pg_catalog.jsonb_build_object(
               'employee_id', new.id,
               'role', new.system_role,
               'system_role', new.system_role,
               'department', new.department,
               'job_title', new.role
             ),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
          || pg_catalog.jsonb_build_object(
               'employee_id', new.id,
               'role', new.system_role,
               'full_name', new.name,
               'department', new.department,
               'requires_admin_mapping', false
             ),
        updated_at = pg_catalog.now()
    where id = new.auth_user_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_employee_claims_to_auth_user() from public;

drop trigger if exists trg_sync_employee_claims_to_auth_user on public.employees;
create trigger trg_sync_employee_claims_to_auth_user
  after insert or update or delete on public.employees
  for each row
  execute function public.sync_employee_claims_to_auth_user();

-- -----------------------------------------------------------------------------
-- 14.3 Auto-Link Pre-Provisioned Employee When Auth User Confirms Email
-- Only links if an administrator ALREADY created a matching row in public.employees
-- with auth_user_id IS NULL. Never creates employee rows for unknown signups and
-- never elevates roles.
-- -----------------------------------------------------------------------------
create or replace function public.handle_verified_auth_user_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emp_id text;
begin
  if new.email is not null and new.email_confirmed_at is not null then
    select e.id
    into v_emp_id
    from public.employees e
    where pg_catalog.lower(e.email) = pg_catalog.lower(new.email)
      and (e.auth_user_id is null or e.auth_user_id = new.id)
    limit 1;

    if v_emp_id is not null then
      update public.employees
      set auth_user_id = new.id,
          updated_at = pg_catalog.now()
      where id = v_emp_id
        and (auth_user_id is null or auth_user_id = new.id);
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.handle_verified_auth_user_link() from public;

drop trigger if exists trg_on_auth_user_verified_link on auth.users;
create trigger trg_on_auth_user_verified_link
  after insert or update of email_confirmed_at, email on auth.users
  for each row
  execute function public.handle_verified_auth_user_link();

-- -----------------------------------------------------------------------------
-- 14.4 Training Assignments Update Guard (BEFORE UPDATE Trigger)
-- Enforces Requirement 2 at the database layer:
-- Employees can update permitted progress fields (status, progress, completed_date,
-- submission_id, and transition verification_status to 'in-progress' or
-- 'pending-verification' when linked to their own pending submission), but CANNOT
-- change verification_status to 'verified'/'rejected'/'needs-more-evidence',
-- nor alter employee_id, course_name, provider, skill_id, reason, or assigned_date.
-- Also prevents managers/HR from self-verifying their own training assignments.
-- -----------------------------------------------------------------------------
create or replace function public.enforce_training_assignment_update_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emp_id text;
  v_is_admin_ctx boolean;
  v_is_reviewer boolean;
begin
  v_is_admin_ctx := public.is_trusted_admin_context();
  v_emp_id := public.current_employee_id();
  v_is_reviewer := public.is_reviewer_or_admin();

  -- Immutable identity fields
  new.id := old.id;
  new.created_at := old.created_at;
  new.updated_at := pg_catalog.now();

  if not v_is_admin_ctx then
    if new.employee_id is distinct from old.employee_id then
      raise exception 'Security violation: training_assignments.employee_id cannot be reassigned.';
    end if;

    -- When the assignment owner updates their own row (even if they hold a manager/HR role)
    if old.employee_id = v_emp_id then
      if new.course_name is distinct from old.course_name
         or new.provider is distinct from old.provider
         or new.skill_id is distinct from old.skill_id
         or new.reason is distinct from old.reason
         or new.assigned_date is distinct from old.assigned_date then
        raise exception 'Security violation: employees cannot alter protected training assignment definition fields.';
      end if;

      if new.verification_status is distinct from old.verification_status then
        -- Employees can never set verification_status to verified, rejected, or needs-more-evidence
        if new.verification_status in ('verified', 'rejected', 'needs-more-evidence') then
          raise exception 'Security violation: employees cannot set verification_status to % on their own training assignment.', new.verification_status;
        end if;

        -- Once verified, employee cannot downgrade verification_status
        if old.verification_status = 'verified' then
          raise exception 'Security violation: verified training assignments cannot be modified by the employee.';
        end if;

        -- Transitioning to 'pending-verification' requires a valid submission owned by the employee
        if new.verification_status = 'pending-verification' then
          if new.submission_id is null or not exists (
            select 1
            from public.training_submissions s
            where s.id = new.submission_id
              and s.employee_id = old.employee_id
              and s.status = 'pending-verification'
          ) then
            raise exception 'Security violation: pending-verification status requires a valid pending training_submissions record owned by the employee.';
          end if;
        end if;
      end if;
      perform pg_catalog.set_config('togetherly.verified_assignment_update_id', old.id, true);
    elsif not v_is_reviewer then
      raise exception 'Access denied: you can only update your own training assignments.';
    end if;
  else
    perform pg_catalog.set_config('togetherly.verified_assignment_update_id', old.id, true);
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_training_assignment_update_guard() from public;

drop trigger if exists trg_training_assignments_update_guard on public.training_assignments;
create trigger trg_training_assignments_update_guard
  before update on public.training_assignments
  for each row
  execute function public.enforce_training_assignment_update_guard();

-- -----------------------------------------------------------------------------
-- 14.5 Training Submissions Integrity Guard (BEFORE INSERT OR UPDATE Trigger)
-- Enforces Requirement 3:
-- - Prevents cross-policy permissive RLS exploits by locking employee_id on UPDATE
-- - Prevents employees from forging reviewer fields or modifying verified claims
-- - Prevents reviewers from approving their own submissions, impersonating another
--   reviewer, or tampering with employee evidence fields during review
-- -----------------------------------------------------------------------------
create or replace function public.enforce_training_submission_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_emp_id text;
  v_caller_name text;
  v_caller_job_title text;
  v_caller_dept text;
  v_caller_avatar text;
  v_is_admin_ctx boolean;
  v_is_reviewer boolean;
begin
  v_is_admin_ctx := public.is_trusted_admin_context();
  v_caller_emp_id := public.current_employee_id();
  v_is_reviewer := public.is_reviewer_or_admin();

  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, pg_catalog.now());
    new.updated_at := pg_catalog.now();

    if not v_is_admin_ctx then
      if v_caller_emp_id is null or new.employee_id != v_caller_emp_id then
        raise exception 'Security violation: training submissions must be created for your own employee_id.';
      end if;

      -- Resolve authoritative employee metadata from public.employees to prevent spoofing
      select e.name, e.role, e.department, e.avatar_color
      into v_caller_name, v_caller_job_title, v_caller_dept, v_caller_avatar
      from public.employees e
      where e.id = v_caller_emp_id;

      new.employee_name := v_caller_name;
      new.employee_role := v_caller_job_title;
      new.employee_department := v_caller_dept;
      new.employee_avatar_color := coalesce(new.employee_avatar_color, v_caller_avatar);

      -- Force initial pending state and clear all reviewer fields
      new.status := 'pending-verification';
      new.submission_date := current_date;
      new.reviewer_id := null;
      new.reviewer_name := null;
      new.review_timestamp := null;
      new.reviewer_notes := null;
      new.rejection_reason := null;
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Strictly lock identity and ownership columns so OLD.employee_id == NEW.employee_id always holds
    new.id := old.id;
    new.employee_id := old.employee_id;
    new.created_at := old.created_at;
    new.updated_at := pg_catalog.now();

    if not v_is_admin_ctx then
      -- Branch A: Employee resubmitting their own claim
      if old.employee_id = v_caller_emp_id then
        if old.status not in ('rejected', 'needs-more-evidence', 'pending-verification') then
          raise exception 'Security violation: verified training submissions are locked and cannot be modified.';
        end if;
        if new.status != 'pending-verification' then
          raise exception 'Security violation: employee resubmissions must set status to pending-verification.';
        end if;

        -- Preserve authoritative submitter profile metadata
        select e.name, e.role, e.department, e.avatar_color
        into v_caller_name, v_caller_job_title, v_caller_dept, v_caller_avatar
        from public.employees e
        where e.id = v_caller_emp_id;

        new.employee_name := v_caller_name;
        new.employee_role := v_caller_job_title;
        new.employee_department := v_caller_dept;
        new.submission_date := current_date;

        -- Reset reviewer decision fields on resubmission
        new.reviewer_id := null;
        new.reviewer_name := null;
        new.review_timestamp := null;
        new.reviewer_notes := null;
        new.rejection_reason := null;

      -- Branch B: Authorized Reviewer recording a verification decision on another employee's claim
      elsif v_is_reviewer and old.employee_id != v_caller_emp_id then
        -- Reviewers cannot alter the employee's submitted claim or evidence fields
        if new.employee_name is distinct from old.employee_name
           or new.employee_role is distinct from old.employee_role
           or new.employee_department is distinct from old.employee_department
           or new.course_name is distinct from old.course_name
           or new.provider is distinct from old.provider
           or new.skill_id is distinct from old.skill_id
           or new.completion_date is distinct from old.completion_date
           or new.submission_date is distinct from old.submission_date
           or new.credential_id is distinct from old.credential_id
           or new.verification_url is distinct from old.verification_url
           or new.notes is distinct from old.notes
           or new.evidence_file_name is distinct from old.evidence_file_name
           or new.evidence_file_type is distinct from old.evidence_file_type
           or new.evidence_file_size is distinct from old.evidence_file_size
           or new.evidence_data_url is distinct from old.evidence_data_url
           or new.evidence_storage_path is distinct from old.evidence_storage_path
           or new.assignment_id is distinct from old.assignment_id then
          raise exception 'Security violation: reviewers cannot alter employee submission or evidence fields.';
        end if;

        if new.status not in ('verified', 'rejected', 'needs-more-evidence') then
          raise exception 'Security violation: invalid review decision status (%).', new.status;
        end if;

        if new.reviewer_id is distinct from v_caller_emp_id then
          raise exception 'Security violation: reviewer_id must match the authenticated reviewer (%).', v_caller_emp_id;
        end if;

        select e.name
        into v_caller_name
        from public.employees e
        where e.id = v_caller_emp_id;

        new.reviewer_id := v_caller_emp_id;
        new.reviewer_name := v_caller_name;
        new.review_timestamp := pg_catalog.now();

        if new.status = 'rejected' and (new.rejection_reason is null or pg_catalog.btrim(new.rejection_reason) = '') then
          raise exception 'Validation error: rejection_reason is required when rejecting a submission.';
        end if;

        if new.status = 'needs-more-evidence' and (new.reviewer_notes is null or pg_catalog.btrim(new.reviewer_notes) = '') then
          raise exception 'Validation error: reviewer_notes is required when requesting additional evidence.';
        end if;
      else
        raise exception 'Security violation: self-approval and unauthorized submission updates are prohibited.';
      end if;
    end if;

    return new;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_training_submission_integrity() from public;

drop trigger if exists trg_training_submissions_integrity on public.training_submissions;
create trigger trg_training_submissions_integrity
  before insert or update on public.training_submissions
  for each row
  execute function public.enforce_training_submission_integrity();

-- -----------------------------------------------------------------------------
-- 14.6 Verification Audit Logs Integrity Guard (BEFORE INSERT OR UPDATE OR DELETE)
-- Enforces Requirement 5:
-- - Guarantees append-only immutability (blocks UPDATE and DELETE)
-- - Validates that actor_id, actor_name, and actor_role match the authenticated
--   employee record and that the action is authorized for that submission
-- -----------------------------------------------------------------------------
create or replace function public.enforce_verification_audit_log_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_emp_id text;
  v_caller_name text;
  v_caller_sys_role text;
  v_submission_owner_id text;
  v_is_admin_ctx boolean;
begin
  if tg_op = 'UPDATE' or tg_op = 'DELETE' then
    raise exception 'Security violation: verification_audit_logs is append-only and immutable.';
  end if;

  v_is_admin_ctx := public.is_trusted_admin_context();

  select s.employee_id
  into v_submission_owner_id
  from public.training_submissions s
  where s.id = new.submission_id;

  if v_submission_owner_id is null then
    raise exception 'Validation error: referenced training_submissions record (%) does not exist.', new.submission_id;
  end if;

  if not v_is_admin_ctx then
    v_caller_emp_id := public.current_employee_id();
    if v_caller_emp_id is null then
      raise exception 'Access denied: unmapped users cannot insert verification audit logs.';
    end if;

    if new.actor_id != v_caller_emp_id then
      raise exception 'Security violation: cannot forge actor_id (%) in verification_audit_logs.', new.actor_id;
    end if;

    select e.name, e.system_role
    into v_caller_name, v_caller_sys_role
    from public.employees e
    where e.id = v_caller_emp_id;

    if new.actor_name is distinct from v_caller_name then
      raise exception 'Security violation: actor_name (%) does not match authenticated employee name (%).', new.actor_name, v_caller_name;
    end if;

    if new.action in ('submitted', 'resubmitted') then
      if v_submission_owner_id != v_caller_emp_id then
        raise exception 'Security violation: only the submission owner can record submitted/resubmitted audit actions.';
      end if;
      if new.actor_role not in ('employee', v_caller_sys_role) then
        raise exception 'Security violation: invalid actor_role (%) for employee submission action.', new.actor_role;
      end if;
    elsif new.action in ('approved', 'rejected', 'requested_more_evidence') then
      if v_caller_sys_role not in ('manager', 'hr', 'admin') then
        raise exception 'Security violation: only reviewers (manager, hr, admin) can record review decision audit actions.';
      end if;
      if v_submission_owner_id = v_caller_emp_id then
        raise exception 'Security violation: reviewers cannot record review decisions on their own submissions.';
      end if;
      -- Accept either the exact system_role or 'manager' (used by client DataContext for reviewer actions)
      if new.actor_role not in (v_caller_sys_role, 'manager') then
        raise exception 'Security violation: forged actor_role (%) does not match reviewer privileges (%).', new.actor_role, v_caller_sys_role;
      end if;
    else
      raise exception 'Validation error: unsupported audit action (%).', new.action;
    end if;

    new.timestamp := pg_catalog.now();
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_verification_audit_log_integrity() from public;

drop trigger if exists trg_verification_audit_logs_integrity on public.verification_audit_logs;
create trigger trg_verification_audit_logs_integrity
  before insert or update or delete on public.verification_audit_logs
  for each row
  execute function public.enforce_verification_audit_log_integrity();

-- =============================================================================
-- 15. SECURE WORKFORCE PROVISIONING FUNCTIONS (Requirement 8)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 15.1 Administrator / SQL Editor Provisioning Function
-- Securely links an existing verified auth.users account to a public.employees
-- record and populates auth.users.raw_app_meta_data so the user exits the
-- "Account Pending Workforce Provisioning" screen upon refreshing their session.
-- Strictly restricted to SQL Editor (postgres/supabase_admin), service_role, or
-- an already-provisioned Togetherly 'admin'. Never allows self-service execution.
-- -----------------------------------------------------------------------------
create or replace function public.provision_workforce_user(
  p_email text,
  p_employee_id text default 'emp-001',
  p_name text default null,
  p_job_title text default 'Workforce Intelligence Lead',
  p_department text default 'Engineering',
  p_system_role text default 'employee',
  p_avatar_color text default '#0078D4'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user record;
  v_clean_email text;
  v_resolved_name text;
begin
  -- Enforce strict authorization: only SQL Editor / service_role / existing 'admin'
  if not public.is_trusted_admin_context() then
    raise exception 'Access denied: provision_workforce_user requires Administrator or SQL Editor privileges. Self-service provisioning is prohibited.';
  end if;

  v_clean_email := pg_catalog.btrim(p_email);
  if v_clean_email is null or v_clean_email = '' then
    raise exception 'Validation error: p_email is required.';
  end if;

  if p_employee_id is null or pg_catalog.btrim(p_employee_id) = '' then
    raise exception 'Validation error: p_employee_id is required.';
  end if;

  if p_system_role not in ('employee', 'manager', 'hr', 'admin') then
    raise exception 'Validation error: p_system_role must be one of employee, manager, hr, admin.';
  end if;

  -- Locate the verified auth.users account
  select u.id, u.email, u.email_confirmed_at, u.raw_user_meta_data
  into v_auth_user
  from auth.users u
  where pg_catalog.lower(u.email) = pg_catalog.lower(v_clean_email)
  order by u.created_at asc
  limit 1;

  if v_auth_user.id is null then
    raise exception 'Provisioning failed: no auth.users account found for email "%". Sign up in the application first.', v_clean_email;
  end if;

  if v_auth_user.email_confirmed_at is null then
    raise exception 'Provisioning failed: auth.users account "%" has not confirmed their email address yet.', v_clean_email;
  end if;

  v_resolved_name := coalesce(
    pg_catalog.nullif(pg_catalog.btrim(p_name), ''),
    pg_catalog.nullif(pg_catalog.btrim(v_auth_user.raw_user_meta_data ->> 'full_name'), ''),
    pg_catalog.split_part(v_auth_user.email, '@', 1)
  );

  -- Upsert the employee record and link auth_user_id.
  -- The AFTER trigger (trg_sync_employee_claims_to_auth_user) automatically syncs
  -- raw_app_meta_data and raw_user_meta_data on auth.users.
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
    pg_catalog.btrim(p_employee_id),
    v_auth_user.id,
    v_resolved_name,
    pg_catalog.btrim(p_job_title),
    pg_catalog.btrim(p_department),
    v_auth_user.email,
    coalesce(pg_catalog.nullif(pg_catalog.btrim(p_avatar_color), ''), '#0078D4'),
    'available',
    5.0,
    100,
    p_system_role
  )
  on conflict (id) do update set
    auth_user_id = excluded.auth_user_id,
    name = excluded.name,
    role = excluded.role,
    department = excluded.department,
    email = excluded.email,
    avatar_color = excluded.avatar_color,
    system_role = excluded.system_role,
    updated_at = pg_catalog.now();

  return pg_catalog.jsonb_build_object(
    'provisioned', true,
    'auth_user_id', v_auth_user.id,
    'employee_id', pg_catalog.btrim(p_employee_id),
    'email', v_auth_user.email,
    'name', v_resolved_name,
    'system_role', p_system_role,
    'department', pg_catalog.btrim(p_department)
  );
end;
$$;

revoke all on function public.provision_workforce_user(text, text, text, text, text, text, text) from public;
grant execute on function public.provision_workforce_user(text, text, text, text, text, text, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 15.2 Safe Claim Sync Function for Pre-Provisioned Directory Employees
-- Allows an authenticated user with a verified email to link their auth.uid()
-- ONLY if an administrator has already created a public.employees row with their
-- exact email address and a non-admin system_role. Never creates new employee
-- rows and never allows self-service administrator assignment.
-- -----------------------------------------------------------------------------
create or replace function public.claim_preprovisioned_employee_profile()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_user record;
  v_emp record;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Authentication required.';
  end if;

  select u.id, u.email, u.email_confirmed_at
  into v_user
  from auth.users u
  where u.id = v_uid;

  if v_user.id is null or v_user.email is null or v_user.email_confirmed_at is null then
    return pg_catalog.jsonb_build_object(
      'linked', false,
      'reason', 'Email address is not verified.'
    );
  end if;

  -- Locate an existing employee record already linked to this user or pre-created with their email
  select e.id, e.name, e.role, e.department, e.system_role, e.auth_user_id
  into v_emp
  from public.employees e
  where e.auth_user_id = v_uid
     or (e.auth_user_id is null and pg_catalog.lower(e.email) = pg_catalog.lower(v_user.email))
  order by (case when e.auth_user_id = v_uid then 0 else 1 end) asc
  limit 1;

  if v_emp.id is null then
    return pg_catalog.jsonb_build_object(
      'linked', false,
      'reason', 'No pre-provisioned employee record found for this email.'
    );
  end if;

  -- Never allow self-service claiming of an unlinked 'admin' profile
  if v_emp.auth_user_id is null and v_emp.system_role = 'admin' then
    raise exception 'Security policy: administrator profiles must be linked via provision_workforce_user by an existing admin or database operator.';
  end if;

  -- Link auth_user_id (which fires trg_sync_employee_claims_to_auth_user to sync app_metadata)
  update public.employees
  set auth_user_id = v_uid,
      updated_at = pg_catalog.now()
  where id = v_emp.id
    and (auth_user_id is null or auth_user_id = v_uid);

  return pg_catalog.jsonb_build_object(
    'linked', true,
    'employee_id', v_emp.id,
    'system_role', v_emp.system_role,
    'department', v_emp.department
  );
end;
$$;

revoke all on function public.claim_preprovisioned_employee_profile() from public;
grant execute on function public.claim_preprovisioned_employee_profile() to authenticated, service_role;

-- =============================================================================
-- 16. ROW LEVEL SECURITY POLICIES (Repeatable & Non-Conflicting)
-- =============================================================================

-- Enable RLS on all application tables
alter table public.skills enable row level security;
alter table public.employees enable row level security;
alter table public.employee_skills enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_requirements enable row level security;
alter table public.training_assignments enable row level security;
alter table public.training_submissions enable row level security;
alter table public.verification_audit_logs enable row level security;
alter table public.activities enable row level security;
alter table public.app_settings enable row level security;

-- -----------------------------------------------------------------------------
-- 16.1 Skills, Activities, Settings Policies
-- -----------------------------------------------------------------------------
drop policy if exists "Anyone authenticated can view skills" on public.skills;
create policy "Anyone authenticated can view skills"
  on public.skills for select
  to authenticated
  using (true);

drop policy if exists "Admins can manage skills" on public.skills;
drop policy if exists "Admins can insert skills" on public.skills;
create policy "Admins can insert skills"
  on public.skills for insert
  to authenticated
  with check (public.current_system_role() = 'admin');

drop policy if exists "Admins can update skills" on public.skills;
create policy "Admins can update skills"
  on public.skills for update
  to authenticated
  using (public.current_system_role() = 'admin')
  with check (public.current_system_role() = 'admin');

drop policy if exists "Admins can delete skills" on public.skills;
create policy "Admins can delete skills"
  on public.skills for delete
  to authenticated
  using (public.current_system_role() = 'admin');

drop policy if exists "Anyone authenticated can view activities" on public.activities;
create policy "Anyone authenticated can view activities"
  on public.activities for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can create activities" on public.activities;
create policy "Authenticated users can create activities"
  on public.activities for insert
  to authenticated
  with check (public.current_employee_id() is not null);

drop policy if exists "Anyone authenticated can view settings" on public.app_settings;
create policy "Anyone authenticated can view settings"
  on public.app_settings for select
  to authenticated
  using (true);

drop policy if exists "Managers and Admins can update settings" on public.app_settings;
create policy "Managers and Admins can update settings"
  on public.app_settings for update
  to authenticated
  using (public.is_reviewer_or_admin())
  with check (public.is_reviewer_or_admin());

-- -----------------------------------------------------------------------------
-- 16.2 Employees & Employee Skills Policies (Requirement 4)
-- Prevents self-assignment of privileged roles and unauthorized field changes
-- -----------------------------------------------------------------------------
drop policy if exists "Employees directory is visible to authenticated users" on public.employees;
create policy "Employees directory is visible to authenticated users"
  on public.employees for select
  to authenticated
  using (true);

-- Drop legacy overly-broad FOR ALL policy if present
drop policy if exists "Managers and Admins can manage employees" on public.employees;

drop policy if exists "Employees can update their own profile contact info" on public.employees;
create policy "Employees can update their own profile contact info"
  on public.employees for update
  to authenticated
  using (
    auth_user_id = auth.uid()
  )
  with check (
    auth_user_id = auth.uid()
    and id = coalesce(pg_catalog.current_setting('togetherly.verified_self_update_emp_id', true), '')
    and system_role = coalesce(pg_catalog.current_setting('togetherly.verified_self_update_role', true), '')
  );

drop policy if exists "Reviewers and Admins can insert employees" on public.employees;
create policy "Reviewers and Admins can insert employees"
  on public.employees for insert
  to authenticated
  with check (
    public.is_reviewer_or_admin()
    and (
      system_role in ('employee', 'manager', 'hr')
      or public.current_system_role() = 'admin'
    )
    and (
      auth_user_id is null
      or auth_user_id != auth.uid()
      or public.current_system_role() = 'admin'
    )
  );

drop policy if exists "Reviewers and Admins can update other employees" on public.employees;
create policy "Reviewers and Admins can update other employees"
  on public.employees for update
  to authenticated
  using (
    public.is_reviewer_or_admin()
    and (
      auth_user_id is null
      or auth_user_id != auth.uid()
      or public.current_system_role() = 'admin'
    )
    and (
      system_role != 'admin'
      or public.current_system_role() = 'admin'
    )
  )
  with check (
    public.is_reviewer_or_admin()
    and (
      auth_user_id is null
      or auth_user_id != auth.uid()
      or public.current_system_role() = 'admin'
    )
    and (
      system_role in ('employee', 'manager', 'hr')
      or public.current_system_role() = 'admin'
    )
  );

drop policy if exists "Reviewers and Admins can delete employees" on public.employees;
create policy "Reviewers and Admins can delete employees"
  on public.employees for delete
  to authenticated
  using (
    public.is_reviewer_or_admin()
    and (auth_user_id is null or auth_user_id != auth.uid())
    and (system_role != 'admin' or public.current_system_role() = 'admin')
  );

drop policy if exists "Anyone authenticated can view employee skills" on public.employee_skills;
create policy "Anyone authenticated can view employee skills"
  on public.employee_skills for select
  to authenticated
  using (true);

drop policy if exists "Managers and Admins can manage employee skills" on public.employee_skills;
create policy "Managers and Admins can manage employee skills"
  on public.employee_skills for all
  to authenticated
  using (public.is_reviewer_or_admin())
  with check (public.is_reviewer_or_admin());

-- -----------------------------------------------------------------------------
-- 16.3 Projects & Allocations Policies
-- -----------------------------------------------------------------------------
drop policy if exists "Anyone authenticated can view projects" on public.projects;
create policy "Anyone authenticated can view projects"
  on public.projects for select
  to authenticated
  using (true);

drop policy if exists "Managers and Admins can manage projects" on public.projects;
create policy "Managers and Admins can manage projects"
  on public.projects for all
  to authenticated
  using (public.is_reviewer_or_admin())
  with check (public.is_reviewer_or_admin());

drop policy if exists "Anyone authenticated can view project members" on public.project_members;
create policy "Anyone authenticated can view project members"
  on public.project_members for select
  to authenticated
  using (true);

drop policy if exists "Managers and Admins can manage project members" on public.project_members;
create policy "Managers and Admins can manage project members"
  on public.project_members for all
  to authenticated
  using (public.is_reviewer_or_admin())
  with check (public.is_reviewer_or_admin());

drop policy if exists "Anyone authenticated can view project requirements" on public.project_requirements;
create policy "Anyone authenticated can view project requirements"
  on public.project_requirements for select
  to authenticated
  using (true);

drop policy if exists "Managers and Admins can manage project requirements" on public.project_requirements;
create policy "Managers and Admins can manage project requirements"
  on public.project_requirements for all
  to authenticated
  using (public.is_reviewer_or_admin())
  with check (public.is_reviewer_or_admin());

-- -----------------------------------------------------------------------------
-- 16.4 Training Assignments Policies (Requirement 2)
-- Employees can update permitted progress fields on their own assignments,
-- while protected columns and verification decisions are locked by both RLS and
-- trg_training_assignments_update_guard.
-- -----------------------------------------------------------------------------
drop policy if exists "Employees can view their own training assignments" on public.training_assignments;
create policy "Employees can view their own training assignments"
  on public.training_assignments for select
  to authenticated
  using (
    employee_id = public.current_employee_id()
    or public.is_reviewer_or_admin()
  );

-- Drop legacy overly-broad FOR ALL policy if present
drop policy if exists "Managers and Admins can manage all training assignments" on public.training_assignments;

drop policy if exists "Employees can update their own assignment progress" on public.training_assignments;
create policy "Employees can update their own assignment progress"
  on public.training_assignments for update
  to authenticated
  using (
    employee_id = public.current_employee_id()
    and verification_status != 'verified'
  )
  with check (
    employee_id = public.current_employee_id()
    and id = coalesce(pg_catalog.current_setting('togetherly.verified_assignment_update_id', true), '')
    and verification_status in ('not-started', 'in-progress', 'pending-verification')
    and (
      verification_status != 'pending-verification'
      or (
        submission_id is not null
        and exists (
          select 1
          from public.training_submissions s
          where s.id = training_assignments.submission_id
            and s.employee_id = public.current_employee_id()
            and s.status = 'pending-verification'
        )
      )
    )
  );

drop policy if exists "Reviewers and Admins can insert training assignments" on public.training_assignments;
create policy "Reviewers and Admins can insert training assignments"
  on public.training_assignments for insert
  to authenticated
  with check (
    public.is_reviewer_or_admin()
  );

drop policy if exists "Reviewers and Admins can update other employees training assignments" on public.training_assignments;
create policy "Reviewers and Admins can update other employees training assignments"
  on public.training_assignments for update
  to authenticated
  using (
    public.is_reviewer_or_admin()
    and (
      employee_id != public.current_employee_id()
      or public.current_system_role() = 'admin'
    )
  )
  with check (
    public.is_reviewer_or_admin()
    and (
      employee_id != public.current_employee_id()
      or public.current_system_role() = 'admin'
    )
  );

drop policy if exists "Reviewers and Admins can delete training assignments" on public.training_assignments;
create policy "Reviewers and Admins can delete training assignments"
  on public.training_assignments for delete
  to authenticated
  using (
    public.is_reviewer_or_admin()
  );

-- -----------------------------------------------------------------------------
-- 16.5 Training Submissions Policies (Requirement 3)
-- Strictly separates employee submission/resubmission from reviewer decisions.
-- Combined with trg_training_submissions_integrity (which locks employee_id),
-- prevents permissive policy cross-over, reviewer impersonation, and self-approval.
-- -----------------------------------------------------------------------------
drop policy if exists "Submissions select policy" on public.training_submissions;
create policy "Submissions select policy"
  on public.training_submissions for select
  to authenticated
  using (
    employee_id = public.current_employee_id()
    or public.is_reviewer_or_admin()
  );

drop policy if exists "Employees can submit their own training completion claims" on public.training_submissions;
create policy "Employees can submit their own training completion claims"
  on public.training_submissions for insert
  to authenticated
  with check (
    employee_id = public.current_employee_id()
    and status = 'pending-verification'
    and reviewer_id is null
    and reviewer_name is null
    and review_timestamp is null
    and reviewer_notes is null
    and rejection_reason is null
  );

drop policy if exists "Employees can resubmit evidence on their own pending/rejected claims" on public.training_submissions;
create policy "Employees can resubmit evidence on their own pending/rejected claims"
  on public.training_submissions for update
  to authenticated
  using (
    employee_id = public.current_employee_id()
    and status in ('rejected', 'needs-more-evidence', 'pending-verification')
  )
  with check (
    employee_id = public.current_employee_id()
    and status = 'pending-verification'
    and reviewer_id is null
    and reviewer_name is null
    and review_timestamp is null
    and reviewer_notes is null
    and rejection_reason is null
  );

drop policy if exists "Reviewers can review and decide on training submissions" on public.training_submissions;
create policy "Reviewers can review and decide on training submissions"
  on public.training_submissions for update
  to authenticated
  using (
    public.is_reviewer_or_admin()
    and employee_id != public.current_employee_id()
  )
  with check (
    public.is_reviewer_or_admin()
    and employee_id != public.current_employee_id()
    and reviewer_id = public.current_employee_id()
    and review_timestamp is not null
    and status in ('verified', 'rejected', 'needs-more-evidence')
    and (status != 'rejected' or (rejection_reason is not null and pg_catalog.length(pg_catalog.btrim(rejection_reason)) > 0))
    and (status != 'needs-more-evidence' or (reviewer_notes is not null and pg_catalog.length(pg_catalog.btrim(reviewer_notes)) > 0))
  );

-- -----------------------------------------------------------------------------
-- 16.6 Verification Audit Logs Policies (Requirement 5)
-- Append-only: validates actor_id, actor_name, actor_role, and submission ownership
-- -----------------------------------------------------------------------------
drop policy if exists "Audit logs are viewable by submitter or reviewers" on public.verification_audit_logs;
create policy "Audit logs are viewable by submitter or reviewers"
  on public.verification_audit_logs for select
  to authenticated
  using (
    exists (
      select 1
      from public.training_submissions s
      where s.id = verification_audit_logs.submission_id
        and (s.employee_id = public.current_employee_id() or public.is_reviewer_or_admin())
    )
  );

drop policy if exists "Authenticated users can record audit entries" on public.verification_audit_logs;
create policy "Authenticated users can record audit entries"
  on public.verification_audit_logs for insert
  to authenticated
  with check (
    actor_id = public.current_employee_id()
    and exists (
      select 1
      from public.employees e
      where e.id = public.current_employee_id()
        and e.name = verification_audit_logs.actor_name
        and (
          (
            verification_audit_logs.action in ('submitted', 'resubmitted')
            and verification_audit_logs.actor_role in ('employee', e.system_role)
            and exists (
              select 1
              from public.training_submissions s
              where s.id = verification_audit_logs.submission_id
                and s.employee_id = e.id
            )
          )
          or (
            verification_audit_logs.action in ('approved', 'rejected', 'requested_more_evidence')
            and e.system_role in ('manager', 'hr', 'admin')
            and verification_audit_logs.actor_role in (e.system_role, 'manager')
            and exists (
              select 1
              from public.training_submissions s
              where s.id = verification_audit_logs.submission_id
                and s.employee_id != e.id
            )
          )
        )
    )
  );

-- Disallow updates and deletes on audit logs (no UPDATE or DELETE policies defined,
-- and blocked by trg_verification_audit_logs_integrity)

-- =============================================================================
-- 17. STORAGE POLICIES FOR 'training-evidence' BUCKET (Requirement 7)
-- Restricts access to the owning employee and authorized reviewers, and prevents
-- modifying or deleting evidence files locked by a verified submission.
-- =============================================================================

-- SELECT: Employee can download their own evidence; Reviewers can view any evidence
drop policy if exists "Evidence read policy" on storage.objects;
create policy "Evidence read policy"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'training-evidence'
    and (
      (
        public.current_employee_id() is not null
        and public.storage_evidence_owner_id(name) = public.current_employee_id()
      )
      or public.is_reviewer_or_admin()
    )
  );

-- INSERT: Mapped employees can upload files only into their own folder
drop policy if exists "Evidence insert policy" on storage.objects;
create policy "Evidence insert policy"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'training-evidence'
    and public.current_employee_id() is not null
    and public.storage_evidence_owner_id(name) = public.current_employee_id()
  );

-- UPDATE: Mapped employees can update their own evidence file only if not verified
drop policy if exists "Evidence update policy" on storage.objects;
create policy "Evidence update policy"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'training-evidence'
    and public.current_employee_id() is not null
    and public.storage_evidence_owner_id(name) = public.current_employee_id()
    and not exists (
      select 1
      from public.training_submissions s
      where s.evidence_storage_path = storage.objects.name
        and s.status = 'verified'
    )
  )
  with check (
    bucket_id = 'training-evidence'
    and public.current_employee_id() is not null
    and public.storage_evidence_owner_id(name) = public.current_employee_id()
  );

-- DELETE: Mapped employees can delete their own file only if not verified; Admins can delete
drop policy if exists "Evidence delete policy" on storage.objects;
create policy "Evidence delete policy"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'training-evidence'
    and (
      (
        public.current_employee_id() is not null
        and public.storage_evidence_owner_id(name) = public.current_employee_id()
        and not exists (
          select 1
          from public.training_submissions s
          where s.evidence_storage_path = storage.objects.name
            and s.status = 'verified'
        )
      )
      or public.current_system_role() = 'admin'
    )
  );

-- =============================================================================
-- 18. EMPLOYEE REGISTRATION & VERIFICATION SYSTEM
-- Persists self-registered auth.users applications until an authorized
-- administrator reviews their details, assigns an organization role and
-- department, and approves or rejects access.
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

-- -----------------------------------------------------------------------------
-- 18.1 Integrity & Security Guard Trigger on employee_registration_requests
-- Prevents non-admin callers from forging status, assigned_role, or reviewer fields
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 18.2 Automatic Queue Capture Trigger on auth.users
-- Automatically inserts a pending registration request whenever a new user signs up
-- in auth.users (or marks it approved if already linked to public.employees).
-- -----------------------------------------------------------------------------
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

  -- Check if this user is already linked to an active employee record
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

-- -----------------------------------------------------------------------------
-- 18.3 Keep employee_registration_requests synchronized when public.employees
-- is provisioned directly (e.g., via provision_workforce_user)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 18.4 Initial Administrator Bootstrap & Backfill of Existing auth.users
-- 1. If no administrator in public.employees is linked to an auth.users account yet,
--    automatically links the earliest created verified auth.users account as the
--    initial organization Administrator so the project owner can immediately log in
--    and review pending requests in /admin/employee-requests.
-- 2. Backfills all existing auth.users rows into public.employee_registration_requests.
-- -----------------------------------------------------------------------------
do $$
declare
  v_first_user record;
  v_admin_emp_id text;
begin
  -- Check if any administrator account is already linked to auth.users
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
      -- Determine whether an employee record already exists for this email or use 'emp-admin-001'
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

  -- Backfill any existing auth.users rows into public.employee_registration_requests
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

-- -----------------------------------------------------------------------------
-- 18.5 Administrator RPC: Sync Missing Registration Requests from auth.users
-- Ensures any auth.users accounts are present in employee_registration_requests
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 18.6 Applicant RPC: Ensure & Retrieve Own Registration Request
-- Allows a newly signed-up user to ensure their registration request exists and
-- optionally update their name, requested department, or requested job title
-- while the application is still in 'pending' status.
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 18.7 Administrator RPC: Approve Employee Registration Request
-- Strictly restricted to authorized administrators (public.is_trusted_admin_context()).
-- Validates role & department, creates/updates the public.employees record,
-- links auth_user_id (which triggers JWT app_metadata claim synchronization),
-- updates the request status to 'approved', and logs an organizational activity.
-- -----------------------------------------------------------------------------
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

  -- Check if an employee record already exists for this auth_user_id or email
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

  -- Upsert into public.employees (fires trg_sync_employee_claims_to_auth_user)
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

  -- Update the registration request record
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

  -- Record organizational activity
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

-- -----------------------------------------------------------------------------
-- 18.8 Administrator RPC: Reject Employee Registration Request
-- Strictly restricted to authorized administrators (public.is_trusted_admin_context()).
-- Marks the request as 'rejected', stores the rejection reason, reviewer, and
-- timestamp, and revokes any linked employee access for that user.
-- -----------------------------------------------------------------------------
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

  -- Unlink any active employee record if previously linked
  update public.employees
  set auth_user_id = null,
      updated_at = pg_catalog.now()
  where auth_user_id = v_req.auth_user_id;

  -- Mark user's auth metadata as rejected / unmapped
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

  -- Update registration request status to rejected
  update public.employee_registration_requests
  set status = 'rejected',
      reviewer_id = v_reviewer_id,
      reviewer_name = v_reviewer_name,
      reviewed_at = pg_catalog.now(),
      rejection_reason = v_clean_reason,
      updated_at = pg_catalog.now()
  where id = p_request_id
  returning * into v_req;

  -- Record organizational activity
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

-- -----------------------------------------------------------------------------
-- 18.9 Row-Level Security (RLS) Policies on employee_registration_requests
-- Only authorized admins can view all requests and approve/reject them;
-- normal users can only view and update their own pending request.
-- -----------------------------------------------------------------------------
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

