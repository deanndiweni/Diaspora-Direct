import React from "react";
import { ArrowRight, Wallet } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import {
  C, FONTS, LOGO_B64, SERVICES, SPECIALISTS, SERVICE_FEES, SERVICE_FEE_NOTES, apiUrl,
} from "./App.jsx";

// Public, no-account-needed landing screen. Anyone can browse the services,
// pricing, and specialists here without signing up; only starting an actual
// booking (which is inherently tied to a client's account for tracking,
// messaging and payment) asks them to log in or create an account.

const STEPS = [
  { n: "1", label: "Browse", blurb: "Look through the services and pricing below, no account needed." },
  { n: "2", label: "Create an account", blurb: "Only needed when you're ready to book, so we can track your request and keep you updated." },
  { n: "3", label: "We match an agent", blurb: "A vetted local agent in Zimbabwe usually confirms within about 2 hours." },
  { n: "4", label: "Get updates", blurb: "Track progress in the app and message your agent directly." },
];

function ExternalLink({ href, children, style }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        if (Capacitor.isNativePlatform()) {
          e.preventDefault();
          Browser.open({ url: apiUrl(href) });
        }
      }}
      style={style}
    >
      {children}
    </a>
  );
}

export default function GuestHome({ onRequestAuth }) {
  return (
    <div style={{ height: "100vh", overflow: "hidden", background: "#EAE3D2", fontFamily: "'Work Sans', sans-serif", display: "flex", justifyContent: "center" }}>
      <style>{FONTS}</style>
      <div style={{ width: "100%", maxWidth: 480, height: "100vh", overflowY: "auto", overscrollBehavior: "none", background: C.sand, boxShadow: "0 0 40px rgba(20,20,10,0.12)", boxSizing: "border-box" }}>

        {/* header */}
        <div style={{ background: C.teal, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              <img src={LOGO_B64} alt="" style={{ width: "150%", height: "150%", objectFit: "cover" }} />
            </div>
            <span style={{ color: "#fff", fontFamily: "'Spectral', serif", fontSize: 15, fontWeight: 700 }}>Diaspora Direct</span>
          </div>
          <button
            onClick={() => onRequestAuth("login")}
            style={{ background: "rgba(255,255,255,0.16)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 12px", fontFamily: "'Work Sans', sans-serif", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
          >
            Log in
          </button>
        </div>

        <div style={{ padding: 16 }}>
          {/* hero */}
          <div style={{
            background: `linear-gradient(135deg, ${C.tealDark}, ${C.teal})`, borderRadius: 16,
            padding: "20px 18px", marginBottom: 20, position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: -20, right: -20, width: 90, height: 90, borderRadius: "50%", background: "rgba(217,185,101,0.18)" }} />
            <div style={{ fontFamily: "'Spectral', serif", fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 6, maxWidth: 260 }}>
              On-the-ground help for family back home, you can trust.
            </div>
            <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.85)", marginBottom: 16, maxWidth: 260 }}>
              Vetted local agents in Zimbabwe for property checks, welfare visits, errands and more. Browse below, no account needed until you're ready to book.
            </div>
            <button
              onClick={() => onRequestAuth("signup")}
              style={{
                background: C.marigold, color: "#2C2200", border: "none", borderRadius: 10,
                padding: "11px 18px", fontFamily: "'Work Sans', sans-serif", fontWeight: 700, fontSize: 13.5,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              }}
            >
              Create an account <ArrowRight size={15} />
            </button>
          </div>

          {/* services + pricing, browsable without an account */}
          <div style={{ fontFamily: "'Spectral', serif", fontSize: 15, fontWeight: 600, marginBottom: 10, color: C.charcoal }}>
            Services & pricing
          </div>
          <div style={{ marginBottom: 20 }}>
            {SERVICES.map((s) => (
              <div key={s.id} style={{ background: C.sandCard, borderRadius: 14, padding: 14, marginBottom: 10, border: `1px solid ${C.line}`, display: "flex", gap: 12, alignItems: "flex-start" }}>
                <s.icon size={20} color={C.teal} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <div style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 600, fontSize: 13.5, color: C.charcoal }}>{s.label}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.tealDark, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {"£"}{SERVICE_FEES[s.id]}
                    </div>
                  </div>
                  <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 11.5, color: C.charcoalSoft, marginTop: 2, lineHeight: 1.4 }}>{s.blurb}</div>
                  {SERVICE_FEE_NOTES[s.id] && (
                    <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 10.5, color: C.charcoalSoft, marginTop: 3 }}>{SERVICE_FEE_NOTES[s.id]}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontFamily: "'Spectral', serif", fontSize: 14, fontWeight: 600, marginBottom: 8, color: C.charcoal }}>
            In-house specialists
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {SPECIALISTS.map((s) => (
              <div key={s.id} style={{ background: C.sandCard, borderRadius: 14, padding: 14, border: `1px solid ${C.line}` }}>
                <s.icon size={18} color={C.tealDark} style={{ marginBottom: 6 }} />
                <div style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 600, fontSize: 12, color: C.charcoal, marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 10.5, color: C.charcoalSoft, lineHeight: 1.35 }}>{s.blurb}</div>
              </div>
            ))}
          </div>

          {/* how it works */}
          <div style={{ fontFamily: "'Spectral', serif", fontSize: 15, fontWeight: 600, marginBottom: 10, color: C.charcoal }}>
            How it works
          </div>
          <div style={{ marginBottom: 22 }}>
            {STEPS.map((s) => (
              <div key={s.n} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", background: C.tealLight, color: C.tealDark,
                  display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>{s.n}</div>
                <div>
                  <div style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 600, fontSize: 12.5, color: C.charcoal }}>{s.label}</div>
                  <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 11.5, color: C.charcoalSoft, lineHeight: 1.4 }}>{s.blurb}</div>
                </div>
              </div>
            ))}
          </div>

          {/* account CTA */}
          <div style={{ background: C.sandCard, borderRadius: 14, padding: 16, border: `1px solid ${C.line}`, marginBottom: 20, textAlign: "center" }}>
            <div style={{ fontFamily: "'Spectral', serif", fontSize: 15, fontWeight: 700, color: C.charcoal, marginBottom: 4 }}>Ready to book?</div>
            <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 12, color: C.charcoalSoft, marginBottom: 14 }}>
              Create a free account to request a service, track progress and pay securely in the app.
            </div>
            <button
              onClick={() => onRequestAuth("signup")}
              style={{ width: "100%", background: C.marigold, color: "#2C2200", border: "none", borderRadius: 10, padding: "12px 0", fontFamily: "'Work Sans', sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <Wallet size={15} /> Create an account
            </button>
            <button
              onClick={() => onRequestAuth("login")}
              style={{ width: "100%", background: "transparent", color: C.teal, border: `1px solid ${C.teal}`, borderRadius: 10, padding: "11px 0", fontFamily: "'Work Sans', sans-serif", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}
            >
              Already have an account? Log in
            </button>
          </div>

          {/* legal, visible without an account too */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", marginBottom: 24 }}>
            <ExternalLink href="/terms.html" style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 12, color: C.teal, fontWeight: 600 }}>Terms of Service</ExternalLink>
            <ExternalLink href="/privacy.html" style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 12, color: C.teal, fontWeight: 600 }}>Privacy Policy</ExternalLink>
            <a href="https://wa.me/447778392915" target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 12, color: C.teal, fontWeight: 600 }}>WhatsApp us</a>
          </div>
        </div>
      </div>
    </div>
  );
}
