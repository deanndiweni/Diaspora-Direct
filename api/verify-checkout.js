import Stripe from "stripe";
import { cors, serviceClient, markRequestPaid } from "./_lib/server.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Called by the app when the customer returns from Stripe. It asks Stripe
// directly whether the session was paid, and if so records the payment on the
// server. The app itself can no longer mark anything as paid.
export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const { sessionId } = req.body || {};
    if (!sessionId || !/^cs_/.test(sessionId)) {
      res.status(400).json({ error: "Missing sessionId" });
      return;
    }
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const requestId = (session.metadata && session.metadata.request_id) || null;
    const paid = session.payment_status === "paid";
    if (paid && requestId) {
      const admin = serviceClient();
      if (admin) await recordCardPayment(admin, session);
    }
    res.status(200).json({ paid, request_id: requestId });
  } catch (e) {
    console.error("Checkout verification failed", e);
    res.status(500).json({ error: "We couldn't check the payment just now." });
  }
}

export async function recordCardPayment(admin, session) {
  const requestId = session.metadata && session.metadata.request_id;
  if (!requestId || session.payment_status !== "paid") return { skipped: true };
  const { data: request } = await admin.from("requests").select("id, fee, paid_at").eq("id", requestId).maybeSingle();
  if (!request) return { skipped: "unknown request" };
  if (request.paid_at) return { alreadyDone: true };
  const expected = Math.round(Number(request.fee) * 100);
  if (session.currency !== "gbp" || session.amount_total !== expected) {
    console.error("Amount mismatch", requestId, session.amount_total, expected);
    return { skipped: "amount mismatch" };
  }
  return markRequestPaid(admin, requestId, { method: "card", stripeSessionId: session.id });
}
