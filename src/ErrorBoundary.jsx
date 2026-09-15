import React from "react";

// Top-level safety net. Without this, any uncaught error thrown while
// rendering (or during module import, e.g. a missing Supabase config value)
// takes down the whole React tree and leaves the native WebView showing a
// blank white screen with nothing in it, which is exactly what Apple's App
// Review flagged (Guideline 2.1, Sep 9 2026 review on iPad Air): "app
// launched a blank screen". This catches render-time crashes and shows a
// visible, on-brand fallback instead of blank white.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Diaspora Direct crashed:", error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: 24,
            fontFamily: "'Work Sans', sans-serif",
            color: "#4E6E49",
            background: "#F6F1E8",
          }}
        >
          <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 16 }}>
            Something went wrong.
          </p>
          <p style={{ fontSize: 13, color: "#6B7264", maxWidth: 280 }}>
            Please close and reopen the app. If this keeps happening, let us know
            through the support link on the sign-in screen.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
