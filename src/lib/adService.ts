/**
 * AdMob Ad Service
 * 
 * Supports: Rewarded, Interstitial, Banner, App Open ads
 * All with graceful fallback — features are NEVER blocked.
 * 
 * Test Ad Unit IDs (Google official):
 * - Banner:       ca-app-pub-3940256099942544/6300978111
 * - Interstitial: ca-app-pub-3940256099942544/1033173712
 * - Rewarded:     ca-app-pub-3940256099942544/5224354917
 * - App Open:     ca-app-pub-3940256099942544/9257395921
 */

import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

// ============ State ============
let isInitialized = false;
let rewardedAdLoaded = false;
let interstitialAdLoaded = false;
let adLoadAttempts = { rewarded: 0, interstitial: 0 };
let lastAdShownAt = { rewarded: 0, interstitial: 0, appOpen: 0 };
let bannerVisible = false;
let lastAdError: {
  rewarded: { code: string; message: string } | null;
  interstitial: { code: string; message: string } | null;
} = {
  rewarded: null,
  interstitial: null,
};

// ============ Config ============
const AD_UNITS = {
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
  appOpen: 'ca-app-pub-3940256099942544/9257395921',
};

const COOLDOWNS = {
  rewarded: 30_000,
  interstitial: 60_000,
  appOpen: 300_000,
};

export interface AdResult {
  granted: boolean;
  adShown: boolean;
  message: string;
}

// ============ Helpers ============
async function getAdMob() {
  const { AdMob } = await import('@capacitor-community/admob');
  return AdMob;
}

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

function canShowAd(type: keyof typeof COOLDOWNS): boolean {
  return Date.now() - lastAdShownAt[type] >= COOLDOWNS[type];
}

function getAdErrorDetails(err: any): { code: string; message: string } {
  return {
    code: err?.code || err?.errorCode || 'UNKNOWN',
    message: err?.message || err?.errorMessage || 'Unknown AdMob error',
  };
}

// ============ Initialize ============
export async function initAdMob(): Promise<void> {
  if (!isNative() || isInitialized) return;

  try {
    const AdMob = await getAdMob();
    await AdMob.initialize({
      initializeForTesting: true,
    });
    isInitialized = true;
    console.log('[AdService] AdMob initialized');
    toast.success('AdMob initialized successfully', { duration: 2000 });

    // Pre-load ads
    loadRewardedAd();
    loadInterstitialAd();
  } catch (err: any) {
    console.warn('[AdService] AdMob init failed:', err);
    toast.error(`AdMob init failed: ${err?.message || err}`, { duration: 4000 });
  }
}

// ============ Banner Ad ============
export async function showBannerAd(position: 'TOP' | 'BOTTOM' = 'BOTTOM'): Promise<void> {
  if (!isNative() || bannerVisible) return;

  try {
    const AdMob = await getAdMob();
    const { BannerAdSize, BannerAdPosition } = await import('@capacitor-community/admob');
    await AdMob.showBanner({
      adId: AD_UNITS.banner,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: position === 'TOP' ? BannerAdPosition.TOP_CENTER : BannerAdPosition.BOTTOM_CENTER,
      isTesting: true,
    });
    bannerVisible = true;
  } catch (err) {
    console.warn('[AdService] Banner failed:', err);
  }
}

export async function hideBannerAd(): Promise<void> {
  if (!isNative() || !bannerVisible) return;
  try {
    const AdMob = await getAdMob();
    await AdMob.hideBanner();
    bannerVisible = false;
  } catch (err) {
    console.warn('[AdService] Hide banner failed:', err);
  }
}

export async function removeBannerAd(): Promise<void> {
  if (!isNative() || !bannerVisible) return;
  try {
    const AdMob = await getAdMob();
    await AdMob.removeBanner();
    bannerVisible = false;
  } catch (err) {
    console.warn('[AdService] Remove banner failed:', err);
  }
}

// ============ Interstitial Ad ============
async function loadInterstitialAd(): Promise<void> {
  if (!isNative()) return;
  try {
    const AdMob = await getAdMob();
    await AdMob.prepareInterstitial({ adId: AD_UNITS.interstitial });
    interstitialAdLoaded = true;
    lastAdError.interstitial = null;
    adLoadAttempts.interstitial = 0;
    console.log('[AdService] Interstitial ad ready');
  } catch (err: any) {
    interstitialAdLoaded = false;
    adLoadAttempts.interstitial++;
    lastAdError.interstitial = getAdErrorDetails(err);
    console.warn(`[AdService] Interstitial load attempt ${adLoadAttempts.interstitial}:`, err);
  }
}

export async function showInterstitialAd(): Promise<AdResult> {
  if (!isNative()) return { granted: true, adShown: false, message: '' };
  if (!canShowAd('interstitial')) return { granted: true, adShown: false, message: '' };

  if (interstitialAdLoaded) {
    try {
      const AdMob = await getAdMob();
      await AdMob.showInterstitial();
      lastAdShownAt.interstitial = Date.now();
      interstitialAdLoaded = false;
      loadInterstitialAd();
      return { granted: true, adShown: true, message: '' };
    } catch (err) {
      console.warn('[AdService] Show interstitial failed:', err);
      loadInterstitialAd();
    }
  } else {
    loadInterstitialAd();
  }
  return { granted: true, adShown: false, message: '' };
}

// ============ Rewarded Ad ============
async function loadRewardedAd(): Promise<void> {
  if (!isNative()) return;
  try {
    const AdMob = await getAdMob();
    await AdMob.prepareRewardVideoAd({ adId: AD_UNITS.rewarded });
    rewardedAdLoaded = true;
    lastAdError.rewarded = null;
    adLoadAttempts.rewarded = 0;
    console.log('[AdService] Rewarded ad ready');
    toast.success('Ad ready — watch to unlock features', { duration: 2000 });
  } catch (err: any) {
    rewardedAdLoaded = false;
    adLoadAttempts.rewarded++;
    const { code: errorCode, message: errMsg } = getAdErrorDetails(err);
    lastAdError.rewarded = { code: errorCode, message: errMsg };
    console.warn(`[AdService] Rewarded load attempt ${adLoadAttempts.rewarded}: [${errorCode}] ${errMsg}`);
    if (adLoadAttempts.rewarded <= 3) {
      toast.error(`Ad load failed [${errorCode}]: ${errMsg}. Features unlocked for free.`, { duration: 4000 });
    }
  }
}

export async function showRewardedAd(featureName: string = 'Feature'): Promise<AdResult> {
  // On web or cooldown: grant silently
  if (!isNative()) return { granted: true, adShown: false, message: '' };
  if (!canShowAd('rewarded')) return { granted: true, adShown: false, message: '' };

  if (rewardedAdLoaded) {
    try {
      const AdMob = await getAdMob();
      await AdMob.showRewardVideoAd();
      lastAdShownAt.rewarded = Date.now();
      rewardedAdLoaded = false;
      toast.success(`${featureName} unlocked! 🎉`, { duration: 2000 });
      loadRewardedAd();
      return { granted: true, adShown: true, message: '' };
    } catch (err: any) {
      console.warn('[AdService] Show rewarded failed:', err);
      const errCode = err?.code || 'UNKNOWN';
      toast.error(`Ad show failed [${errCode}]: ${err?.message || 'Unknown error'}. Access granted for free.`, { duration: 4000 });
      loadRewardedAd();
      return { granted: true, adShown: false, message: '' };
    }
  }

  // Ad not loaded — show detailed status
  const lastErr = adLoadAttempts.rewarded;
  const fallbackCode = lastAdError.rewarded?.code || (lastErr > 0 ? 'LOAD_PENDING' : 'NOT_REQUESTED');
  const fallbackMessage = lastAdError.rewarded?.message || 'The ad is still loading or no inventory is available yet';
  toast.info(`No ad available [${fallbackCode}] after ${lastErr} attempt${lastErr === 1 ? '' : 's'}: ${fallbackMessage}. Feature unlocked for free.`, { duration: 4000 });
  loadRewardedAd();
  return { granted: true, adShown: false, message: `Ad unavailable [${fallbackCode}] after ${lastErr} attempts: ${fallbackMessage}` };
}

// ============ App Open Ad ============
export async function showAppOpenAd(): Promise<AdResult> {
  if (!isNative()) return { granted: true, adShown: false, message: '' };
  if (!canShowAd('appOpen')) return { granted: true, adShown: false, message: '' };

  try {
    const AdMob = await getAdMob();
    await AdMob.prepareInterstitial({ adId: AD_UNITS.appOpen });
    await AdMob.showInterstitial();
    lastAdShownAt.appOpen = Date.now();
    return { granted: true, adShown: true, message: '' };
  } catch (err) {
    console.warn('[AdService] App open ad failed:', err);
    return { granted: true, adShown: false, message: '' };
  }
}

// ============ Status ============
export function isAdReady(): boolean {
  return rewardedAdLoaded;
}

export function createAdGate(featureName: string) {
  return async (callback: () => void): Promise<{ adShown: boolean; message: string }> => {
    const result = await showRewardedAd(featureName);
    if (result.granted) callback();
    return { adShown: result.adShown, message: result.message };
  };
}
