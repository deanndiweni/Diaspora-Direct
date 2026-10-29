import Stripe from "stripe";
import { cors, adminClient, recordPaidInvoice } from "./_subscriptions.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Called when the client comes back from Stripe. Confirms the first payment,
// switches the package on, and creates the first month's job for the agents.
// A cancelled checkout just removes the unpaid sign up.
export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    const admin = adminClient();
    if (!admin) {
      res.status(503).json({ error: "Temporarily unavailable." });
      return;
    }
    const { sessionId, subscriptionId, cancelled } = req.body || {};

    if (cancelled && subscriptionId) {
      await admin.from("subscriptions").delete().eq("id", subscriptionId).eq("status", "pending_payment");
      res.status(200).json({ active: false, cancelled: true });
      return;
    }
    if (!sessionId) {
      res.status(400).json({ error: "Missing sessionId" });
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription", "invoice"] });
    const subId = session.metadata && session.metadata.subscription_id;
    if (!subId || session.mode !== "subscription") {
      res.status(400).json({ error: "Not a package checkout" });
      return;
    }
    const paid = session.status === "complete" && session.payment_status === "paid";
    if (!paid) {
      res.status(200).json({ active: false });
      return;
    }

    const stripeSub = session.subscription && typeof session.subscription === "object" ? session.subscription : null;
    const periodEnd = stripeSub && (stripeSub.current_period_end || (stripeSub.items && stripeSub.items.data && stripeSub.items.data[0] && stripeSub.items.data[0].current_period_end));
    const { data: sub } = await admin
      .from("subscriptions")
      .update({
        status: "active",
        stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer && session.customer.id,
        stripe_subscription_id: stripeSub ? stripeSub.id : session.subscription,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      })
      .eq("id", subId)
      .in("status", ["pending_payment", "active"])
      .select("*")
      .single();

    if (sub) {
      const invoice = session.invoice && typeof session.invoice === "object" ? session.invoice : null;
      const invoiceId = invoice ? invoice.id : session.invoice;
      await recordPaidInvoice(admin, sub, invoiceId, invoice ? invoice.amount_paid : session.amount_total);
    }
    res.status(200).json({ active: true, subscriptionId: subId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
