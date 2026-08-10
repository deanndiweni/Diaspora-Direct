import React, { useState } from "react";
import { supabase } from "./supabaseClient";

const C = {
  teal: "#4E6E49",
  marigold: "#D9B965",
  sand: "#F6F1E8",
  charcoal: "#26301F",
  charcoalSoft: "#6B7264",
  line: "#E3DCC9",
  alert: "#B33A3A",
};

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("client");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const inputStyle = {
    width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid " + C.line,
    fontFamily: "'Work Sans', sans-serif", fontSize: 14, marginBottom: 12, boxSizing: "border-box",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        const user = data.user;
        if (user) {
          const { error: profileError } = await supabase.from("profiles").insert({
            id: user.id, full_name: fullName, email, role,
          });
          if (profileError) throw profileError;
        }
        if (data.session) {
          await onAuthed();
        } else {
          setInfo("Check your email to confirm your account, then log in.");
          setMode("login");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        await onAuthed();
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.sand, display: "flex", justifyContent: "center", alignItems: "center", fontFamily: "'Work Sans', sans-serif", padding: 16 }}>
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 380, padding: 28, background: "#fff", borderRadius: 16, boxShadow: "0 10px 30px rgba(20,20,10,0.12)", boxSizing: "border-box" }}>
        <div style={{ fontFamily: "'Spectral', serif", fontSize: 22, fontWeight: 700, color: C.charcoal, marginBottom: 4 }}>
          Diaspora Direct
        </div>
        <div style={{ fontSize: 13, color: C.charcoalSoft, marginBottom: 20 }}>
          {mode === "login" ? "Log in to your account" : "Create your account"}
        </div>

        {mode === "signup" && (
          <input style={inputStyle} placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        )}
        <input style={inputStyle} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input style={inputStyle} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />

        {mode === "signup" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button type="button" onClick={() => setRole("client")} style={{
              flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid " + (role === "client" ? C.teal : C.line),
              background: role === "client" ? C.teal : "#fff", color: role === "client" ? "#fff" : C.charcoal, fontWeight: 600, cursor: "pointer",
            }}>I need help (Client)</button>
            <button type="button" onClick={() => setRole("agent")} style={{
              flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid " + (role === "agent" ? C.teal : C.line),
              background: role === "agent" ? C.teal : "#fff", color: role === "agent" ? "#fff" : C.charcoal, fontWeight: 600, cursor: "pointer",
            }}>I'm an Agent</button>
          </div>
        )}

        {error && <div style={{ color: C.alert, fontSize: 13, marginBottom: 12 }}>{error}</div>}
        {info && <div style={{ color: C.teal, fontSize: 13, marginBottom: 12 }}>{info}</div>}

        {mode === "signup" && (<div style={{ fontSize: 12, color: C.charcoalSoft, marginBottom: 14, lineHeight: 1.5 }}>By creating an account you agree to our <a href="/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: C.teal, fontWeight: 600 }}>Terms of Service</a> and <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: C.teal, fontWeight: 600 }}>Privacy Policy</a>.</div>)}        <button type="submit" disabled={loading} style={{
          width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: C.marigold,
          color: "#3A2A00", fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 14,
        }}>
          {loading ? "Please wait..." : mode === "login" ? "Log in" : "Sign up"}
        </button>

        <div style={{ textAlign: "center", fontSize: 13, color: C.charcoalSoft }}>
          {mode === "login" ? (
            <span>New here? <span style={{ color: C.teal, fontWeight: 600, cursor: "pointer" }} onClick={() => { setMode("signup"); setError(""); setInfo(""); }}>Create an account</span></span>
          ) : (
            <span>Already have an account? <span style={{ color: C.teal, fontWeight: 600, cursor: "pointer" }} onClick={() => { setMode("login"); setError(""); setInfo(""); }}>Log in</span></span>
          )}
        </div>
      </form>
    </div>
  );
}
