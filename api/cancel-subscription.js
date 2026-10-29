import Stripe from "stripe";
import { cors, adminClient, userFromRequest } from "./_subscriptions.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Client cancels a monthly package. It stays active until the end of the
// month they've already paid for, then stops; no further payments are taken.
export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    const admin = adminClient();
    if (!admin) {
      res.status(503).json({ error: "Temporarily unavailable. Please contact support." });
      return;
    }
    const user = await userFromRequest(admin, req);
    if (!user) {
      res.status(401).json({ error: "Please sign in again." });
      return;
    }
    const { subscriptionId } = req.body || {};
    const { data: sub } = await admin
      .from("subscriptions")
      .select("id, client_id, status, stripe_subscription_id")
      .eq("id", String(subscriptionId || ""))
      .maybeSingle();

    const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const isAdmin = me && me.role === "admin";
    if (!sub || (sub.client_id !== user.id && !isAdmin)) {
      res.status(404).json({ error: "We couldn't find that package." });
      return;
    }
    if (!["active", "past_due"].includes(sub.status) || !sub.stripe_subscription_id) {
      res.status(409).json({ error: "This package isn't active." });
      return;
    }

    await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
    await admin.from("subscriptions").update({ status: "cancelling" }).eq("id", sub.id);
    res.status(200).json({ status: "cancelling" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
