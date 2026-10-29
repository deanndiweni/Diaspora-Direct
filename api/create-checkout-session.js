import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Used only if the service_prices table is missing or has no row for a
// service, so checkout keeps working while the Supabase change is rolled out.
// Keep in step with DEFAULT_SERVICE_FEES in src/pricing.js.
const FALLBACK_FEES = {
  property: 25, family: 25, errand: 12, urgent: 37, documents: 20, funeral: 52,
};

export default async function handler(req, res) {
  // The native (iOS/Android) app calls this from a different origin, so the
  // browser sends a CORS preflight OPTIONS request first. Without these
  // headers that preflight fails with 405 and the real POST is never sent.
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
    // The price is never taken from the app. A modified app could send any
    // number, so we look up the request and charge the official price for
    // its service from Supabase.
    const { requestId, mobile } = req.body || {};
    if (!requestId) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      res.status(503).json({ error: "Card payments are temporarily unavailable. Please contact support." });
      return;
    }
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: request, error: requestError } = await admin
      .from("requests")
      .select("id, category, title, fee, status")
      .eq("id", requestId)
      .single();
    if (requestError || !request) {
      res.status(404).json({ error: "We couldn't find that request." });
      return;
    }
    if (request.status !== "pending_payment") {
      res.status(409).json({ error: "This request isn't waiting for payment." });
      return;
    }
    const { data: priceRow } = await admin
      .from("service_prices")
      .select("amount, active")
      .eq("id", request.category)
      .maybeSingle();
    const fee = priceRow && priceRow.active !== false
      ? Number(priceRow.amount)
      : FALLBACK_FEES[request.category];
    const amount = Math.round(Number(fee) * 100);
    if (!Number.isFinite(amount) || amount < 30) {
      res.status(400).json({ error: "This service can't be paid by card yet. Please contact support." });
      return;
    }
    // Keep the saved request in line with what the client is actually charged.
    if (Number(request.fee) !== Number(fee)) {
      await admin.from("requests").update({ fee }).eq("id", request.id);
    }
    const title = request.title;
    const requestOrigin = req.headers.origin || "";
    const origin = /^https?:\/\//i.test(requestOrigin)
      ? requestOrigin
      : (process.env.APP_PUBLIC_URL || "https://app.diaspora-direct.com");
    const publicAppUrl = (process.env.APP_PUBLIC_URL || "https://app.diaspora-direct.com").replace(/\/$/, "");
    const returnBase = mobile ? publicAppUrl + "/checkout-redirect.html" : origin + "/";
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
        returnBase +
        "?checkout=success&request_id=" +
        encodeURIComponent(requestId) +
        "&session_id={CHECKOUT_SESSION_ID}",
      cancel_url:
        returnBase + "?checkout=cancel&request_id=" + encodeURIComponent(requestId),
    });
    res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
