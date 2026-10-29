// Shared helpers for monthly package subscriptions. Vercel does not turn
// files starting with "_" into endpoints, so this is only imported by the
// /api handlers next to it.
import { createClient } from "@supabase/supabase-js";

export function cors(req, res, methods = "POST, OPTIONS") {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return true;
  }
  return false;
}

export function adminClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Works out who is calling from their Supabase sign in token.
export async function userFromRequest(admin, req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data || !data.user) return null;
  return data.user;
}

export function returnBase(req, mobile) {
  const publicAppUrl = (process.env.APP_PUBLIC_URL || "https://app.diaspora-direct.com").replace(/\/$/, "");
  if (mobile) return publicAppUrl + "/checkout-redirect.html";
  const origin = req.headers.origin || "";
  return (/^https?:\/\//i.test(origin) ? origin : publicAppUrl) + "/";
}

export function describeTasks(sub, taskLabels) {
  const lines = [];
  if (sub.recipient_name) lines.push("For: " + sub.recipient_name);
  if (sub.address) lines.push("Address: " + sub.address);
  const tasks = Array.isArray(sub.tasks) ? sub.tasks : [];
  if (tasks.length) {
    lines.push("Welfare check tasks:");
    tasks.forEach((t) => lines.push("- " + (taskLabels[t] || t)));
  }
  if (sub.other_task) lines.push("Other: " + sub.other_task);
  if (sub.notes) lines.push("Notes: " + sub.notes);
  return lines.join("\n");
}

// Called once per paid monthly invoice (first month from verify, later months
// from the Stripe webhook). Creates that month's job in `requests` so agents
// see it in their queue, and never creates the same month twice.
export async function recordPaidInvoice(admin, sub, invoiceId, amountPence) {
  if (!invoiceId) return null;
  const amount = Number(amountPence || 0) / 100 || Number(sub.monthly_price);
  const { error: claimError } = await admin
    .from("subscription_invoices")
    .insert({ invoice_id: invoiceId, subscription_id: sub.id, amount });
  if (claimError) return null; // Already recorded this month.

  const { data: tasks } = await admin.from("welfare_tasks").select("id, label");
  const taskLabels = {};
  (tasks || []).forEach((t) => { taskLabels[t.id] = t.label; });

  const month = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const isMaid = sub.package_id === "live_in_maid";
  const title = isMaid
    ? `Live-in maid: ${month} wage and supervision`
    : `${sub.package_name} care bundle: ${month} grocery shop and welfare check`;

  const { data: request } = await admin
    .from("requests")
    .insert({
      client_id: sub.client_id,
      category: "family",
      title,
      city: sub.city || "",
      country: "Zimbabwe",
      description: describeTasks(sub, taskLabels),
      fee: amount,
      pay_method: "card",
      status: "requested",
    })
    .select("id")
    .single();

  if (request) {
    await admin.from("subscription_invoices").update({ request_id: String(request.id) }).eq("invoice_id", invoiceId);
  }
  return request;
}
