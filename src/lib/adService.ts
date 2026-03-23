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

// ============ State ============
let isInitialized = false;
let rewardedAdLoaded = false;
let interstitialAdLoaded = false;
let adLoadAttempts = { rewarded: 0, interstitial: 0 };
let lastAdShownAt = { rewarded: 0, interstitial: 0, appOpen: 0 };
let bannerVisible = false;

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

    // Pre-load ads
    loadRewardedAd();
    loadInterstitialAd();
  } catch (err) {
    console.warn('[AdService] AdMob init failed:', err);
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
    adLoadAttempts.interstitial = 0;
  } catch (err) {
    interstitialAdLoaded = false;
    adLoadAttempts.interstitial++;
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
    adLoadAttempts.rewarded = 0;
  } catch (err) {
    rewardedAdLoaded = false;
    adLoadAttempts.rewarded++;
    console.warn(`[AdService] Rewarded load attempt ${adLoadAttempts.rewarded}:`, err);
  }
}

export async function showRewardedAd(featureName: string = 'Feature'): Promise<AdResult> {
  // On web or cooldown: grant silently, no toast
  if (!isNative()) return { granted: true, adShown: false, message: '' };
  if (!canShowAd('rewarded')) return { granted: true, adShown: false, message: '' };

  if (rewardedAdLoaded) {
    try {
      const AdMob = await getAdMob();
      await AdMob.showRewardVideoAd();
      lastAdShownAt.rewarded = Date.now();
      rewardedAdLoaded = false;
      loadRewardedAd();
      return { granted: true, adShown: true, message: '' };
    } catch (err) {
      console.warn('[AdService] Show rewarded failed:', err);
      loadRewardedAd();
      // Grant silently — no message/toast
      return { granted: true, adShown: false, message: '' };
    }
  }

  // Ad not loaded — grant silently
  loadRewardedAd();
  return { granted: true, adShown: false, message: '' };
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
