import { Capacitor } from "@capacitor/core";

export async function enterFullscreenStatusBar() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { StatusBar } = await import("@capacitor/status-bar");
    await StatusBar.hide();
  } catch {}
}

export async function exitFullscreenStatusBar() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.show();
    // CRITICAL: re-apply overlay:false after fullscreen exit
    // Android resets this when toggling immersive mode
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: "#0B0F1A" });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {}
}
