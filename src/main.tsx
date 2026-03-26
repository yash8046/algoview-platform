import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAdMob, showAppOpenAd } from "./lib/adService";
import { Capacitor } from "@capacitor/core";

// Disable console in production on native platforms
if (import.meta.env.PROD && Capacitor.isNativePlatform()) {
  const noop = () => {};
  console.log = noop;
  console.debug = noop;
  console.info = noop;
}

// Configure native status bar IMMEDIATELY at boot (outside React lifecycle)
// This is critical — must run before any component renders
if (Capacitor.isNativePlatform()) {
  import("@capacitor/status-bar").then(({ StatusBar, Style }) => {
    StatusBar.setOverlaysWebView({ overlay: false });
    StatusBar.setBackgroundColor({ color: "#0B0F1A" });
    StatusBar.setStyle({ style: Style.Dark });
  }).catch(() => {});
}

// Initialize AdMob and show app-open ad on native platforms
initAdMob().then(() => {
  setTimeout(() => showAppOpenAd(), 2000);
});

createRoot(document.getElementById("root")!).render(<App />);
