import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAdMob } from "./lib/adService";

// Initialize AdMob on native platforms
initAdMob();

createRoot(document.getElementById("root")!).render(<App />);
