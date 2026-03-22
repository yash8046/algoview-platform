import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAdMob } from "./lib/adService";
import { Capacitor } from "@capacitor/core";

// Hide splash screen once app is ready
async function hideSplash() {
  if (Capacitor.isNativePlatform()) {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  }
}

// Initialize AdMob after the app bootstraps on native platforms
setTimeout(() => {
  void initAdMob();
}, 800);

createRoot(document.getElementById("root")!).render(<App />);

// Hide splash after a short delay to let first paint finish
setTimeout(() => hideSplash(), 1500);
