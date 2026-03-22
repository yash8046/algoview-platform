import { useCallback, useRef } from 'react';
import { showRewardedAd, showInterstitialAd } from '@/lib/adService';

/**
 * Hook to gate a feature behind a rewarded ad.
 * If the ad fails, feature is granted anyway.
 */
export function useRewardedAd(featureName: string = 'AI Insight') {
  const pendingRef = useRef(false);

  const gateWithAd = useCallback(async (callback: () => void) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    try {
      const result = await showRewardedAd(featureName);
      if (result.granted) callback();
    } catch {
      callback();
    } finally {
      pendingRef.current = false;
    }
  }, [featureName]);

  return { gateWithAd };
}

/**
 * Hook to show an interstitial ad (no gating, fire-and-forget).
 * Use on page transitions or after completing an action.
 */
export function useInterstitialAd() {
  const pendingRef = useRef(false);

  const showInterstitial = useCallback(async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    try {
      await showInterstitialAd();
    } catch {
      // silently ignore
    } finally {
      pendingRef.current = false;
    }
  }, []);

  return { showInterstitial };
}
