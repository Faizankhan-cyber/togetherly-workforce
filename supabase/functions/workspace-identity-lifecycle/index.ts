const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type LifecycleAction = "offboard" | "cleanup";
type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function responseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (!isJsonRecord(body)) return fallback;
  const message = [body.message, body.msg, body.error_description, body.error]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);
  return message ?? fallback;
}

function placeholderEmail(employeeId: string) {
  const safeId = employeeId.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  return "offboarded+" + safeId + "@removed.invalid";
}

function userRequestHeaders(anonKey: string, authorization: string, json = false): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: anonKey,
    Authorization: authorization,
  };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

function serviceRequestHeaders(serviceRoleKey: string, json = false): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: serviceRoleKey,
    Authorization: "Bearer " + serviceRoleKey,
  };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ success: false, error: "Use POST for account lifecycle actions." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ success: false, error: "Authentication required." }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL")?.replace(/\/+$/, "");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) {
    return jsonResponse({ success: false, error: "Server-side Supabase Auth administration is not configured." }, 500);
  }

  try {
    // Verify the caller using their own bearer token. No service credential is returned to the browser.
    const userResponse = await fetch(url + "/auth/v1/user", {
      headers: userRequestHeaders(anonKey, authorization),
    });
    const userData = await responseBody(userResponse);
    if (!userResponse.ok || !isJsonRecord(userData) || typeof userData.id !== "string") {
      return jsonResponse({ success: false, error: "The caller's session is invalid or expired." }, 401);
    }
    const userId = userData.id;

    const rawBody: unknown = await request.json().catch(() => ({}));
    const body = isJsonRecord(rawBody) ? rawBody : {};
    const action = body.action === "offboard" || body.action === "cleanup" ? body.action : undefined;
    const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() : "";
    if (!employeeId || (action !== "offboard" && action !== "cleanup")) {
      return jsonResponse({ success: false, error: "A valid action and employeeId are required." }, 400);
    }

    const serviceHeaders = serviceRequestHeaders(serviceRoleKey);
    const employeeFields = "id,name,system_role,employment_status,auth_user_id,email";
    const actorResponse = await fetch(
      url + "/rest/v1/employees?auth_user_id=eq." + encodeURIComponent(userId) +
        "&employment_status=eq.active&select=" + employeeFields + "&limit=1",
      { headers: serviceHeaders },
    );
    const actorRows = await responseBody(actorResponse);
    if (!actorResponse.ok || !Array.isArray(actorRows) || !isJsonRecord(actorRows[0])) {
      return jsonResponse({ success: false, error: "An active linked workspace profile is required." }, 403);
    }
    const actor = actorRows[0];
    const actorRole = typeof actor.system_role === "string" ? actor.system_role : "";

    if (action === "cleanup" && actorRole !== "admin") {
      return jsonResponse({ success: false, error: "Only an active administrator can retry Auth cleanup." }, 403);
    }
    if (action === "offboard" && !["manager", "hr", "admin"].includes(actorRole)) {
      return jsonResponse({ success: false, error: "Only an active Manager, HR reviewer, or Administrator can offboard an employee." }, 403);
    }

    const targetResponse = await fetch(
      url + "/rest/v1/employees?id=eq." + encodeURIComponent(employeeId) + "&select=" + employeeFields + "&limit=1",
      { headers: serviceHeaders },
    );
    const targetRows = await responseBody(targetResponse);
    if (!targetResponse.ok || !Array.isArray(targetRows) || !isJsonRecord(targetRows[0])) {
      return jsonResponse({ success: false, error: "The employee record was not found." }, 404);
    }
    const target = targetRows[0];

    if (action === "offboard") {
      if (target.employment_status !== "active") {
        return jsonResponse({ success: false, error: "This employee is already offboarded. Use Admin Access to retry Auth cleanup." }, 409);
      }
      if (target.auth_user_id === userId) return jsonResponse({ success: false, error: "You cannot offboard your own account." }, 403);
      if (target.system_role === "admin" && actorRole !== "admin") {
        return jsonResponse({ success: false, error: "Only an administrator can offboard another administrator." }, 403);
      }

      const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
      if (reason.length < 5 || reason.length > 1000) {
        return jsonResponse({ success: false, error: "Enter a reason between 5 and 1000 characters." }, 400);
      }

      // The SQL RPC atomically preserves the original email in the audit, frees the unique
      // employee email, marks the profile offboarded, and clears active project allocations.
      const offboardResponse = await fetch(url + "/rest/v1/rpc/offboard_employee", {
        method: "POST",
        headers: userRequestHeaders(anonKey, authorization, true),
        body: JSON.stringify({ p_employee_id: employeeId, p_reason: reason }),
      });
      if (!offboardResponse.ok) {
        const failure = await responseBody(offboardResponse);
        return jsonResponse({ success: false, error: errorMessage(failure, "Could not complete employee offboarding.") }, 400);
      }

      if (!target.auth_user_id) {
        return jsonResponse({ success: true, authCleanupPending: false, message: "Offboarding completed; no Supabase Auth account was linked." });
      }

      const cleanup = await deleteAndUnlinkAuthUser(url, serviceRoleKey, employeeId, String(target.auth_user_id));
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

    const cleanup = await deleteAndUnlinkAuthUser(url, serviceRoleKey, employeeId, String(target.auth_user_id));
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
  url: string,
  serviceRoleKey: string,
  employeeId: string,
  authUserId: string,
): Promise<{ success: boolean; error?: string }> {
  const adminHeaders = serviceRequestHeaders(serviceRoleKey);
  const authUserUrl = url + "/auth/v1/admin/users/" + encodeURIComponent(authUserId);
  const lookupResponse = await fetch(authUserUrl, { headers: adminHeaders });

  if (!lookupResponse.ok && lookupResponse.status !== 404) {
    const failure = await responseBody(lookupResponse);
    return { success: false, error: "Could not verify the old Auth account: " + errorMessage(failure, "Auth lookup failed.") };
  }

  if (lookupResponse.ok) {
    // A successful lookup confirms this auth.users record still exists and must be permanently deleted.
    const deleteResponse = await fetch(authUserUrl, { method: "DELETE", headers: adminHeaders });
    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      const failure = await responseBody(deleteResponse);
      return { success: false, error: "Supabase could not delete the old Auth account: " + errorMessage(failure, "Auth deletion failed.") };
    }
  }

  const updateResponse = await fetch(
    url + "/rest/v1/employees?id=eq." + encodeURIComponent(employeeId) +
      "&employment_status=eq.offboarded&auth_user_id=eq." + encodeURIComponent(authUserId) +
      "&select=id,auth_user_id",
    {
      method: "PATCH",
      headers: {
        ...serviceRequestHeaders(serviceRoleKey, true),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        auth_user_id: null,
        email: placeholderEmail(employeeId),
        updated_at: new Date().toISOString(),
      }),
    },
  );

  if (!updateResponse.ok) {
    const failure = await responseBody(updateResponse);
    return { success: false, error: "The Auth account was handled, but its historical profile could not be unlinked yet: " + errorMessage(failure, "Profile update failed.") };
  }

  const updatedRows = await responseBody(updateResponse);
  if (Array.isArray(updatedRows) && updatedRows.length > 0) return { success: true };

  // Idempotent retry: if a prior request already unlinked the identity, treat it as complete.
  const verifyResponse = await fetch(
    url + "/rest/v1/employees?id=eq." + encodeURIComponent(employeeId) + "&select=id,auth_user_id,employment_status&limit=1",
    { headers: adminHeaders },
  );
  const verifyRows = await responseBody(verifyResponse);
  const verifiedEmployee = Array.isArray(verifyRows) && isJsonRecord(verifyRows[0]) ? verifyRows[0] : null;
  if (verifyResponse.ok && verifiedEmployee?.employment_status === "offboarded" && !verifiedEmployee.auth_user_id) {
    return { success: true };
  }
  return { success: false, error: "Auth cleanup could not verify that the historical account was unlinked. Retry from Admin Access." };
}
