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

// ============ Debug Logger ============
const DEBUG = true;

function adLog(tag: string, ...args: any[]) {
  if (DEBUG) console.log(`[AdService][${tag}]`, ...args);
}

function adWarn(tag: string, ...args: any[]) {
  console.warn(`[AdService][${tag}]`, ...args);
}

function adError(tag: string, ...args: any[]) {
  console.error(`[AdService][${tag}]`, ...args);
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

    // Register event listeners for debugging
    AdMob.addListener('onAdLoaded', (info) => {
      adLog('Event', '✅ Ad Loaded', info);
    });
    AdMob.addListener('onAdFailedToLoad', (error) => {
      adError('Event', '❌ Ad Failed to Load', JSON.stringify(error));
    });
    AdMob.addListener('onAdDismissed', () => {
      adLog('Event', 'Ad Dismissed');
    });
    AdMob.addListener('onAdShowed', () => {
      adLog('Event', 'Ad Showed');
    });
    AdMob.addListener('onRewardedVideoAdReward', (reward) => {
      adLog('Event', '🎁 Reward Granted', reward);
    });

    await AdMob.initialize({
      initializeForTesting: true,
    });
    isInitialized = true;
    adLog('Init', '✅ AdMob initialized successfully');
    adLog('Init', 'Platform:', Capacitor.getPlatform());

    // Pre-load ads
    loadRewardedAd();
    loadInterstitialAd();
  } catch (err) {
    adError('Init', '❌ AdMob init failed:', JSON.stringify(err));
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
    adLog('Banner', '✅ Banner shown');
  } catch (err) {
    adWarn('Banner', 'Failed:', JSON.stringify(err));
  }
}

export async function hideBannerAd(): Promise<void> {
  if (!isNative() || !bannerVisible) return;
  try {
    const AdMob = await getAdMob();
    await AdMob.hideBanner();
    bannerVisible = false;
  } catch (err) {
    adWarn('Banner', 'Hide failed:', JSON.stringify(err));
  }
}

export async function removeBannerAd(): Promise<void> {
  if (!isNative() || !bannerVisible) return;
  try {
    const AdMob = await getAdMob();
    await AdMob.removeBanner();
    bannerVisible = false;
  } catch (err) {
    adWarn('Banner', 'Remove failed:', JSON.stringify(err));
  }
}

// ============ Interstitial Ad ============
async function loadInterstitialAd(): Promise<void> {
  if (!isNative()) return;
  try {
    const AdMob = await getAdMob();
    adLog('Interstitial', 'Loading...');
    await AdMob.prepareInterstitial({ adId: AD_UNITS.interstitial });
    interstitialAdLoaded = true;
    adLoadAttempts.interstitial = 0;
    adLog('Interstitial', '✅ Loaded');
  } catch (err) {
    interstitialAdLoaded = false;
    adLoadAttempts.interstitial++;
    adWarn('Interstitial', `Load attempt ${adLoadAttempts.interstitial} failed:`, JSON.stringify(err));
  }
}

export async function showInterstitialAd(): Promise<AdResult> {
  if (!isNative()) return { granted: true, adShown: false, message: '' };
  if (!canShowAd('interstitial')) {
    adLog('Interstitial', 'Cooldown active, skipping');
    return { granted: true, adShown: false, message: '' };
  }

  if (interstitialAdLoaded) {
    try {
      const AdMob = await getAdMob();
      adLog('Interstitial', 'Showing...');
      await AdMob.showInterstitial();
      lastAdShownAt.interstitial = Date.now();
      interstitialAdLoaded = false;
      loadInterstitialAd();
      adLog('Interstitial', '✅ Shown successfully');
      return { granted: true, adShown: true, message: '' };
    } catch (err) {
      adError('Interstitial', 'Show failed:', JSON.stringify(err));
      loadInterstitialAd();
    }
  } else {
    adLog('Interstitial', 'Not loaded, loading now...');
    loadInterstitialAd();
  }
  return { granted: true, adShown: false, message: '' };
}

// ============ Rewarded Ad ============
async function loadRewardedAd(): Promise<void> {
  if (!isNative()) return;
  try {
    const AdMob = await getAdMob();
    adLog('Rewarded', 'Loading...');
    await AdMob.prepareRewardVideoAd({ adId: AD_UNITS.rewarded });
    rewardedAdLoaded = true;
    adLoadAttempts.rewarded = 0;
    adLog('Rewarded', '✅ Loaded');
  } catch (err) {
    rewardedAdLoaded = false;
    adLoadAttempts.rewarded++;
    adWarn('Rewarded', `Load attempt ${adLoadAttempts.rewarded} failed:`, JSON.stringify(err));
  }
}

export async function showRewardedAd(featureName: string = 'Feature'): Promise<AdResult> {
  if (!isNative()) return { granted: true, adShown: false, message: '' };
  if (!canShowAd('rewarded')) {
    adLog('Rewarded', 'Cooldown active, granting silently');
    return { granted: true, adShown: false, message: '' };
  }

  if (rewardedAdLoaded) {
    try {
      const AdMob = await getAdMob();
      adLog('Rewarded', `Showing for "${featureName}"...`);
      await AdMob.showRewardVideoAd();
      lastAdShownAt.rewarded = Date.now();
      rewardedAdLoaded = false;
      loadRewardedAd();
      adLog('Rewarded', '✅ Shown & rewarded');
      return { granted: true, adShown: true, message: '' };
    } catch (err) {
      adError('Rewarded', 'Show failed:', JSON.stringify(err));
      loadRewardedAd();
      return { granted: true, adShown: false, message: '' };
    }
  }

  adLog('Rewarded', 'Not loaded, granting silently');
  loadRewardedAd();
  return { granted: true, adShown: false, message: '' };
}

// ============ App Open Ad ============
export async function showAppOpenAd(): Promise<AdResult> {
  if (!isNative()) return { granted: true, adShown: false, message: '' };
  if (!canShowAd('appOpen')) return { granted: true, adShown: false, message: '' };

  try {
    const AdMob = await getAdMob();
    adLog('AppOpen', 'Preparing...');
    await AdMob.prepareInterstitial({ adId: AD_UNITS.appOpen });
    await AdMob.showInterstitial();
    lastAdShownAt.appOpen = Date.now();
    adLog('AppOpen', '✅ Shown');
    return { granted: true, adShown: true, message: '' };
  } catch (err) {
    adError('AppOpen', 'Failed:', JSON.stringify(err));
    return { granted: true, adShown: false, message: '' };
  }
}

// ============ Status ============
export function isAdReady(): boolean {
  return rewardedAdLoaded;
}

export function getAdDebugInfo(): { initialized: boolean; rewardedLoaded: boolean; interstitialLoaded: boolean; platform: string } {
  return {
    initialized: isInitialized,
    rewardedLoaded: rewardedAdLoaded,
    interstitialLoaded: interstitialAdLoaded,
    platform: Capacitor.getPlatform(),
  };
}

export function createAdGate(featureName: string) {
  return async (callback: () => void): Promise<{ adShown: boolean; message: string }> => {
    const result = await showRewardedAd(featureName);
    if (result.granted) callback();
    return { adShown: result.adShown, message: result.message };
  };
}
