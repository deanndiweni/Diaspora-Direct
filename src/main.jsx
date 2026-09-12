import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AuthScreen from "./AuthScreen.jsx";
import { supabase, supabaseConfigError } from "./supabaseClient";

const FALLBACK_SCREEN_STYLE = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  textAlign: "center",
  fontFamily: "'Work Sans', sans-serif",
  color: "#B33A3A",
  background: "#F6F1E8",
  boxSizing: "border-box",
};

// Catches any render/lifecycle error anywhere in the tree and shows a
// visible message instead of leaving the app on a blank white screen,
// which is what triggered the 9 Sept 2026 App Review rejection
// (Guideline 2.1(a) - Performance - App Completeness).
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] Fatal render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={FALLBACK_SCREEN_STYLE}>
          Something went wrong loading the app.
          <br />
          {String(this.state.error?.message || this.state.error)}
        </div>
      );
    }
    return this.props.children;
  }
}

function Root() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

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
    if (supabaseConfigError) {
      setLoading(false);
      return;
    }
    refreshAuth().then(() => setLoading(false));
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      refreshAuth();
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  if (supabaseConfigError) {
    return (
      <div style={FALLBACK_SCREEN_STYLE}>
        Couldn't connect: {supabaseConfigError}
        <br />
        Please contact support if this keeps happening.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Work Sans', sans-serif", color: "#6B7264" }}>
        Loading...
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthScreen onAuthed={refreshAuth} />;
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
