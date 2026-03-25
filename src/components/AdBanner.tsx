import { useEffect } from 'react';
import { showBannerAd, removeBannerAd } from '@/lib/adService';

/**
 * Component that shows/hides a banner ad on mount/unmount.
 * On web: renders nothing. On native: shows AdMob banner.
 */
export default function AdBanner() {
  useEffect(() => {
    showBannerAd();
    return () => {
      removeBannerAd();
    };
  }, []);

  // Banner is rendered by AdMob natively, not in the DOM
  return null;
}
