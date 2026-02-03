import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

import { registerSW } from "virtual:pwa-register";
import { initGA, analytics } from "./lib/analytics.js";

// Initialize Google Analytics
initGA();

// Track app start
analytics.appStart();

// Register service worker
registerSW({ 
  immediate: true,
  onRegistered(r) {
    console.log('SW Registered: ' + r);
  },
  onRegisterError(error) {
    console.log('SW registration error', error);
    analytics.error('sw_registration', error.message);
  }
});

// Track PWA installation
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('PWA install prompt available');
});

window.addEventListener('appinstalled', (e) => {
  console.log('PWA was installed');
  analytics.pwaInstalled();
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
