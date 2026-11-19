import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "./store";
import App from "./App";
import "./styles.css";
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? (
      <div className="boot">
        <h1>Unable to display this page</h1>
        <p>{this.state.error}</p>
        <p>Your saved data has not been cleared.</p>
        <button onClick={() => location.reload()}>Reload</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <Provider>
      <App />
    </Provider>
  </ErrorBoundary>,
);
