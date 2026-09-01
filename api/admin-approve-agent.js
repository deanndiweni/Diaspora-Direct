import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
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

  const { agentId, approve } = req.body || {};
  if (!agentId) {
    res.status(400).json({ error: "Missing agentId." });
    return;
  }

  const updates = approve === false
  ? { approved: false, approved_at: null }
    : { approved: true, approved_at: new Date().toISOString() };

  const { error: updateError } = await admin.from("agents").update(updates).eq("id", agentId);
  if (updateError) throw updateError;

  res.status(200).json({ ok: true });
} catch (error) {
  console.error("Admin agent approval failed", error);
  res.status(500).json({ error: "We could not update this agent. Please try again." });
}
}
