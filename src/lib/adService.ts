/**
 * AdMob Full Ad Service
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

// ============ Debug Log (visible in-app) ============
type AdLogEntry = { time: string; msg: string; level: 'info' | 'warn' | 'error' };
const adLogs: AdLogEntry[] = [];
const adLogListeners: Array<(logs: AdLogEntry[]) => void> = [];

function adLog(msg: string, level: 'info' | 'warn' | 'error' = 'info') {
  const entry: AdLogEntry = { time: new Date().toLocaleTimeString(), msg, level };
  adLogs.push(entry);
  if (adLogs.length > 50) adLogs.shift();
  adLogListeners.forEach(fn => fn([...adLogs]));
  if (level === 'error') console.error('[AdService]', msg);
  else if (level === 'warn') console.warn('[AdService]', msg);
  else console.log('[AdService]', msg);
}

export function subscribeAdLogs(fn: (logs: AdLogEntry[]) => void) {
  adLogListeners.push(fn);
  fn([...adLogs]);
  return () => {
    const idx = adLogListeners.indexOf(fn);
    if (idx >= 0) adLogListeners.splice(idx, 1);
  };
}

export function getAdLogs() { return [...adLogs]; }
export type { AdLogEntry };

// ============ State ============
let isInitialized = false;
let rewardedAdLoaded = false;
let interstitialAdLoaded = false;
let adLoadAttempts = { rewarded: 0, interstitial: 0 };
let lastAdShownAt = { rewarded: 0, interstitial: 0, appOpen: 0 };
let bannerVisible = false;

// ============ Config ============
const AD_UNITS = {
  banner: 'ca-app-pub-3940256099942544/9214589741',       // Adaptive Banner test
  interstitial: 'ca-app-pub-3940256099942544/1033173712',  // Interstitial test
  rewarded: 'ca-app-pub-3940256099942544/5224354917',      // Rewarded test
  appOpen: 'ca-app-pub-3940256099942544/9257395921',       // App Open test
};

const COOLDOWNS = {
  rewarded: 30_000,      // 30s between rewarded ads
  interstitial: 60_000,  // 60s between interstitial ads
  appOpen: 300_000,      // 5min between app open ads
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
  adLog(`initAdMob called. isNative=${isNative()}, isInitialized=${isInitialized}`);
  if (!isNative() || isInitialized) return;

  try {
    const AdMob = await getAdMob();
    await AdMob.initialize({
      initializeForTesting: true,
    });
    isInitialized = true;
    adLog('AdMob initialized successfully');

    // Pre-load ads
    loadRewardedAd();
    loadInterstitialAd();
  } catch (err: any) {
    adLog(`AdMob init FAILED: ${err?.message || err}`, 'error');
  }
}

// ============ Banner Ad ============
export async function showBannerAd(position: 'TOP' | 'BOTTOM' = 'BOTTOM'): Promise<void> {
  if (!isNative() || bannerVisible) return;

  try {
    const AdMob = await getAdMob();
    const { BannerAdSize, BannerAdPosition } = await import('@capacitor-community/admob');
    adLog(`Showing banner: ${AD_UNITS.banner}, position=${position}`);
    await AdMob.showBanner({
      adId: AD_UNITS.banner,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: position === 'TOP' ? BannerAdPosition.TOP_CENTER : BannerAdPosition.BOTTOM_CENTER,
      isTesting: true,
    });
    bannerVisible = true;
    adLog('Banner shown successfully');
  } catch (err: any) {
    adLog(`Banner FAILED: ${err?.message || err}`, 'error');
  }
}

export async function hideBannerAd(): Promise<void> {
  if (!isNative() || !bannerVisible) return;
  try {
    const AdMob = await getAdMob();
    await AdMob.hideBanner();
    bannerVisible = false;
  } catch (err: any) {
    adLog(`Hide banner failed: ${err?.message || err}`, 'warn');
  }
}

export async function removeBannerAd(): Promise<void> {
  if (!isNative() || !bannerVisible) return;
  try {
    const AdMob = await getAdMob();
    await AdMob.removeBanner();
    bannerVisible = false;
  } catch (err: any) {
    adLog(`Remove banner failed: ${err?.message || err}`, 'warn');
  }
}

// ============ Interstitial Ad ============
async function loadInterstitialAd(): Promise<void> {
  if (!isNative()) return;
  try {
    const AdMob = await getAdMob();
    adLog(`Loading interstitial: ${AD_UNITS.interstitial}`);
    await AdMob.prepareInterstitial({ adId: AD_UNITS.interstitial });
    interstitialAdLoaded = true;
    adLoadAttempts.interstitial = 0;
    adLog('Interstitial loaded');
  } catch (err: any) {
    interstitialAdLoaded = false;
    adLoadAttempts.interstitial++;
    adLog(`Interstitial load FAILED (attempt ${adLoadAttempts.interstitial}): ${err?.message || err}`, 'error');
  }
}

export async function showInterstitialAd(): Promise<AdResult> {
  if (!isNative()) return { granted: true, adShown: false, message: '' };
  if (!canShowAd('interstitial')) {
    adLog('Interstitial on cooldown, skipping');
    return { granted: true, adShown: false, message: '' };
  }

  if (interstitialAdLoaded) {
    try {
      const AdMob = await getAdMob();
      await AdMob.showInterstitial();
      lastAdShownAt.interstitial = Date.now();
      interstitialAdLoaded = false;
      adLog('Interstitial shown');
      loadInterstitialAd();
      return { granted: true, adShown: true, message: '' };
    } catch (err: any) {
      adLog(`Show interstitial FAILED: ${err?.message || err}`, 'error');
      loadInterstitialAd();
    }
  } else {
    adLog('Interstitial not loaded, loading now');
    loadInterstitialAd();
  }
  return { granted: true, adShown: false, message: '' };
}

// ============ Rewarded Ad ============
async function loadRewardedAd(): Promise<void> {
  if (!isNative()) return;
  try {
    const AdMob = await getAdMob();
    adLog(`Loading rewarded: ${AD_UNITS.rewarded}`);
    await AdMob.prepareRewardVideoAd({ adId: AD_UNITS.rewarded });
    rewardedAdLoaded = true;
    adLoadAttempts.rewarded = 0;
    adLog('Rewarded ad loaded');
  } catch (err: any) {
    rewardedAdLoaded = false;
    adLoadAttempts.rewarded++;
    adLog(`Rewarded load FAILED (attempt ${adLoadAttempts.rewarded}): ${err?.message || err}`, 'error');
  }
}

export async function showRewardedAd(featureName: string = 'Feature'): Promise<AdResult> {
  if (!isNative()) return { granted: true, adShown: false, message: '' };
  if (!canShowAd('rewarded')) {
    adLog('Rewarded on cooldown, granting free');
    return { granted: true, adShown: false, message: '' };
  }

  if (rewardedAdLoaded) {
    try {
      const AdMob = await getAdMob();
      await AdMob.showRewardVideoAd();
      lastAdShownAt.rewarded = Date.now();
      rewardedAdLoaded = false;
      adLog(`Rewarded shown for ${featureName}`);
      loadRewardedAd();
      return { granted: true, adShown: true, message: '' };
    } catch (err: any) {
      adLog(`Show rewarded FAILED: ${err?.message || err}`, 'error');
      loadRewardedAd();
      return { granted: true, adShown: false, message: '' };
    }
  }

  adLog(`Rewarded not loaded for ${featureName}, granting free`);
  loadRewardedAd();
  return { granted: true, adShown: false, message: '' };
}

// ============ App Open Ad ============
export async function showAppOpenAd(): Promise<AdResult> {
  if (!isNative()) return { granted: true, adShown: false, message: '' };
  if (!canShowAd('appOpen')) {
    adLog('App open on cooldown');
    return { granted: true, adShown: false, message: '' };
  }

  try {
    const AdMob = await getAdMob();
    adLog(`Loading app open: ${AD_UNITS.appOpen}`);
    await AdMob.prepareInterstitial({ adId: AD_UNITS.appOpen });
    await AdMob.showInterstitial();
    lastAdShownAt.appOpen = Date.now();
    adLog('App open ad shown');
    return { granted: true, adShown: true, message: '' };
  } catch (err: any) {
    adLog(`App open FAILED: ${err?.message || err}`, 'error');
    return { granted: true, adShown: false, message: '' };
  }
}

// ============ Convenience ============
export function createAdGate(featureName: string) {
  return async (callback: () => void): Promise<{ adShown: boolean; message: string }> => {
    const result = await showRewardedAd(featureName);
    if (result.granted) callback();
    return { adShown: result.adShown, message: result.message };
  };
}
