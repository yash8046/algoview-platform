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

// Configure native status bar on Android/iOS
async function configureStatusBar() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    // Push WebView below the system status bar — no overlap
    await StatusBar.setOverlaysWebView({ overlay: false });
    // Dark background to match app theme
    await StatusBar.setBackgroundColor({ color: "#0B0F1A" });
    // Light icons on dark background
    await StatusBar.setStyle({ style: Style.Dark });
  } catch (e) {
    // Plugin not available on web — ignore
  }
}

configureStatusBar();

// Initialize AdMob and show app-open ad on native platforms
initAdMob().then(() => {
  setTimeout(() => showAppOpenAd(), 2000);
});

createRoot(document.getElementById("root")!).render(<App />);
