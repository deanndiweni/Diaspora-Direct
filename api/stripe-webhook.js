import Stripe from "stripe";
import { serviceClient } from "./_lib/server.js";
import { recordCardPayment } from "./verify-checkout.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe calls this the moment a card payment succeeds, even if the customer
// closes the app before returning from the payment page. We never trust the
// incoming body: we take only the event id and fetch the event and session
// straight from Stripe with our secret key.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body);
    if (Buffer.isBuffer(body)) body = JSON.parse(body.toString("utf8"));
    const eventId = body && body.id;
    if (!eventId || !/^evt_/.test(eventId)) {
      res.status(400).json({ error: "Missing event id" });
      return;
    }
    const event = await stripe.events.retrieve(eventId);
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = await stripe.checkout.sessions.retrieve(event.data.object.id);
      const admin = serviceClient();
      if (!admin) throw new Error("Supabase service key missing");
      const result = await recordCardPayment(admin, session);
      console.log("Stripe webhook", event.type, session.id, JSON.stringify(result && (result.skipped || result.alreadyDone || "paid")));
    }
    res.status(200).json({ received: true });
  } catch (e) {
    console.error("Stripe webhook failed", e);
    res.status(500).json({ error: "Webhook handling failed" });
  }
}
