import { useCallback, useRef } from 'react';
import { showRewardedAd } from '@/lib/adService';
import { toast } from 'sonner';

/**
 * Hook to gate a feature behind a rewarded ad.
 * If the ad fails to load/show, the feature is granted anyway
 * with a friendly toast message.
 */
export function useRewardedAd(featureName: string = 'AI Insight') {
  const pendingRef = useRef(false);

  const gateWithAd = useCallback(async (callback: () => void) => {
    if (pendingRef.current) return;
    pendingRef.current = true;

    try {
      const result = await showRewardedAd(featureName);
      if (result.granted) {
        callback();
      }
      if (result.message && !result.adShown) {
        // Only toast when ad was skipped (so user knows they got it free)
        toast.info(result.message, { duration: 2500 });
      }
    } catch {
      // Failsafe: always grant access
      callback();
    } finally {
      pendingRef.current = false;
    }
  }, [featureName]);

  return { gateWithAd };
}
