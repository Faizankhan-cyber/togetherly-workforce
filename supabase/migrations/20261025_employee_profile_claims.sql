-- Togetherly Talent Trust: self-reported employee profile claims with manager/HR verification.
-- Claims are deliberately stored separately from employee_skills and employees.years_experience.
-- Only the review RPC promotes a claim into data used by Team Builder.

create table if not exists public.employee_profile_claims (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.employees(id) on delete cascade,
  claim_type text not null check (claim_type in ('skill', 'experience', 'certification')),
  skill_id text null references public.skills(id) on delete set null,
  claimed_level integer null check (claimed_level is null or claimed_level between 1 and 5),
  claimed_years numeric(4,1) null check (claimed_years is null or (claimed_years >= 0 and claimed_years <= 80)),
  title text null,
  organization text null,
  start_date date null,
  end_date date null,
  description text null,
  evidence_url text null,
  evidence_label text null,
  status text not null default 'pending-verification'
    check (status in ('pending-verification', 'verified', 'rejected', 'needs-more-evidence')),
  reviewer_employee_id text null references public.employees(id) on delete set null,
  reviewer_name text null,
  reviewer_notes text null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_profile_claim_dates_valid check (start_date is null or end_date is null or end_date >= start_date),
  constraint employee_profile_claim_skill_valid check (
    claim_type <> 'skill' or (skill_id is not null and claimed_level is not null)
  ),
  constraint employee_profile_claim_experience_valid check (
    claim_type <> 'experience' or (claimed_years is not null and nullif(btrim(title), '') is not null)
  ),
  constraint employee_profile_claim_certification_valid check (
    claim_type <> 'certification' or nullif(btrim(title), '') is not null
  ),
  constraint employee_profile_claim_evidence_url_valid check (
    evidence_url is null or evidence_url ~* '^https?://'
  )
);

create index if not exists employee_profile_claims_employee_status_idx
  on public.employee_profile_claims (employee_id, status, created_at desc);
create index if not exists employee_profile_claims_status_created_idx
  on public.employee_profile_claims (status, created_at desc);

-- Verified skills are the canonical skill source used by the live employee directory.
-- The current database has no rows in employee_skills, so this index is safe to add.
create unique index if not exists employee_skills_employee_skill_uidx
  on public.employee_skills (employee_id, skill_id);

create table if not exists public.employee_profile_claim_audit (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.employee_profile_claims(id) on delete cascade,
  employee_id text not null references public.employees(id) on delete cascade,
  action text not null check (action in ('submitted', 'resubmitted', 'verified', 'rejected', 'needs-more-evidence')),
  actor_employee_id text null references public.employees(id) on delete set null,
  actor_name text not null,
  actor_role text not null check (actor_role in ('employee', 'manager', 'hr', 'admin')),
  note text null,
  created_at timestamptz not null default now()
);

create index if not exists employee_profile_claim_audit_claim_idx
  on public.employee_profile_claim_audit (claim_id, created_at asc);

alter table public.employee_profile_claims enable row level security;
alter table public.employee_profile_claim_audit enable row level security;

-- Claims can be read only by their owner and authorized reviewers. Writes go through RPCs.
drop policy if exists "Employee and reviewer can view profile claims" on public.employee_profile_claims;
create policy "Employee and reviewer can view profile claims"
  on public.employee_profile_claims for select to authenticated
  using (employee_id = public.current_employee_id() or public.is_reviewer_or_admin());

drop policy if exists "Employee and reviewer can view profile claim audit" on public.employee_profile_claim_audit;
create policy "Employee and reviewer can view profile claim audit"
  on public.employee_profile_claim_audit for select to authenticated
  using (employee_id = public.current_employee_id() or public.is_reviewer_or_admin());

grant select on public.employee_profile_claims to authenticated;
grant select on public.employee_profile_claim_audit to authenticated;
revoke all on public.employee_profile_claims from anon;
revoke all on public.employee_profile_claim_audit from anon;

create or replace function public.submit_employee_profile_claim(
  p_claim_type text,
  p_skill_id text default null,
  p_claimed_level integer default null,
  p_claimed_years numeric default null,
  p_title text default null,
  p_organization text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_description text default null,
  p_evidence_url text default null,
  p_evidence_label text default null,
  p_claim_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_employee_id text := public.current_employee_id();
  v_actor_name text;
  v_actor_role text := public.current_system_role();
  v_claim public.employee_profile_claims%rowtype;
  v_type text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_claim_type, '')));
  v_title text := nullif(pg_catalog.btrim(coalesce(p_title, '')), '');
  v_org text := nullif(pg_catalog.btrim(coalesce(p_organization, '')), '');
  v_description text := nullif(pg_catalog.btrim(coalesce(p_description, '')), '');
  v_evidence_url text := nullif(pg_catalog.btrim(coalesce(p_evidence_url, '')), '');
  v_evidence_label text := nullif(pg_catalog.btrim(coalesce(p_evidence_label, '')), '');
begin
  if v_uid is null or v_employee_id is null then
    raise exception 'Your account must be linked to an approved employee profile before submitting claims.';
  end if;

  if v_type not in ('skill', 'experience', 'certification') then
    raise exception 'Claim type must be skill, experience, or certification.';
  end if;
  if p_claimed_level is not null and p_claimed_level not between 1 and 5 then
    raise exception 'Skill proficiency must be between 1 and 5.';
  end if;
  if v_type = 'skill' and (p_skill_id is null or p_claimed_level is null) then
    raise exception 'A skill and claimed proficiency are required for a skill claim.';
  end if;
  if v_type = 'experience' and (p_claimed_years is null or p_claimed_years < 0 or p_claimed_years > 80 or v_title is null) then
    raise exception 'Experience claims require a job title and total years of experience between 0 and 80.';
  end if;
  if v_type = 'certification' and v_title is null then
    raise exception 'A certification name is required.';
  end if;
  if p_start_date is not null and p_end_date is not null and p_end_date < p_start_date then
    raise exception 'End date cannot be earlier than start date.';
  end if;
  if v_evidence_url is not null and v_evidence_url !~* '^https?://' then
    raise exception 'Evidence link must begin with https:// or http://.';
  end if;
  if pg_catalog.length(coalesce(v_title, '')) > 180 or pg_catalog.length(coalesce(v_org, '')) > 180
     or pg_catalog.length(coalesce(v_description, '')) > 3000
     or pg_catalog.length(coalesce(v_evidence_url, '')) > 1000
     or pg_catalog.length(coalesce(v_evidence_label, '')) > 180 then
    raise exception 'One or more profile claim fields exceed the allowed length.';
  end if;

  select e.name into v_actor_name
    from public.employees e where e.id = v_employee_id and e.auth_user_id = v_uid;
  if v_actor_name is null then
    raise exception 'The authenticated employee profile could not be verified.';
  end if;

  if p_claim_id is null then
    insert into public.employee_profile_claims (
      employee_id, claim_type, skill_id, claimed_level, claimed_years, title,
      organization, start_date, end_date, description, evidence_url, evidence_label,
      status, submitted_at, created_at, updated_at
    ) values (
      v_employee_id, v_type, case when v_type = 'skill' then p_skill_id else p_skill_id end,
      case when v_type = 'skill' then p_claimed_level else null end,
      case when v_type = 'experience' then p_claimed_years else null end,
      v_title, v_org, p_start_date, p_end_date, v_description, v_evidence_url, v_evidence_label,
      'pending-verification', pg_catalog.now(), pg_catalog.now(), pg_catalog.now()
    ) returning * into v_claim;

    insert into public.employee_profile_claim_audit (
      claim_id, employee_id, action, actor_employee_id, actor_name, actor_role, note
    ) values (
      v_claim.id, v_employee_id, 'submitted', v_employee_id, v_actor_name,
      case when v_actor_role in ('employee', 'manager', 'hr', 'admin') then v_actor_role else 'employee' end,
      'Profile claim submitted for verification.'
    );
  else
    update public.employee_profile_claims c
    set skill_id = case when v_type = 'skill' then p_skill_id else null end,
        claimed_level = case when v_type = 'skill' then p_claimed_level else null end,
        claimed_years = case when v_type = 'experience' then p_claimed_years else null end,
        title = v_title,
        organization = v_org,
        start_date = p_start_date,
        end_date = p_end_date,
        description = v_description,
        evidence_url = v_evidence_url,
        evidence_label = v_evidence_label,
        status = 'pending-verification',
        reviewer_employee_id = null,
        reviewer_name = null,
        reviewer_notes = null,
        reviewed_at = null,
        submitted_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    where c.id = p_claim_id
      and c.employee_id = v_employee_id
      and c.claim_type = v_type
      and c.status in ('rejected', 'needs-more-evidence')
    returning * into v_claim;

    if v_claim.id is null then
      raise exception 'This claim cannot be resubmitted. Only your own rejected or evidence-requested claims can be resubmitted.';
    end if;

    insert into public.employee_profile_claim_audit (
      claim_id, employee_id, action, actor_employee_id, actor_name, actor_role, note
    ) values (
      v_claim.id, v_employee_id, 'resubmitted', v_employee_id, v_actor_name,
      case when v_actor_role in ('employee', 'manager', 'hr', 'admin') then v_actor_role else 'employee' end,
      'Claim resubmitted with updated information or evidence.'
    );
  end if;

  return pg_catalog.to_jsonb(v_claim);
end;
$function$;

create or replace function public.review_employee_profile_claim(
  p_claim_id uuid,
  p_decision text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_reviewer_id text := public.current_employee_id();
  v_reviewer_role text := public.current_system_role();
  v_reviewer_name text;
  v_decision text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_decision, '')));
  v_notes text := nullif(pg_catalog.btrim(coalesce(p_notes, '')), '');
  v_claim public.employee_profile_claims%rowtype;
begin
  if auth.uid() is null or v_reviewer_id is null or not public.is_reviewer_or_admin() then
    raise exception 'Only an authenticated manager, HR reviewer, or administrator can review profile claims.';
  end if;
  if v_decision not in ('verified', 'rejected', 'needs-more-evidence') then
    raise exception 'Decision must be verified, rejected, or needs-more-evidence.';
  end if;
  if pg_catalog.length(coalesce(v_notes, '')) > 2000 then
    raise exception 'Review notes must be 2000 characters or fewer.';
  end if;

  select e.name into v_reviewer_name
    from public.employees e
    where e.id = v_reviewer_id and e.auth_user_id = auth.uid();
  if v_reviewer_name is null then
    raise exception 'The reviewer employee profile could not be verified.';
  end if;

  select c.* into v_claim
    from public.employee_profile_claims c
    where c.id = p_claim_id
    for update;
  if v_claim.id is null then
    raise exception 'Profile claim not found.';
  end if;
  if v_claim.employee_id = v_reviewer_id then
    raise exception 'You cannot verify your own profile claims.';
  end if;
  if v_claim.status <> 'pending-verification' then
    raise exception 'Only pending claims can be reviewed. The employee must resubmit claims that need more evidence.';
  end if;

  update public.employee_profile_claims
  set status = v_decision,
      reviewer_employee_id = v_reviewer_id,
      reviewer_name = v_reviewer_name,
      reviewer_notes = v_notes,
      reviewed_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where id = v_claim.id
  returning * into v_claim;

  if v_decision = 'verified' and v_claim.claim_type = 'skill' then
    insert into public.employee_skills (employee_id, skill_id, level, updated_at)
    values (v_claim.employee_id, v_claim.skill_id, v_claim.claimed_level, pg_catalog.now())
    on conflict (employee_id, skill_id)
    do update set level = excluded.level, updated_at = pg_catalog.now();
  elsif v_decision = 'verified' and v_claim.claim_type = 'experience' then
    update public.employees
    set years_experience = v_claim.claimed_years,
        updated_at = pg_catalog.now()
    where id = v_claim.employee_id;
  end if;

  insert into public.employee_profile_claim_audit (
    claim_id, employee_id, action, actor_employee_id, actor_name, actor_role, note
  ) values (
    v_claim.id, v_claim.employee_id, v_decision, v_reviewer_id, v_reviewer_name,
    case when v_reviewer_role in ('manager', 'hr', 'admin') then v_reviewer_role else 'manager' end,
    v_notes
  );

  return pg_catalog.to_jsonb(v_claim);
end;
$function$;

revoke all on function public.submit_employee_profile_claim(text, text, integer, numeric, text, text, date, date, text, text, text, uuid) from public, anon;
grant execute on function public.submit_employee_profile_claim(text, text, integer, numeric, text, text, date, date, text, text, text, uuid) to authenticated;
revoke all on function public.review_employee_profile_claim(uuid, text, text) from public, anon;
grant execute on function public.review_employee_profile_claim(uuid, text, text) to authenticated;

comment on table public.employee_profile_claims is 'Employee-submitted skill, experience and certification claims. Only verified claims are promoted into canonical workforce records.';
comment on table public.employee_profile_claim_audit is 'Audit trail for submission and review decisions on employee profile claims.';
