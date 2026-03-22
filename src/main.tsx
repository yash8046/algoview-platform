import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAdMob, showAppOpenAd } from "./lib/adService";

// Initialize AdMob and show app-open ad on native platforms
initAdMob().then(() => {
  // Show app-open ad after a brief delay (let the app render first)
  setTimeout(() => showAppOpenAd(), 2000);
});

createRoot(document.getElementById("root")!).render(<App />);
