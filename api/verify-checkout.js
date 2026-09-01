import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) {
      res.status(400).json({ error: "Missing sessionId" });
      return;
    }
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    res.status(200).json({
      paid: session.payment_status === "paid",
      request_id: (session.metadata && session.metadata.request_id) || null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
