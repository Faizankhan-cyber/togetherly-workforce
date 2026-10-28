-- Official job titles are never edited directly. A reviewed job-title claim is the only supported path.
ALTER TABLE public.employee_profile_claims
  DROP CONSTRAINT IF EXISTS employee_profile_claims_claim_type_check;

ALTER TABLE public.employee_profile_claims
  ADD CONSTRAINT employee_profile_claims_claim_type_check
  CHECK (claim_type = ANY (ARRAY['skill'::text, 'experience'::text, 'certification'::text, 'employment'::text, 'education'::text, 'job-title'::text]));

ALTER TABLE public.employee_profile_claims
  ADD CONSTRAINT employee_profile_claim_job_title_valid
  CHECK ((claim_type <> 'job-title'::text) OR (NULLIF(btrim(title), ''::text) IS NOT NULL));

CREATE UNIQUE INDEX IF NOT EXISTS employee_profile_claims_one_pending_job_title_per_employee
  ON public.employee_profile_claims(employee_id)
  WHERE claim_type = 'job-title' AND status = 'pending-verification';

CREATE OR REPLACE FUNCTION public.enforce_verified_employee_job_title()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND pg_catalog.current_setting('togetherly.allow_verified_job_title_change', true) IS DISTINCT FROM OLD.id
     AND NOT (
       OLD.auth_user_id IS NULL
       AND NEW.auth_user_id IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM public.employee_registration_requests r
         WHERE r.auth_user_id = NEW.auth_user_id
           AND r.status = 'approved'
           AND r.employee_id = OLD.id
       )
     ) THEN
    RAISE EXCEPTION 'Official job titles can only change after a job-title claim is verified. The initial approved employee mapping is the only exception.';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_verified_employee_job_title() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS employees_role_requires_verified_claim ON public.employees;
CREATE TRIGGER employees_role_requires_verified_claim
BEFORE UPDATE OF role ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.enforce_verified_employee_job_title();

CREATE OR REPLACE FUNCTION public.submit_employee_profile_claim(p_claim_type text, p_skill_id text DEFAULT NULL::text, p_claimed_level integer DEFAULT NULL::integer, p_claimed_years numeric DEFAULT NULL::numeric, p_title text DEFAULT NULL::text, p_organization text DEFAULT NULL::text, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_description text DEFAULT NULL::text, p_evidence_url text DEFAULT NULL::text, p_evidence_label text DEFAULT NULL::text, p_claim_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  if v_type not in ('skill', 'experience', 'certification', 'employment', 'education', 'job-title') then
    raise exception 'Unsupported profile claim type.';
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
  if v_type in ('employment', 'education') and v_title is null then
    raise exception 'A job title or qualification is required.';
  end if;
  if v_type = 'job-title' and v_title is null then
    raise exception 'A requested job title is required.';
  end if;
  if v_type = 'job-title' and v_description is null then
    raise exception 'Explain the reason for the requested job-title change.';
  end if;
  if v_type = 'job-title' and exists (
    select 1 from public.employee_profile_claims c
    where c.employee_id = v_employee_id
      and c.claim_type = 'job-title'
      and c.status = 'pending-verification'
      and c.id is distinct from p_claim_id
  ) then
    raise exception 'You already have a pending job-title change request.';
  end if;
  if v_type = 'job-title' and exists (
    select 1 from public.employees e
    where e.id = v_employee_id
      and pg_catalog.lower(pg_catalog.btrim(e.role)) = pg_catalog.lower(v_title)
  ) then
    raise exception 'The requested title matches your current official title.';
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
      v_employee_id, v_type, case when v_type = 'skill' then p_skill_id else null end,
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


CREATE OR REPLACE FUNCTION public.review_employee_profile_claim(p_claim_id uuid, p_decision text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_reviewer_id text := public.current_employee_id(); v_reviewer_role text := public.current_system_role(); v_reviewer_name text; v_decision text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_decision,''))); v_notes text := nullif(pg_catalog.btrim(coalesce(p_notes,'')),''); v_claim public.employee_profile_claims%rowtype;
BEGIN
 IF auth.uid() IS NULL OR v_reviewer_id IS NULL OR NOT public.is_reviewer_or_admin() THEN RAISE EXCEPTION 'Only an authenticated manager, HR reviewer, or administrator can review profile claims.'; END IF;
 IF v_decision NOT IN ('verified','rejected','needs-more-evidence') THEN RAISE EXCEPTION 'Decision must be verified, rejected, or needs-more-evidence.'; END IF;
 IF pg_catalog.length(coalesce(v_notes,'')) > 2000 THEN RAISE EXCEPTION 'Review notes must be 2000 characters or fewer.'; END IF;
 IF v_decision <> 'verified' AND v_notes IS NULL THEN RAISE EXCEPTION 'A reviewer note is required when rejecting a claim or requesting more evidence.'; END IF;
 SELECT e.name INTO v_reviewer_name FROM public.employees e WHERE e.id=v_reviewer_id AND e.auth_user_id=auth.uid();
 IF v_reviewer_name IS NULL THEN RAISE EXCEPTION 'The reviewer employee profile could not be verified.'; END IF;
 SELECT c.* INTO v_claim FROM public.employee_profile_claims c WHERE c.id=p_claim_id FOR UPDATE;
 IF v_claim.id IS NULL THEN RAISE EXCEPTION 'Profile claim not found.'; END IF;
 IF v_claim.employee_id=v_reviewer_id THEN RAISE EXCEPTION 'You cannot verify your own profile claims.'; END IF;
 IF EXISTS (
   SELECT 1
   FROM public.employee_profile_claim_audit a
   WHERE a.claim_id = v_claim.id
     AND a.actor_employee_id = v_reviewer_id
     AND a.action IN ('submitted', 'resubmitted')
 ) THEN
   RAISE EXCEPTION 'You cannot review a profile claim that you submitted.';
 END IF;
 IF v_claim.status <> 'pending-verification' THEN RAISE EXCEPTION 'Only pending claims can be reviewed. The employee must resubmit claims that need more evidence.'; END IF;
 UPDATE public.employee_profile_claims SET status=v_decision, reviewer_employee_id=v_reviewer_id, reviewer_name=v_reviewer_name, reviewer_notes=v_notes, reviewed_at=now(), updated_at=now() WHERE id=v_claim.id RETURNING * INTO v_claim;
 IF v_decision='verified' AND v_claim.claim_type='skill' THEN
  INSERT INTO public.employee_skills(employee_id,skill_id,level,updated_at) VALUES(v_claim.employee_id,v_claim.skill_id,v_claim.claimed_level,now()) ON CONFLICT(employee_id,skill_id) DO UPDATE SET level=excluded.level, updated_at=now();
 ELSIF v_decision='verified' AND v_claim.claim_type='experience' THEN
  UPDATE public.employees SET years_experience=v_claim.claimed_years, updated_at=now() WHERE id=v_claim.employee_id;
 ELSIF v_decision='verified' AND v_claim.claim_type='job-title' THEN
  PERFORM pg_catalog.set_config('togetherly.allow_verified_job_title_change', v_claim.employee_id, true);
  UPDATE public.employees SET role=v_claim.title, updated_at=now() WHERE id=v_claim.employee_id;
  PERFORM pg_catalog.set_config('togetherly.allow_verified_job_title_change', '', true);
 END IF;
 INSERT INTO public.employee_profile_claim_audit(claim_id,employee_id,action,actor_employee_id,actor_name,actor_role,note) VALUES(v_claim.id,v_claim.employee_id,v_decision,v_reviewer_id,v_reviewer_name,CASE WHEN v_reviewer_role IN ('manager','hr','admin') THEN v_reviewer_role ELSE 'manager' END,v_notes);
 RETURN pg_catalog.to_jsonb(v_claim);
END;
$function$;


CREATE OR REPLACE FUNCTION public.admin_submit_employee_job_title_claim(
  p_employee_id text,
  p_requested_title text,
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
  v_target_name text;
  v_current_title text;
  v_title text := nullif(pg_catalog.btrim(coalesce(p_requested_title, '')), '');
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_claim public.employee_profile_claims%rowtype;
BEGIN
  IF auth.uid() IS NULL OR v_actor_id IS NULL OR v_actor_role <> 'admin' THEN
    RAISE EXCEPTION 'Only an authenticated administrator can request job-title changes for other employee records.';
  END IF;

  IF p_employee_id IS NULL OR pg_catalog.btrim(p_employee_id) = '' THEN
    RAISE EXCEPTION 'Select an employee for the job-title change request.';
  END IF;
  IF v_title IS NULL OR pg_catalog.length(v_title) > 180 THEN
    RAISE EXCEPTION 'The requested job title is required and must be 180 characters or fewer.';
  END IF;
  IF v_reason IS NULL OR pg_catalog.length(v_reason) > 2000 THEN
    RAISE EXCEPTION 'A reason is required and must be 2,000 characters or fewer.';
  END IF;

  SELECT e.name, e.role
  INTO v_target_name, v_current_title
  FROM public.employees e
  WHERE e.id = p_employee_id
    AND e.employment_status = 'active'
  FOR UPDATE;

  IF v_target_name IS NULL THEN
    RAISE EXCEPTION 'The selected active employee record was not found.';
  END IF;
  IF pg_catalog.lower(pg_catalog.btrim(coalesce(v_current_title, ''))) = pg_catalog.lower(v_title) THEN
    RAISE EXCEPTION 'The requested title matches the current official title.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.employee_profile_claims c
    WHERE c.employee_id = p_employee_id
      AND c.claim_type = 'job-title'
      AND c.status = 'pending-verification'
  ) THEN
    RAISE EXCEPTION 'This employee already has a pending job-title change request.';
  END IF;

  SELECT e.name
  INTO v_actor_name
  FROM public.employees e
  WHERE e.id = v_actor_id
    AND e.auth_user_id = auth.uid()
    AND e.employment_status = 'active';

  IF v_actor_name IS NULL THEN
    RAISE EXCEPTION 'The authenticated administrator profile could not be verified.';
  END IF;

  INSERT INTO public.employee_profile_claims (
    employee_id, claim_type, title, description, status,
    submitted_at, created_at, updated_at
  ) VALUES (
    p_employee_id, 'job-title', v_title,
    'Current official title: ' || coalesce(v_current_title, 'Not assigned') ||
      E'\nReason: ' || v_reason,
    'pending-verification', pg_catalog.now(), pg_catalog.now(), pg_catalog.now()
  )
  RETURNING * INTO v_claim;

  INSERT INTO public.employee_profile_claim_audit (
    claim_id, employee_id, action, actor_employee_id, actor_name, actor_role, note
  ) VALUES (
    v_claim.id, p_employee_id, 'submitted', v_actor_id, v_actor_name, 'admin',
    'Administrator submitted a job-title change request for ' || v_target_name || '. Verification is required before the official title changes.'
  );

  RETURN pg_catalog.to_jsonb(v_claim);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_submit_employee_job_title_claim(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_submit_employee_job_title_claim(text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
