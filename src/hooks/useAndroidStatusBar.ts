import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";

/**
 * Re-applies the native Android status bar configuration on every route
 * change and whenever the `fullscreen` flag toggles.
 *
 * Why this is needed:
 *  - Android WebView can lose `setOverlaysWebView(false)` after certain
 *    transitions (orientation change, immersive mode toggle, soft-keyboard).
 *  - CSS `env(safe-area-inset-top)` is unreliable in Capacitor WebViews
 *    because the insets depend on the overlay flag set via the native bridge.
 *  - Fullscreen chart mode hides the status bar for an immersive experience;
 *    exiting must fully restore the bar *and* push the WebView below it.
 */
export function useAndroidStatusBar(fullscreen = false) {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    (async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");

        if (fullscreen) {
          // True immersive: hide status bar entirely
          await StatusBar.hide();
        } else {
          // Restore status bar below system UI
          await StatusBar.show();
          await StatusBar.setOverlaysWebView({ overlay: false });
          await StatusBar.setBackgroundColor({ color: "#0B0F1A" });
          await StatusBar.setStyle({ style: Style.Dark });
        }
      } catch {
        // Plugin not available (web) — ignore
      }
    })();
  }, [pathname, fullscreen]);
}
