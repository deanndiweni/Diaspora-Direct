import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AuthScreen from "./AuthScreen.jsx";
import GuestHome from "./GuestHome.jsx";
import { supabase } from "./supabaseClient";
import { ErrorBoundary } from "./ErrorBoundary.jsx";

function Root() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  // null = browsing without an account; "login" / "signup" = the account
  // screen, reached only when the user chooses to (features that aren't
  // account-based, like browsing services and pricing, stay open to everyone).
  const [authMode, setAuthMode] = useState(null);

  const loadProfile = async (userId) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setProfile(data || null);
  };

  const refreshAuth = async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (data.session) {
      await loadProfile(data.session.user.id);
    } else {
      setProfile(null);
    }
  };

  useEffect(() => {
    // .catch + .finally so a broken/missing Supabase config or a network
    // failure can't leave the app stuck on "Loading..." forever, it falls
    // through to the sign-in screen instead once loading resolves.
    refreshAuth()
      .catch((err) => {
        console.error("Failed to load auth session:", err);
      })
      .finally(() => setLoading(false));
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      refreshAuth().catch((err) => {
        console.error("Failed to refresh auth session:", err);
      });
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Work Sans', sans-serif", color: "#6B7264" }}>
        Loading...
      </div>
    );
  }

  if (!session || !profile) {
    if (authMode) {
      return (
        <AuthScreen
          initialMode={authMode}
          onAuthed={async () => { await refreshAuth(); setAuthMode(null); }}
          onBack={() => setAuthMode(null)}
        />
      );
    }
    return <GuestHome onRequestAuth={setAuthMode} />;
  }

  return <App profile={profile} onSignOut={handleSignOut} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>
);
