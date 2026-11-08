import { cors, requireAdmin, markRequestPaid } from "./_lib/server.js";

// Admin taps "Mark payment received" once a bank transfer has landed in Wise.
// This is what releases the request to agents and sends the client their
// acknowledgement email.
export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    const { requestId } = req.body || {};
    if (!requestId) {
      res.status(400).json({ error: "Missing requestId." });
      return;
    }
    const { data: request } = await ctx.admin.from("requests").select("pay_method").eq("id", requestId).maybeSingle();
    if (!request) {
      res.status(404).json({ error: "Request not found." });
      return;
    }
    const result = await markRequestPaid(ctx.admin, requestId, { method: request.pay_method === "card" ? "card" : "bank transfer" });
    res.status(200).json({ ok: true, alreadyDone: Boolean(result.alreadyDone) });
  } catch (e) {
    console.error("Confirm payment failed", e);
    res.status(500).json({ error: "We could not record this payment. Please try again." });
  }
}
