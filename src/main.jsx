import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AuthScreen from "./AuthScreen.jsx";
import { supabase } from "./supabaseClient";

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
    <Root />
  </React.StrictMode>
);
