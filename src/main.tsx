import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

class RootErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("App render failed", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            margin: 0,
            display: "grid",
            placeItems: "center",
            background: "#0f1117",
            color: "#f3f4f6",
            padding: "24px",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ maxWidth: "680px", width: "100%" }}>
            <h1 style={{ margin: "0 0 12px", fontSize: "28px" }}>App render failed</h1>
            <p style={{ margin: "0 0 16px", color: "#cbd5e1", lineHeight: 1.6 }}>
              The app could not render. Check the browser console for the detailed
              error message.
            </p>
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                background: "#171b23",
                border: "1px solid #30384a",
                borderRadius: "12px",
                padding: "16px",
              }}
            >
              {this.state.error.message}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
