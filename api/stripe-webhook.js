import Stripe from "stripe";
import { adminClient, recordPaidInvoice } from "./_subscriptions.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe calls this every month when a package renews, fails or ends.
// Set up once in Stripe: Developers > Webhooks > Add endpoint
//   URL:    https://app.diaspora-direct.com/api/stripe-webhook
//   Events: invoice.paid, invoice.payment_failed, customer.subscription.deleted
// then copy the signing secret into Vercel as STRIPE_WEBHOOK_SECRET.

export const config = { api: { bodyParser: false } };

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(typeof c === "string" ? Buffer.from(c) : c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function subscriptionIdOf(invoice) {
  if (!invoice) return null;
  if (typeof invoice.subscription === "string") return invoice.subscription;
  if (invoice.subscription && invoice.subscription.id) return invoice.subscription.id;
  const details = invoice.parent && invoice.parent.subscription_details;
  if (details) return typeof details.subscription === "string" ? details.subscription : details.subscription && details.subscription.id;
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const admin = adminClient();
  if (!secret || !admin) {
    res.status(503).json({ error: "Webhook not configured" });
    return;
  }

  let event;
  try {
    const buf = await rawBody(req);
    event = stripe.webhooks.constructEvent(buf, req.headers["stripe-signature"], secret);
  } catch (e) {
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  try {
    const obj = event.data.object;
    if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const stripeSubId = subscriptionIdOf(obj);
      if (stripeSubId) {
        let { data: sub } = await admin.from("subscriptions").select("*").eq("stripe_subscription_id", stripeSubId).maybeSingle();
        // First payment arrives before the app has confirmed it (or the client
        // never returned to the app). Link it using the id we put on the
        // Stripe subscription at checkout.
        if (!sub && event.type === "invoice.paid") {
          const meta = (obj.subscription_details && obj.subscription_details.metadata)
            || (obj.parent && obj.parent.subscription_details && obj.parent.subscription_details.metadata)
            || {};
          if (meta.subscription_id) {
            const { data: linked } = await admin.from("subscriptions").update({
              stripe_subscription_id: stripeSubId,
              stripe_customer_id: typeof obj.customer === "string" ? obj.customer : null,
            }).eq("id", meta.subscription_id).eq("status", "pending_payment").select("*").maybeSingle();
            sub = linked;
          }
        }
        if (sub) {
          if (event.type === "invoice.paid") {
            const line = obj.lines && obj.lines.data && obj.lines.data[0];
            const periodEnd = line && line.period && line.period.end;
            await admin.from("subscriptions").update({
              status: sub.status === "cancelling" ? "cancelling" : "active",
              current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : sub.current_period_end,
            }).eq("id", sub.id);
            await recordPaidInvoice(admin, sub, obj.id, obj.amount_paid);
          } else {
            await admin.from("subscriptions").update({ status: "past_due" }).eq("id", sub.id);
          }
        }
      }
    } else if (event.type === "customer.subscription.deleted") {
      await admin.from("subscriptions").update({ status: "cancelled" }).eq("stripe_subscription_id", obj.id);
    }
    res.status(200).json({ received: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
