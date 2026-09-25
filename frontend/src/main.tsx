import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "@/index.css";
import App from "@/App";
import { apply as applyTheme } from "@/lib/theme";
import { initOsNotifications, installGlobalErrorToasts } from "@/lib/notify";
import { installWebviewBridges } from "@/lib/webview";

applyTheme(); // set data-theme + .dark from saved prefs before first paint
installGlobalErrorToasts();
initOsNotifications();
installWebviewBridges(); // clipboard + external links, dead in the webview otherwise

const container = document.getElementById("root");

const root = createRoot(container!);

// HashRouter (not BrowserRouter): routes live in the URL hash (/#/playground),
// which never hits the Wails asset server — so deep links and reloads work in
// the webview.
root.render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
