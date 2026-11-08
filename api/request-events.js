import { serviceClient, notifyStatusChange, emailAdmin } from "./_lib/server.js";

// Called by the database (see supabase/migrations/20261108_notifications.sql)
// whenever a request changes or a message is sent, so clients get email
// updates automatically and the admin is told what needs attention.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const secret = process.env.DB_WEBHOOK_SECRET;
  if (!secret || req.headers["x-webhook-secret"] !== secret) {
    res.status(401).json({ error: "Unauthorised" });
    return;
  }
  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body);
    const { table, type, record, old_record } = body || {};
    const admin = serviceClient();
    if (!admin || !record) {
      res.status(200).json({ ignored: true });
      return;
    }
    if (table === "requests" && type === "UPDATE" && old_record) {
      // Payment confirmations email the client from markRequestPaid, so skip them here.
      const becamePaid = record.status === "requested" && old_record.status !== "requested";
      if (!becamePaid) await notifyStatusChange(admin, record, old_record.status);
    } else if (table === "messages" && type === "INSERT") {
      const { data: sender } = await admin.from("profiles").select("full_name, role").eq("id", record.sender_id).maybeSingle();
      if (sender && sender.role !== "admin") {
        const { data: request } = await admin.from("requests").select("title, payment_ref").eq("id", record.request_id).maybeSingle();
        await emailAdmin(
          `New message from ${sender.role} ${sender.full_name || ""} (${request?.payment_ref || ""})`,
          `On "${request?.title || "a request"}":\n\n${record.content}\n\nReply from the admin screen in the app.`
        );
      }
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Request event failed", e);
    res.status(500).json({ error: "failed" });
  }
}
