// Shared helpers for the API routes. Files in api/_lib are not exposed as
// endpoints by Vercel because the folder name starts with an underscore.
import { createClient } from "@supabase/supabase-js";

export const REVIEW_LINK = "https://g.page/r/CaEev-cZV_wZECE/review";

export function cors(req, res, methods = "POST, OPTIONS") {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

export function serviceClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Returns { admin, user } when the bearer token belongs to an admin,
// otherwise sends the error response and returns null.
export async function requireAdmin(req, res) {
  const admin = serviceClient();
  if (!admin) {
    res.status(503).json({ error: "This action is temporarily unavailable. Please contact support." });
    return null;
  }
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "Please sign in again." });
    return null;
  }
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    res.status(401).json({ error: "Your session has expired. Please sign in again." });
    return null;
  }
  const { data: profile } = await admin.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (!profile || profile.role !== "admin") {
    res.status(403).json({ error: "You do not have permission to do this." });
    return null;
  }
  return { admin, user: userData.user };
}

export const money = (n) => "£" + Number(n || 0).toFixed(2);

// ---------- Email ----------
// Uses Resend (resend.com). Without RESEND_API_KEY set, emails are skipped
// and logged, so nothing breaks while email is being set up.
export async function sendEmail({ to, subject, text }) {
  if (!to) return { skipped: "no recipient" };
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log("Email skipped (RESEND_API_KEY not set):", subject, "->", to);
    return { skipped: "not configured" };
  }
  const from = process.env.EMAIL_FROM || "Diaspora Direct <hello@diaspora-direct.com>";
  const html = text
    .split("\n\n")
    .map((p) => `<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#26301F">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text, html, reply_to: process.env.EMAIL_REPLY_TO || undefined }),
    });
    if (!resp.ok) {
      console.error("Email failed", resp.status, await resp.text());
      return { error: resp.status };
    }
    return { sent: true };
  } catch (e) {
    console.error("Email failed", e);
    return { error: e.message };
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

export async function emailAdmin(subject, text) {
  return sendEmail({ to: process.env.ADMIN_NOTIFY_EMAIL, subject, text });
}

async function clientContact(admin, clientId) {
  const { data } = await admin.from("profiles").select("full_name, email").eq("id", clientId).maybeSingle();
  return data || {};
}

const firstName = (name) => (String(name || "").trim().split(/\s+/)[0] || "there");
const SIGN_OFF = "Warm regards,\nCarol\nDiaspora Direct\nOn-the-Ground Help You Can Trust";

// ---------- Payment received ----------
// The single place a request becomes "paid". It only acts once per request
// (paid_at must still be empty), so the Stripe webhook, the app's own check
// and the admin button can all call it safely. The acknowledgement goes out
// only from here, so a client is never told we have their money until we do.
export async function markRequestPaid(admin, requestId, { method, stripeSessionId } = {}) {
  const now = new Date().toISOString();
  const patch = { status: "requested", paid_at: now };
  if (stripeSessionId) patch.stripe_session_id = stripeSessionId;
  const { data: rows, error } = await admin
    .from("requests")
    .update(patch)
    .eq("id", requestId)
    .is("paid_at", null)
    .in("status", ["pending_payment", "awaiting_transfer", "payment_review", "cancelled"])
    .select();
  if (error) throw error;
  const request = rows && rows[0];
  if (!request) return { alreadyDone: true };

  const client = await clientContact(admin, request.client_id);
  const ref = request.payment_ref || "your booking";
  const result = await sendEmail({
    to: client.email,
    subject: `Payment received: ${ref}`,
    text:
      `Hi ${firstName(client.full_name)},\n\n` +
      `Thank you. We have received your payment of ${money(request.fee)} for "${request.title}" (reference ${ref}).\n\n` +
      `Your request is now with our team in Zimbabwe and we will email you as soon as an agent is on it. ` +
      `You can follow every step in the Diaspora Direct app.\n\n` +
      SIGN_OFF,
  });
  if (result.sent) {
    await admin.from("requests").update({ acknowledged_at: new Date().toISOString() }).eq("id", request.id);
  }
  await emailAdmin(
    `New paid request ${ref} (${method || "payment"})`,
    `${client.full_name || "A client"} paid ${money(request.fee)} by ${method || "payment"} for "${request.title}" in ${request.city || "Zimbabwe"}.\n\nIt is now in the agent queue.`
  );
  return { request };
}

export async function notifyStatusChange(admin, request, oldStatus) {
  if (!request || request.status === oldStatus) return;
  const client = await clientContact(admin, request.client_id);
  const ref = request.payment_ref || "your booking";
  const hi = `Hi ${firstName(client.full_name)},\n\n`;
  if (request.status === "assigned") {
    await sendEmail({
      to: client.email,
      subject: `An agent is on it: ${ref}`,
      text: hi + `Good news. A vetted Diaspora Direct agent has been assigned to "${request.title}". We will keep you updated in the app and by email.\n\n` + SIGN_OFF,
    });
  } else if (request.status === "in_progress") {
    await sendEmail({
      to: client.email,
      subject: `Work has started: ${ref}`,
      text: hi + `Your agent has started work on "${request.title}". Any updates and photos will come to you from our team in the app.\n\n` + SIGN_OFF,
    });
  } else if (request.status === "completed") {
    await sendEmail({
      to: client.email,
      subject: `Completed: ${ref}`,
      text:
        hi +
        `"${request.title}" is now complete. Thank you for trusting us with it.\n\n` +
        `If you were happy with the service, a short Google review helps other families find us:\n${REVIEW_LINK}\n\n` +
        SIGN_OFF,
    });
  } else if (request.status === "payment_review") {
    await emailAdmin(
      `Bank transfer to check: ${ref}`,
      `${client.full_name || "A client"} says they have sent ${money(request.fee)} for "${request.title}" (reference ${ref}).\n\nCheck the Wise account, then tap "Mark payment received" in the app admin screen.`
    );
  }
}
