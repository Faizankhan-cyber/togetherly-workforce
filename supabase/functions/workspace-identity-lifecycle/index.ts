import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type LifecycleAction = "offboard" | "cleanup";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isMissingAuthUser(message: string) {
  const lower = message.toLowerCase();
  return lower.includes("not found") || lower.includes("does not exist") || lower.includes("no user");
}

function placeholderEmail(employeeId: string) {
  const safeId = employeeId.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  return "offboarded+" + safeId + "@removed.invalid";
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ success: false, error: "Use POST for account lifecycle actions." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ success: false, error: "Authentication required." }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) {
    return jsonResponse({ success: false, error: "Server-side Supabase Auth administration is not configured." }, 500);
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData.user;
    if (userError || !user) return jsonResponse({ success: false, error: "The caller's session is invalid or expired." }, 401);

    const body = await request.json().catch(() => ({}));
    const action = body?.action as LifecycleAction | undefined;
    const employeeId = typeof body?.employeeId === "string" ? body.employeeId.trim() : "";
    if (!employeeId || (action !== "offboard" && action !== "cleanup")) {
      return jsonResponse({ success: false, error: "A valid action and employeeId are required." }, 400);
    }

    const { data: actor, error: actorError } = await adminClient
      .from("employees")
      .select("id, name, system_role, employment_status, auth_user_id")
      .eq("auth_user_id", user.id)
      .eq("employment_status", "active")
      .maybeSingle();

    if (actorError || !actor) return jsonResponse({ success: false, error: "An active linked workspace profile is required." }, 403);
    const actorRole = String(actor.system_role ?? "");
    if (action === "cleanup" && actorRole !== "admin") {
      return jsonResponse({ success: false, error: "Only an active administrator can retry Auth cleanup." }, 403);
    }
    if (action === "offboard" && !["manager", "hr", "admin"].includes(actorRole)) {
      return jsonResponse({ success: false, error: "Only an active Manager, HR reviewer, or Administrator can offboard an employee." }, 403);
    }

    const { data: target, error: targetError } = await adminClient
      .from("employees")
      .select("id, auth_user_id, name, email, system_role, employment_status")
      .eq("id", employeeId)
      .maybeSingle();

    if (targetError || !target) return jsonResponse({ success: false, error: "The employee record was not found." }, 404);

    if (action === "offboard") {
      if (target.employment_status !== "active") {
        return jsonResponse({ success: false, error: "This employee is already offboarded. Use Admin Access to retry Auth cleanup." }, 409);
      }
      if (target.auth_user_id === user.id) return jsonResponse({ success: false, error: "You cannot offboard your own account." }, 403);
      if (target.system_role === "admin" && actorRole !== "admin") {
        return jsonResponse({ success: false, error: "Only an administrator can offboard another administrator." }, 403);
      }

      const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
      if (reason.length < 5 || reason.length > 1000) {
        return jsonResponse({ success: false, error: "Enter a reason between 5 and 1000 characters." }, 400);
      }

      const { error: offboardError } = await userClient.rpc("offboard_employee", {
        p_employee_id: employeeId,
        p_reason: reason,
      });
      if (offboardError) return jsonResponse({ success: false, error: offboardError.message }, 400);

      if (!target.auth_user_id) {
        return jsonResponse({ success: true, authCleanupPending: false, message: "Offboarding completed; no Supabase Auth account was linked." });
      }

      const cleanup = await deleteAndUnlinkAuthUser(adminClient, employeeId, target.auth_user_id);
      return jsonResponse({
        success: true,
        authCleanupPending: !cleanup.success,
        error: cleanup.success ? undefined : cleanup.error,
        message: cleanup.success
          ? "Offboarding and Supabase Auth deletion completed. The email is available for a new registration."
          : "Offboarding completed, but Auth cleanup is pending. An administrator can retry it under Admin Access.",
      });
    }

    if (target.employment_status !== "offboarded") {
      return jsonResponse({ success: false, error: "Only offboarded accounts can be cleaned up here." }, 409);
    }
    if (!target.auth_user_id) {
      return jsonResponse({ success: true, authCleanupPending: false, alreadyCleaned: true });
    }

    const cleanup = await deleteAndUnlinkAuthUser(adminClient, employeeId, target.auth_user_id);
    if (!cleanup.success) {
      return jsonResponse({ success: false, authCleanupPending: true, error: cleanup.error }, 500);
    }

    return jsonResponse({ success: true, authCleanupPending: false, message: "The stale Auth identity was removed and the original email can be registered again." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected account lifecycle error.";
    return jsonResponse({ success: false, error: message }, 500);
  }
});

async function deleteAndUnlinkAuthUser(
  adminClient: ReturnType<typeof createClient>,
  employeeId: string,
  authUserId: string,
): Promise<{ success: boolean; error?: string }> {
  const { data: userData, error: lookupError } = await adminClient.auth.admin.getUserById(authUserId);
  if (lookupError && !isMissingAuthUser(lookupError.message)) {
    return { success: false, error: "Could not verify the old Auth account: " + lookupError.message };
  }

  if (userData.user) {
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(authUserId);
    if (deleteError && !isMissingAuthUser(deleteError.message)) {
      return { success: false, error: "Supabase could not delete the old Auth account: " + deleteError.message };
    }
  }

  const { error: unlinkError } = await adminClient
    .from("employees")
    .update({
      auth_user_id: null,
      email: placeholderEmail(employeeId),
      updated_at: new Date().toISOString(),
    })
    .eq("id", employeeId)
    .eq("employment_status", "offboarded")
    .eq("auth_user_id", authUserId);

  if (unlinkError) {
    return { success: false, error: "The Auth account was handled, but its historical profile could not be unlinked yet: " + unlinkError.message };
  }
  return { success: true };
}
