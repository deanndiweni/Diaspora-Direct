import Stripe from "stripe";
import { cors, serviceClient } from "./_lib/server.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Starts a Stripe Checkout for a request. The amount always comes from the
// database (set by the server when the request was created), never from the
// app, so a tampered app cannot change what is charged.
export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const admin = serviceClient();
  if (!admin) {
    res.status(503).json({ error: "Card payments are temporarily unavailable." });
    return;
  }
  try {
    const { requestId, mobile } = req.body || {};
    if (!requestId) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const { data: request, error } = await admin.from("requests").select("*").eq("id", requestId).maybeSingle();
    if (error) throw error;
    if (!request || request.status !== "pending_payment" || request.paid_at) {
      res.status(400).json({ error: "This request is not waiting for a card payment." });
      return;
    }
    const amount = Math.round(Number(request.fee) * 100);
    if (!amount || amount < 30) {
      res.status(400).json({ error: "This request has no price set. Please contact us." });
      return;
    }
    const { data: client } = await admin.from("profiles").select("email").eq("id", request.client_id).maybeSingle();

    const requestOrigin = req.headers.origin || "";
    const publicAppUrl = (process.env.APP_PUBLIC_URL || "https://app.diaspora-direct.com").replace(/\/$/, "");
    const origin = /^https:\/\/(app\.)?diaspora-direct\.com$/i.test(requestOrigin) || /^http:\/\/localhost(:\d+)?$/i.test(requestOrigin)
      ? requestOrigin
      : publicAppUrl;
    const returnBase = mobile ? publicAppUrl + "/checkout-redirect.html" : origin + "/";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: client?.email || undefined,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: "Diaspora Direct: " + (request.title || "request"),
              description: "Reference " + (request.payment_ref || ""),
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      client_reference_id: String(request.id),
      metadata: { request_id: String(request.id), payment_ref: request.payment_ref || "" },
      payment_intent_data: { metadata: { request_id: String(request.id), payment_ref: request.payment_ref || "" } },
      success_url:
        returnBase + "?checkout=success&request_id=" + encodeURIComponent(request.id) + "&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: returnBase + "?checkout=cancel&request_id=" + encodeURIComponent(request.id),
    });
    await admin.from("requests").update({ stripe_session_id: session.id }).eq("id", request.id);
    res.status(200).json({ url: session.url });
  } catch (e) {
    console.error("Checkout creation failed", e);
    res.status(500).json({ error: "We couldn't start the card payment. Please try again." });
  }
}
