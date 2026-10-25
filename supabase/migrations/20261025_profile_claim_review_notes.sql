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
 IF v_claim.status <> 'pending-verification' THEN RAISE EXCEPTION 'Only pending claims can be reviewed. The employee must resubmit claims that need more evidence.'; END IF;
 UPDATE public.employee_profile_claims SET status=v_decision, reviewer_employee_id=v_reviewer_id, reviewer_name=v_reviewer_name, reviewer_notes=v_notes, reviewed_at=now(), updated_at=now() WHERE id=v_claim.id RETURNING * INTO v_claim;
 IF v_decision='verified' AND v_claim.claim_type='skill' THEN
  INSERT INTO public.employee_skills(employee_id,skill_id,level,updated_at) VALUES(v_claim.employee_id,v_claim.skill_id,v_claim.claimed_level,now()) ON CONFLICT(employee_id,skill_id) DO UPDATE SET level=excluded.level, updated_at=now();
 ELSIF v_decision='verified' AND v_claim.claim_type='experience' THEN
  UPDATE public.employees SET years_experience=v_claim.claimed_years, updated_at=now() WHERE id=v_claim.employee_id;
 END IF;
 INSERT INTO public.employee_profile_claim_audit(claim_id,employee_id,action,actor_employee_id,actor_name,actor_role,note) VALUES(v_claim.id,v_claim.employee_id,v_decision,v_reviewer_id,v_reviewer_name,CASE WHEN v_reviewer_role IN ('manager','hr','admin') THEN v_reviewer_role ELSE 'manager' END,v_notes);
 RETURN pg_catalog.to_jsonb(v_claim);
END;
$function$
