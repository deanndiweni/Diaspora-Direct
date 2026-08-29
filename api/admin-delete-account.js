import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(503).json({ error: "This action is temporarily unavailable. Please contact support." });
    return;
  }

  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "Please sign in again." });
    return;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) {
      res.status(401).json({ error: "Your session has expired. Please sign in again." });
      return;
    }

    const callerId = userData.user.id;
    const { data: callerProfile, error: callerError } = await admin
      .from("profiles").select("role").eq("id", callerId).maybeSingle();
    if (callerError) throw callerError;
    if (!callerProfile || callerProfile.role !== "admin") {
      res.status(403).json({ error: "You do not have permission to do this." });
      return;
    }

    const { clientId } = req.body || {};
    if (!clientId) {
      res.status(400).json({ error: "Missing clientId." });
      return;
    }

    const userId = clientId;
    const { data: ownedRequests, error: requestsError } = await admin
      .from("requests").select("id").eq("client_id", userId);
    if (requestsError) throw requestsError;

    const requestIds = (ownedRequests || []).map((request) => request.id);
    if (requestIds.length) {
      const { error } = await admin.from("messages").delete().in("request_id", requestIds);
      if (error) throw error;
    }

    const { error: sentMessagesError } = await admin.from("messages").delete().eq("sender_id", userId);
    if (sentMessagesError) throw sentMessagesError;

    const { error: ownedRequestsError } = await admin.from("requests").delete().eq("client_id", userId);
    if (ownedRequestsError) throw ownedRequestsError;

    const { data: agent } = await admin.from("agents").select("id").eq("profile_id", userId).maybeSingle();
    if (agent) {
      const { error: activeError } = await admin.from("requests")
        .update({ agent_id: null, status: "requested" }).eq("agent_id", agent.id).neq("status", "completed");
      if (activeError) throw activeError;
      const { error: completedError } = await admin.from("requests")
        .update({ agent_id: null }).eq("agent_id", agent.id).eq("status", "completed");
      if (completedError) throw completedError;
      const { error: agentError } = await admin.from("agents").delete().eq("id", agent.id);
      if (agentError) throw agentError;
    }

    const { error: profileError } = await admin.from("profiles").delete().eq("id", userId);
    if (profileError) throw profileError;
    const { error: authError } = await admin.auth.admin.deleteUser(userId);
    if (authError) throw authError;

    res.status(200).json({ deleted: true });
  } catch (error) {
    console.error("Admin account deletion failed", error);
    res.status(500).json({ error: "We could not delete this account. Please try again." });
  }
}
