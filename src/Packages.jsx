import React, { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Circle, ShoppingBasket, HeartHandshake, Home as HomeIcon } from "lucide-react";
import { supabase } from "./supabaseClient";
import { formatMoney } from "./pricing";
import { C, TopBar, Card, Button } from "./App.jsx";

// Monthly packages (care bundles and live-in maid). Everything shown here is
// loaded from the Supabase tables `packages` and `welfare_tasks`, so packages
// can be added, re-priced or hidden from the dashboard with no app update.

const font = { body: "'Work Sans', sans-serif", head: "'Spectral', serif", mono: "'IBM Plex Mono', monospace" };

let cache = { packages: [], tasks: [], loaded: false };
let inflight = null;
const listeners = new Set();

export function refreshPackages() {
  if (inflight) return inflight;
  inflight = Promise.all([
    supabase.from("packages").select("*").eq("active", true).order("sort", { ascending: true }),
    supabase.from("welfare_tasks").select("*").eq("active", true).order("sort", { ascending: true }),
  ])
    .then(([p, t]) => {
      cache = {
        packages: (p.data || []).filter((x) => Number(x.monthly_price) > 0),
        tasks: t.data || [],
        loaded: true,
      };
      listeners.forEach((fn) => fn(cache));
      return cache;
    })
    .catch(() => {
      cache = { ...cache, loaded: true };
      listeners.forEach((fn) => fn(cache));
      return cache;
    })
    .finally(() => { inflight = null; });
  return inflight;
}

export function usePackages() {
  const [state, setState] = useState(cache);
  useEffect(() => {
    listeners.add(setState);
    refreshPackages();
    return () => listeners.delete(setState);
  }, []);
  return state;
}

const perMonth = (n) => `${formatMoney(n)} a month`;

function Row({ label, value }) {
  if (value == null || value === "") return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontFamily: font.body, fontSize: 11.5, color: C.charcoalSoft, marginTop: 3 }}>
      <span>{label}</span>
      <span style={{ color: C.charcoal, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export function PackageCard({ pkg, onSelect, actionLabel = "Choose" }) {
  const isCare = pkg.kind === "care_bundle";
  const includes = Array.isArray(pkg.includes) ? pkg.includes : [];
  return (
    <div style={{ background: C.sandCard, borderRadius: 14, padding: 14, marginBottom: 10, border: `1px solid ${C.line}`, boxSizing: "border-box", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 700, color: C.charcoal }}>{pkg.name}</div>
          {pkg.tagline && <div style={{ fontFamily: font.body, fontSize: 11.5, color: C.charcoalSoft }}>{pkg.tagline}</div>}
        </div>
        <div style={{ fontFamily: font.mono, fontSize: 14, fontWeight: 700, color: C.tealDark, whiteSpace: "nowrap" }}>
          {formatMoney(pkg.monthly_price)}<span style={{ fontSize: 10.5, fontWeight: 500 }}>/mo</span>
        </div>
      </div>

      {isCare && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${C.line}` }}>
          <Row label="Groceries" value={pkg.groceries_amount != null ? formatMoney(pkg.groceries_amount) : null} />
          <Row label="Welfare check" value={pkg.welfare_fee != null ? formatMoney(pkg.welfare_fee) : null} />
          <Row label="Visit time" value={pkg.visit_duration} />
          <Row label="Extra ad hoc visits" value={pkg.adhoc_fee != null ? `${formatMoney(pkg.adhoc_fee)} each` : null} />
        </div>
      )}

      {includes.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {includes.map((line) => (
            <div key={line} style={{ display: "flex", gap: 6, alignItems: "flex-start", fontFamily: font.body, fontSize: 11.5, color: C.charcoal, marginTop: 3 }}>
              <CheckCircle2 size={13} color={C.teal} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>{line}</span>
            </div>
          ))}
        </div>
      )}

      {Number(pkg.annual_saving) > 0 && (
        <div style={{ display: "inline-block", marginTop: 8, background: C.tealLight, color: C.tealDark, fontFamily: font.mono, fontSize: 10.5, padding: "3px 8px", borderRadius: 20 }}>
          Save {formatMoney(pkg.annual_saving)} a year
        </div>
      )}

      {onSelect && (
        <div style={{ marginTop: 10 }}>
          <Button full variant="dark" onClick={() => onSelect(pkg)}>
            {actionLabel} {pkg.name} <ArrowRight size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}

// Read only list for the signed out guest screen.
export function GuestPackages({ onRequestAuth }) {
  const { packages } = usePackages();
  if (packages.length === 0) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, marginBottom: 4, color: C.charcoal }}>Monthly packages</div>
      <div style={{ fontFamily: font.body, fontSize: 11.5, color: C.charcoalSoft, marginBottom: 10 }}>
        A monthly grocery shop and welfare check for your loved one, paid automatically each month. Cancel any time.
      </div>
      {packages.map((p) => (
        <PackageCard key={p.id} pkg={p} onSelect={() => onRequestAuth("signup")} actionLabel="Sign up for" />
      ))}
    </div>
  );
}

const STATUS = {
  pending_payment: { label: "Awaiting payment", fg: "#8A6A21", bg: "#F1E7D1" },
  active: { label: "Active", fg: "#3E7A3A", bg: "#E3EFE0" },
  past_due: { label: "Payment failed", fg: "#B33A3A", bg: "#F3E3E3" },
  cancelling: { label: "Ending", fg: "#B0701A", bg: "#FCEBD5" },
  cancelled: { label: "Cancelled", fg: "#6B7264", bg: "#ECE7DA" },
};

function SubStatus({ sub }) {
  const s = STATUS[sub.status] || STATUS.cancelled;
  return (
    <span style={{ background: s.bg, color: s.fg, fontFamily: font.mono, fontSize: 11, padding: "3px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

const shortDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

function MySubscription({ sub, onCancel }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const canCancel = sub.status === "active" || sub.status === "past_due";
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: font.body, fontWeight: 600, fontSize: 13.5, color: C.charcoal }}>
            {sub.package_name}{sub.package_id === "live_in_maid" ? "" : " care bundle"}
          </div>
          <div style={{ fontFamily: font.body, fontSize: 11.5, color: C.charcoalSoft, marginTop: 2 }}>
            {perMonth(sub.monthly_price)}{sub.recipient_name ? ` · for ${sub.recipient_name}` : ""}{sub.city ? `, ${sub.city}` : ""}
          </div>
          {sub.status === "active" && sub.current_period_end && (
            <div style={{ fontFamily: font.body, fontSize: 11, color: C.charcoalSoft, marginTop: 2 }}>Next payment {shortDate(sub.current_period_end)}</div>
          )}
          {sub.status === "cancelling" && (
            <div style={{ fontFamily: font.body, fontSize: 11, color: C.charcoalSoft, marginTop: 2 }}>
              Cancelled. Runs until {sub.current_period_end ? shortDate(sub.current_period_end) : "the end of this month"}, no further payments.
            </div>
          )}
          {sub.status === "past_due" && (
            <div style={{ fontFamily: font.body, fontSize: 11, color: C.alert, marginTop: 2 }}>
              Your last monthly payment didn't go through. Stripe will try your card again; please check it's up to date.
            </div>
          )}
        </div>
        <SubStatus sub={sub} />
      </div>
      {canCancel && !confirming && (
        <div style={{ marginTop: 10 }}>
          <Button variant="ghost" full onClick={() => setConfirming(true)}>Cancel package</Button>
        </div>
      )}
      {canCancel && confirming && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontFamily: font.body, fontSize: 12, color: C.charcoal, marginBottom: 8 }}>
            Cancel this package? It will run until the end of the month you've paid for, then stop.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><Button variant="secondary" full onClick={() => setConfirming(false)}>Keep it</Button></div>
            <div style={{ flex: 1 }}>
              <Button variant="danger" full disabled={busy} onClick={async () => { setBusy(true); await onCancel(sub.id); setBusy(false); setConfirming(false); }}>
                {busy ? "Cancelling…" : "Yes, cancel"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export function PackagesScreen({ goto, subs, onCancel, onSelect }) {
  const { packages, loaded } = usePackages();
  const current = (subs || []).filter((s) => s.status !== "cancelled" && s.status !== "pending_payment");
  const care = packages.filter((p) => p.kind === "care_bundle");
  const other = packages.filter((p) => p.kind !== "care_bundle");
  return (
    <div>
      <TopBar title="Monthly packages" onBack={() => goto("home")} />
      <div style={{ padding: 16 }}>
        {current.length > 0 && (
          <>
            <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, marginBottom: 8, color: C.charcoal }}>Your packages</div>
            {current.map((s) => <MySubscription key={s.id} sub={s} onCancel={onCancel} />)}
          </>
        )}

        {care.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: font.head, fontSize: 15, fontWeight: 600, margin: "6px 0 4px", color: C.charcoal }}>
              <ShoppingBasket size={16} color={C.teal} /> Monthly care bundles
            </div>
            <div style={{ fontFamily: font.body, fontSize: 11.5, color: C.charcoalSoft, marginBottom: 10, lineHeight: 1.4 }}>
              A monthly grocery shop delivered to your loved one's home, with a welfare check during the same visit and a written update with photos afterwards. Each step up lowers the welfare check fee. Paid automatically by card each month; cancel any time.
            </div>
            {care.map((p) => <PackageCard key={p.id} pkg={p} onSelect={onSelect} />)}
          </>
        )}

        {other.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: font.head, fontSize: 15, fontWeight: 600, margin: "10px 0 8px", color: C.charcoal }}>
              <HomeIcon size={16} color={C.teal} /> Household help
            </div>
            {other.map((p) => <PackageCard key={p.id} pkg={p} onSelect={onSelect} />)}
          </>
        )}

        {loaded && packages.length === 0 && (
          <div style={{ fontFamily: font.body, fontSize: 13, color: C.charcoalSoft }}>No monthly packages are available right now. Please check back soon.</div>
        )}
        <div style={{ fontFamily: font.body, fontSize: 10.5, color: C.charcoalSoft, marginTop: 6, lineHeight: 1.4 }}>
          Errands outside the home are charged separately. Changes, skipped months or a different bundle need at least 3 days' notice before the monthly shop. All bookings and updates go through Diaspora Direct; agents are not contacted directly.
        </div>
      </div>
    </div>
  );
}

function monthOptions() {
  const out = ["As soon as possible"];
  const d = new Date();
  for (let i = 1; i <= 3; i += 1) {
    const m = new Date(d.getFullYear(), d.getMonth() + i, 1);
    out.push(m.toLocaleDateString("en-GB", { month: "long", year: "numeric" }));
  }
  return out;
}

const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 10, border: `1px solid ${C.line}`,
  fontFamily: font.body, fontSize: 14, background: "#fff", color: C.charcoal, marginBottom: 12,
};
const labelStyle = { fontFamily: font.body, fontSize: 12, fontWeight: 600, color: C.charcoal, marginBottom: 5, display: "block" };

export function SubscribeScreen({ pkgId, goto, onSubscribe }) {
  const { packages, tasks } = usePackages();
  const pkg = packages.find((p) => p.id === pkgId);
  const [picked, setPicked] = useState(() => new Set());
  const [otherTask, setOtherTask] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [startMonth, setStartMonth] = useState(monthOptions()[0]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Tick every task by default; clients untick what they don't need.
    if (tasks.length && picked.size === 0) setPicked(new Set(tasks.map((t) => t.id)));
  }, [tasks.length]);

  if (!pkg) {
    return (
      <div>
        <TopBar title="Monthly packages" onBack={() => goto("packages")} />
        <div style={{ padding: 16, fontFamily: font.body, fontSize: 13, color: C.charcoalSoft }}>Loading…</div>
      </div>
    );
  }
  const isCare = pkg.kind === "care_bundle";
  const toggle = (id) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const canSubmit = city.trim() && recipientName.trim() && !busy;

  return (
    <div>
      <TopBar title={isCare ? `${pkg.name} bundle` : pkg.name} onBack={() => goto("packages")} />
      <div style={{ padding: 16 }}>
        <PackageCard pkg={pkg} />

        <label style={labelStyle}>{isCare ? "Who are the visits for?" : "Whose home is the maid for?"}</label>
        <input style={inputStyle} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="e.g. Mrs Nehwati (my mum)" />

        <label style={labelStyle}>Town or city</label>
        <input style={inputStyle} value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Harare" />

        <label style={labelStyle}>Address or directions (optional)</label>
        <input style={inputStyle} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, suburb, landmarks" />

        {isCare && tasks.length > 0 && (
          <>
            <div style={{ ...labelStyle, marginTop: 4 }}>Welfare check tasks</div>
            <div style={{ fontFamily: font.body, fontSize: 11, color: C.charcoalSoft, marginBottom: 8 }}>
              Untick anything you don't need. Tasks that need the agent to leave the home are charged as errands.
            </div>
            {tasks.map((t) => {
              const on = picked.has(t.id);
              return (
                <div key={t.id} onClick={() => toggle(t.id)} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 10px", marginBottom: 6, borderRadius: 10, border: `1px solid ${on ? C.teal : C.line}`, background: on ? C.tealLight : "#fff", cursor: "pointer" }}>
                  {on ? <CheckCircle2 size={16} color={C.teal} style={{ flexShrink: 0, marginTop: 1 }} /> : <Circle size={16} color={C.charcoalSoft} style={{ flexShrink: 0, marginTop: 1 }} />}
                  <span style={{ fontFamily: font.body, fontSize: 12.5, color: C.charcoal }}>{t.label}</span>
                </div>
              );
            })}
            <label style={{ ...labelStyle, marginTop: 8 }}>Anything else? (optional)</label>
            <input style={inputStyle} value={otherTask} onChange={(e) => setOtherTask(e.target.value)} placeholder="e.g. check her mobile phone data" />
          </>
        )}

        {!isCare && (
          <>
            <label style={labelStyle}>About the household (optional)</label>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Who lives there, duties, languages, anything we should know" />
          </>
        )}

        <label style={labelStyle}>Preferred start</label>
        <select style={inputStyle} value={startMonth} onChange={(e) => setStartMonth(e.target.value)}>
          {monthOptions().map((m) => <option key={m} value={m}>{m}</option>)}
        </select>

        <div style={{ fontFamily: font.body, fontSize: 11, color: C.charcoalSoft, margin: "4px 0 12px", lineHeight: 1.4 }}>
          You'll be charged {perMonth(pkg.monthly_price)} by card today and then monthly on the same date, so our agent can buy everything locally in advance. Cancel any time from this screen; it stops at the end of the month you've paid for.
        </div>

        <Button full disabled={!canSubmit} onClick={async () => {
          setBusy(true);
          await onSubscribe({
            packageId: pkg.id,
            tasks: isCare ? [...picked] : [],
            otherTask, recipientName, city, address, notes, startMonth,
          });
          setBusy(false);
        }}>
          {busy ? "Opening secure checkout…" : `Pay ${formatMoney(pkg.monthly_price)} & start monthly`} <ArrowRight size={15} />
        </Button>
      </div>
    </div>
  );
}

// Admin overview of every monthly package and its status.
export function AdminSubscriptions() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    supabase.from("subscriptions").select("*").order("created_at", { ascending: false }).then(async ({ data }) => {
      const list = (data || []).filter((s) => s.status !== "pending_payment");
      const ids = [...new Set(list.map((s) => s.client_id))];
      const names = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        (profs || []).forEach((p) => { names[p.id] = p.full_name; });
      }
      setRows(list.map((s) => ({ ...s, clientName: names[s.client_id] || "Client" })));
    });
  }, []);
  if (!rows || rows.length === 0) return null;
  const monthly = rows.filter((s) => s.status === "active" || s.status === "cancelling").reduce((t, s) => t + Number(s.monthly_price || 0), 0);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: font.head, fontSize: 15, fontWeight: 600, marginBottom: 4, color: C.charcoal }}>
        <HeartHandshake size={16} color={C.teal} /> Monthly packages
      </div>
      <div style={{ fontFamily: font.body, fontSize: 11.5, color: C.charcoalSoft, marginBottom: 8 }}>
        {formatMoney(monthly)} a month in active packages. Each paid month appears in the request list automatically for an agent to pick up.
      </div>
      {rows.map((s) => (
        <Card key={s.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: font.body, fontWeight: 600, fontSize: 13, color: C.charcoal }}>{s.clientName}: {s.package_name}</div>
              <div style={{ fontFamily: font.body, fontSize: 11, color: C.charcoalSoft, marginTop: 2 }}>
                {perMonth(s.monthly_price)}{s.recipient_name ? ` · ${s.recipient_name}` : ""}{s.city ? `, ${s.city}` : ""}
              </div>
            </div>
            <SubStatus sub={s} />
          </div>
        </Card>
      ))}
    </div>
  );
}
