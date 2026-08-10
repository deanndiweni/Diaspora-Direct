import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const { requestId, title, fee } = req.body || {};
    const amount = Math.round(Number(fee) * 100);
    if (!requestId || !amount || amount < 30) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const requestOrigin = req.headers.origin || "";
    const origin = /^https?:\/\//i.test(requestOrigin)
      ? requestOrigin
      : "https://app.diaspora-direct.com";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: title ? "Diaspora Direct: " + title : "Diaspora Direct request",
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      metadata: { request_id: String(requestId) },
      success_url:
        origin +
        "/?checkout=success&request_id=" +
        encodeURIComponent(requestId) +
        "&session_id={CHECKOUT_SESSION_ID}",
      cancel_url:
        origin + "/?checkout=cancel&request_id=" + encodeURIComponent(requestId),
    });
    res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
