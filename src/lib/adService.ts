/**
 * AdMob Ad Service (FINAL STABLE FIX)
 */

import { Capacitor } from '@capacitor/core';
import { AdMob } from '@capacitor-community/admob';

// ============ State ============
let isInitialized = false;
let rewardedAdLoaded = false;
let interstitialAdLoaded = false;
let lastAdShownAt = { rewarded: 0, interstitial: 0, appOpen: 0 };

// ============ Config ============
const AD_UNITS = {
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
  appOpen: 'ca-app-pub-3940256099942544/9257395921',
};

export interface AdResult {
  granted: boolean;
  adShown: boolean;
  message?: string;
}

// ============ Helpers ============
function isNative() {
  return Capacitor.isNativePlatform();
}

// ============ INIT ============
export async function initAdMob(): Promise<void> {
  if (!isNative() || isInitialized) return;

  try {
    await AdMob.initialize({
      initializeForTesting: true,
    });
    isInitialized = true;
    // preload ads
    loadRewardedAd();
    loadInterstitialAd();
  } catch (err: any) {
    console.warn('AdMob init failed:', err?.message);
  }
}


// ============ INTERSTITIAL ============
async function loadInterstitialAd(): Promise<void> {
  if (!isNative()) return;

  try {
    await AdMob.prepareInterstitial({
      adId: AD_UNITS.interstitial,
      isTesting: true,
    });
    interstitialAdLoaded = true;
  } catch (err: any) {
    interstitialAdLoaded = false;
    console.warn('Interstitial load failed:', err?.message);
  }
}

export async function showInterstitialAd(): Promise<AdResult> {
  if (!isNative()) return { granted: true, adShown: false };

  try {
    if (!interstitialAdLoaded) {
      await loadInterstitialAd();
      return { granted: true, adShown: false };
    }

    await AdMob.showInterstitial();

    interstitialAdLoaded = false;
    lastAdShownAt.interstitial = Date.now();

    loadInterstitialAd();

    return { granted: true, adShown: true };
  } catch (err: any) {
    console.warn('Interstitial show failed:', err?.message);
    loadInterstitialAd();
    return { granted: true, adShown: false };
  }
}

// ============ REWARDED ============
async function loadRewardedAd(): Promise<void> {
  if (!isNative()) return;

  try {
    await AdMob.prepareRewardVideoAd({
      adId: AD_UNITS.rewarded,
      isTesting: true,
    });
    rewardedAdLoaded = true;
  } catch (err: any) {
    rewardedAdLoaded = false;
    console.warn('Rewarded load failed:', err?.message);
  }
}

export async function showRewardedAd(feature = 'Feature'): Promise<AdResult> {
  if (!isNative()) return { granted: true, adShown: false };

  try {
    if (!rewardedAdLoaded) {
      loadRewardedAd();
      return { granted: true, adShown: false };
    }

    await AdMob.showRewardVideoAd();

    rewardedAdLoaded = false;
    lastAdShownAt.rewarded = Date.now();

    loadRewardedAd();

    return { granted: true, adShown: true };
  } catch (err: any) {
    console.warn('Rewarded show failed:', err?.message);
    loadRewardedAd();
    return { granted: true, adShown: false };
  }
}

// ============ APP OPEN ============
export async function showAppOpenAd(): Promise<void> {
  if (!isNative()) return;

  try {
    await AdMob.prepareInterstitial({
      adId: AD_UNITS.appOpen,
      isTesting: true,
    });
    await AdMob.showInterstitial();
  } catch (err: any) {
    console.warn('App open ad unavailable:', err?.message);
  }
}

// ============ STATUS ============
export function isAdReady(): boolean {
  return rewardedAdLoaded;
}

// ============ GATE ============
export function createAdGate(feature: string) {
  return async (cb: () => void) => {
    await showRewardedAd(feature);
    cb(); // NEVER block user
  };
}
