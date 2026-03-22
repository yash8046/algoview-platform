/**
 * AdMob Rewarded Ad Service
 * 
 * Handles rewarded ad loading/showing with graceful fallback.
 * When ads fail to load (common for new apps with low fill rate),
 * the feature is granted for free with a toast notification.
 * 
 * In web preview: always skips ads gracefully.
 * In Capacitor (Android): uses AdMob plugin.
 */

import { Capacitor } from '@capacitor/core';

// Track ad state
let rewardedAdLoaded = false;
let adLoadAttempts = 0;
let lastAdShownAt = 0;
const AD_COOLDOWN_MS = 30_000; // 30s minimum between ads

// AdMob Rewarded Ad Unit ID — replace with your real ID for production
const REWARDED_AD_UNIT_ID = 'ca-app-pub-3940256099942544/5224354917'; // Test ad unit

interface AdResult {
  granted: boolean;
  adShown: boolean;
  message: string;
}

/**
 * Initialize AdMob (call once at app startup on native)
 */
export async function initAdMob(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Dynamic import for Capacitor AdMob plugin
    const { AdMob } = await import('@capacitor-community/admob');
    await AdMob.initialize({
      initializeForTesting: true, // Set false for production
    });
    console.log('[AdService] AdMob initialized');
    // Pre-load first rewarded ad
    loadRewardedAd();
  } catch (err) {
    console.warn('[AdService] AdMob init failed, ads will be skipped:', err);
  }
}

/**
 * Pre-load a rewarded ad
 */
async function loadRewardedAd(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { AdMob } = await import('@capacitor-community/admob');
    await AdMob.prepareRewardVideoAd({
      adId: REWARDED_AD_UNIT_ID,
    });
    rewardedAdLoaded = true;
    adLoadAttempts = 0;
    console.log('[AdService] Rewarded ad loaded');
  } catch (err) {
    rewardedAdLoaded = false;
    adLoadAttempts++;
    console.warn(`[AdService] Failed to load rewarded ad (attempt ${adLoadAttempts}):`, err);
  }
}

/**
 * Show rewarded ad with graceful fallback.
 * Returns { granted: true } whether ad was shown or skipped.
 * 
 * Flow:
 * 1. If on web → skip, grant access
 * 2. If ad loaded → show it, grant on reward
 * 3. If ad not loaded → skip gracefully, grant access with message
 */
export async function showRewardedAd(featureName: string = 'AI Insight'): Promise<AdResult> {
  // Web: always skip
  if (!Capacitor.isNativePlatform()) {
    return {
      granted: true,
      adShown: false,
      message: '',
    };
  }

  // Cooldown check — don't spam ads
  const now = Date.now();
  if (now - lastAdShownAt < AD_COOLDOWN_MS) {
    return {
      granted: true,
      adShown: false,
      message: 'Access granted (cooldown active)',
    };
  }

  // Try showing the ad
  if (rewardedAdLoaded) {
    try {
      const { AdMob } = await import('@capacitor-community/admob');
      const result = await AdMob.showRewardVideoAd();
      lastAdShownAt = Date.now();
      rewardedAdLoaded = false;

      // Pre-load next ad
      loadRewardedAd();

      return {
        granted: true,
        adShown: true,
        message: `${featureName} unlocked!`,
      };
    } catch (err) {
      console.warn('[AdService] Failed to show ad:', err);
      // Ad show failed — grant access anyway
      loadRewardedAd(); // Try loading next one
      return {
        granted: true,
        adShown: false,
        message: `Ad unavailable — enjoy free ${featureName}!`,
      };
    }
  }

  // Ad not loaded — skip gracefully
  console.log('[AdService] No ad loaded, granting free access');
  loadRewardedAd(); // Try loading for next time

  return {
    granted: true,
    adShown: false,
    message: adLoadAttempts > 2
      ? `Ads loading... Enjoy free ${featureName}!`
      : `Ad unavailable — enjoy free ${featureName}!`,
  };
}

/**
 * Hook-friendly wrapper: returns a function that gates a callback behind an ad.
 * If ad fails, callback runs anyway.
 */
export function createAdGate(featureName: string) {
  return async (callback: () => void): Promise<{ adShown: boolean; message: string }> => {
    const result = await showRewardedAd(featureName);
    if (result.granted) {
      callback();
    }
    return { adShown: result.adShown, message: result.message };
  };
}
