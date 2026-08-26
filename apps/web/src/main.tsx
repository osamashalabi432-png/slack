import * as Sentry from "@sentry/react";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";
import { redirectToSecureOrigin } from "./lib/secure-origin";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  sendDefaultPii: true,
  tracesSampleRate: 0,
});

// Nothing works over plain HTTP from another machine, so leave rather than
// render an app that cannot sign anyone in.
if (!redirectToSecureOrigin()) {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
