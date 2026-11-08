import { serviceClient, notifyStatusChange, emailAdmin } from "./_lib/server.js";

// Called by the database (supabase/migrations/20261108_notifications.sql)
// whenever a request's status changes or a message is sent. The body only
// carries the table and row id: we re-read the row with the service key and
// only act on changes that have not been notified yet, so calling this from
// anywhere else cannot send anything that is not genuinely due.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body);
    const { table, id } = body || {};
    const admin = serviceClient();
    if (!admin || !id || !/^[0-9a-f-]{36}$/i.test(String(id))) {
      res.status(200).json({ ignored: true });
      return;
    }

    if (table === "requests") {
      const { data: request } = await admin.from("requests").select("*").eq("id", id).maybeSingle();
      if (!request || request.status === request.notified_status) {
        res.status(200).json({ ok: true, nothing: true });
        return;
      }
      const previous = request.notified_status;
      let claim = admin.from("requests").update({ notified_status: request.status })
        .eq("id", id).eq("status", request.status);
      claim = previous === null ? claim.is("notified_status", null) : claim.eq("notified_status", previous);
      const { data: claimed } = await claim.select("id");
      // Payment confirmations are emailed by markRequestPaid, so skip them here.
      if (claimed && claimed.length && request.status !== "requested") {
        await notifyStatusChange(admin, request, previous);
      }
    } else if (table === "messages") {
      const { data: claimed } = await admin.from("messages")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", id).is("notified_at", null).select("*");
      const message = claimed && claimed[0];
      if (message) {
        const { data: sender } = await admin.from("profiles").select("full_name, role").eq("id", message.sender_id).maybeSingle();
        if (sender && sender.role !== "admin") {
          const { data: request } = await admin.from("requests").select("title, payment_ref").eq("id", message.request_id).maybeSingle();
          await emailAdmin(
            `New message from ${sender.role} ${sender.full_name || ""} (${request?.payment_ref || ""})`,
            `On "${request?.title || "a request"}":\n\n${message.content}\n\nReply from the admin screen in the app.`
          );
        }
      }
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Request event failed", e);
    res.status(500).json({ error: "failed" });
  }
}
