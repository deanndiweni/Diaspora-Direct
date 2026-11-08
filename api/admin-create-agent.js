import crypto from "node:crypto";
import { cors, requireAdmin } from "./_lib/server.js";

// Only the admin can register agents. Creates (or promotes) the account,
// marks it as an approved agent, and returns a one-time temporary password
// for the admin to pass on privately. The agent can change it in Profile.
export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    const { admin } = ctx;
    const fullName = String(req.body?.fullName || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const phone = String(req.body?.phone || "").trim() || null;
    const region = String(req.body?.region || "").trim() || null;
    if (!fullName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      res.status(400).json({ error: "Please enter the agent's full name and a valid email." });
      return;
    }

    let userId;
    let tempPassword = null;
    const { data: existing } = await admin.from("profiles").select("id, role").eq("email", email).maybeSingle();
    if (existing) {
      if (existing.role === "admin") {
        res.status(400).json({ error: "That email belongs to an admin account." });
        return;
      }
      userId = existing.id;
    } else {
      tempPassword = "DD-" + crypto.randomBytes(6).toString("base64url");
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email, password: tempPassword, email_confirm: true, user_metadata: { full_name: fullName, phone },
      });
      if (createError) {
        res.status(400).json({ error: createError.message || "We could not create this account." });
        return;
      }
      userId = created.user.id;
    }

    const { error: profileError } = await admin.from("profiles").upsert(
      { id: userId, full_name: fullName, email, phone, role: "agent" },
      { onConflict: "id" }
    );
    if (profileError) throw profileError;

    const now = new Date().toISOString();
    const { data: agentRow } = await admin.from("agents").select("id").eq("profile_id", userId).maybeSingle();
    if (agentRow) {
      const { error } = await admin.from("agents").update({ approved: true, approved_at: now, region }).eq("id", agentRow.id);
      if (error) throw error;
    } else {
      const { error } = await admin.from("agents").insert({ profile_id: userId, region, approved: true, approved_at: now });
      if (error) throw error;
    }

    res.status(200).json({ ok: true, email, tempPassword, promoted: Boolean(existing) });
  } catch (e) {
    console.error("Create agent failed", e);
    res.status(500).json({ error: "We could not add this agent. Please try again." });
  }
}
