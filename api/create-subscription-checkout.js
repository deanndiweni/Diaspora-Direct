import Stripe from "stripe";
import { cors, adminClient, userFromRequest, returnBase } from "./_subscriptions.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Starts a monthly card subscription for a package. Everything that decides
// the price is read from Supabase here, never taken from the app.
export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    const admin = adminClient();
    if (!admin) {
      res.status(503).json({ error: "Monthly packages are temporarily unavailable. Please contact support." });
      return;
    }
    const user = await userFromRequest(admin, req);
    if (!user) {
      res.status(401).json({ error: "Please sign in again." });
      return;
    }

    const body = req.body || {};
    const { data: pkg } = await admin
      .from("packages")
      .select("id, kind, name, monthly_price, active")
      .eq("id", String(body.packageId || ""))
      .maybeSingle();
    const amount = pkg ? Math.round(Number(pkg.monthly_price) * 100) : 0;
    if (!pkg || pkg.active === false || !Number.isFinite(amount) || amount < 30) {
      res.status(400).json({ error: "That package isn't available right now." });
      return;
    }

    const { data: validTasks } = await admin.from("welfare_tasks").select("id").eq("active", true);
    const allowed = new Set((validTasks || []).map((t) => t.id));
    const tasks = pkg.kind === "care_bundle"
      ? (Array.isArray(body.tasks) ? body.tasks : []).map(String).filter((t) => allowed.has(t))
      : [];
    const clean = (v, max = 500) => (v == null ? null : String(v).trim().slice(0, max) || null);

    const city = clean(body.city, 120);
    if (!city) {
      res.status(400).json({ error: "Please tell us which town or city the visits are in." });
      return;
    }

    const { data: sub, error: insertError } = await admin
      .from("subscriptions")
      .insert({
        client_id: user.id,
        package_id: pkg.id,
        package_name: pkg.name,
        monthly_price: Number(pkg.monthly_price),
        tasks,
        other_task: pkg.kind === "care_bundle" ? clean(body.otherTask) : null,
        recipient_name: clean(body.recipientName, 120),
        city,
        address: clean(body.address),
        notes: clean(body.notes, 1000),
        start_month: clean(body.startMonth, 40),
        status: "pending_payment",
      })
      .select("id")
      .single();
    if (insertError || !sub) {
      res.status(500).json({ error: "We couldn't start your package. Please try again." });
      return;
    }

    const base = returnBase(req, !!body.mobile);
    const productName = pkg.kind === "care_bundle"
      ? `Diaspora Direct ${pkg.name} care bundle`
      : `Diaspora Direct ${pkg.name}`;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: user.email || undefined,
      line_items: [{
        price_data: {
          currency: "gbp",
          product_data: { name: productName },
          unit_amount: amount,
          recurring: { interval: "month" },
        },
        quantity: 1,
      }],
      metadata: { subscription_id: sub.id },
      subscription_data: { metadata: { subscription_id: sub.id } },
      success_url: base + "?checkout=subscription_success&subscription_id=" + encodeURIComponent(sub.id) + "&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: base + "?checkout=subscription_cancel&subscription_id=" + encodeURIComponent(sub.id),
    });

    await admin.from("subscriptions").update({ stripe_checkout_session_id: session.id }).eq("id", sub.id);
    res.status(200).json({ url: session.url, subscriptionId: sub.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
