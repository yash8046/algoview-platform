/**
 * AdMob service for native Android/iOS.
 *
 * Notes:
 * - This Capacitor plugin supports Banner, Interstitial, Rewarded, Rewarded Interstitial.
 * - It does NOT expose native App Open ads, so we intentionally no-op that flow.
 * - Features are never blocked: if an ad is unavailable, access is granted silently.
 */

import { Capacitor } from '@capacitor/core';

export type AdLogEntry = { time: string; msg: string; level: 'info' | 'warn' | 'error' };

const adLogs: AdLogEntry[] = [];
const adLogListeners: Array<(logs: AdLogEntry[]) => void> = [];

function adLog(msg: string, level: 'info' | 'warn' | 'error' = 'info') {
  const entry: AdLogEntry = { time: new Date().toLocaleTimeString(), msg, level };
  adLogs.push(entry);
  if (adLogs.length > 100) adLogs.shift();
  adLogListeners.forEach((fn) => fn([...adLogs]));

  if (level === 'error') console.error('[AdService]', msg);
  else if (level === 'warn') console.warn('[AdService]', msg);
  else console.log('[AdService]', msg);
}

export function subscribeAdLogs(fn: (logs: AdLogEntry[]) => void) {
  adLogListeners.push(fn);
  fn([...adLogs]);
  return () => {
    const index = adLogListeners.indexOf(fn);
    if (index >= 0) adLogListeners.splice(index, 1);
  };
}

export function getAdLogs() {
  return [...adLogs];
}

let isInitialized = false;
let initPromise: Promise<void> | null = null;
let listenersAttached = false;
let consentResolved = false;
let rewardedAdLoaded = false;
let interstitialAdLoaded = false;
let adLoadAttempts = { rewarded: 0, interstitial: 0 };
let lastAdShownAt = { rewarded: 0, interstitial: 0, appOpen: 0 };
let bannerVisible = false;

const AD_UNITS = {
  banner: 'ca-app-pub-3940256099942544/9214589741',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
  appOpen: 'ca-app-pub-3940256099942544/9257395921',
} as const;

const COOLDOWNS = {
  rewarded: 30_000,
  interstitial: 60_000,
  appOpen: 300_000,
};

const LOAD_WAIT_MS = 5000;

export interface AdResult {
  granted: boolean;
  adShown: boolean;
  message: string;
}

async function getAdMobModule() {
  return await import('@capacitor-community/admob');
}

async function getAdMob() {
  const { AdMob } = await getAdMobModule();
  return AdMob;
}

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

function canShowAd(type: keyof typeof COOLDOWNS): boolean {
  return Date.now() - lastAdShownAt[type] >= COOLDOWNS[type];
}

function safeStringify(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(condition: () => boolean, timeoutMs = LOAD_WAIT_MS, stepMs = 250) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (condition()) return true;
    await wait(stepMs);
  }
  return condition();
}

async function attachListeners() {
  if (!isNative() || listenersAttached) return;

  const { AdMob, RewardAdPluginEvents, InterstitialAdPluginEvents, BannerAdPluginEvents } = await getAdMobModule();

  listenersAttached = true;

  await AdMob.addListener(RewardAdPluginEvents.Loaded, () => {
    rewardedAdLoaded = true;
    adLoadAttempts.rewarded = 0;
    adLog('Rewarded event: loaded');
  });

  await AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (event) => {
    rewardedAdLoaded = false;
    adLoadAttempts.rewarded += 1;
    adLog(`Rewarded event: failed to load ${safeStringify(event)}`, 'error');
  });

  await AdMob.addListener(RewardAdPluginEvents.FailedToShow, (event) => {
    adLog(`Rewarded event: failed to show ${safeStringify(event)}`, 'error');
  });

  await AdMob.addListener(RewardAdPluginEvents.Showed, () => {
    adLog('Rewarded event: showed');
  });

  await AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
    interstitialAdLoaded = true;
    adLoadAttempts.interstitial = 0;
    adLog('Interstitial event: loaded');
  });

  await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (event) => {
    interstitialAdLoaded = false;
    adLoadAttempts.interstitial += 1;
    adLog(`Interstitial event: failed to load ${safeStringify(event)}`, 'error');
  });

  await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, (event) => {
    adLog(`Interstitial event: failed to show ${safeStringify(event)}`, 'error');
  });

  await AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
    adLog('Banner event: loaded');
  });

  await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (event) => {
    adLog(`Banner event: failed to load ${safeStringify(event)}`, 'error');
  });

  adLog('AdMob listeners attached');
}

async function resolveConsent() {
  if (!isNative() || consentResolved) return;

  try {
    const AdMob = await getAdMob();
    const consentInfo = await AdMob.requestConsentInfo();

    adLog(
      `Consent info: canRequestAds=${Boolean((consentInfo as any)?.canRequestAds)}, formAvailable=${Boolean((consentInfo as any)?.isConsentFormAvailable)}, status=${(consentInfo as any)?.status ?? 'unknown'}`,
    );

    if (!(consentInfo as any)?.canRequestAds && (consentInfo as any)?.isConsentFormAvailable) {
      adLog('Showing consent form...');
      const updatedConsent = await AdMob.showConsentForm();
      adLog(
        `Consent updated: canRequestAds=${Boolean((updatedConsent as any)?.canRequestAds)}, status=${(updatedConsent as any)?.status ?? 'unknown'}`,
      );
    }
  } catch (error) {
    adLog(`Consent flow skipped/failed: ${safeStringify(error)}`, 'warn');
  } finally {
    consentResolved = true;
  }
}

export async function initAdMob(): Promise<void> {
  adLog(`initAdMob called. isNative=${isNative()}, isInitialized=${isInitialized}`);
  if (!isNative() || isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      adLog('Importing AdMob module...');
      await attachListeners();

      const AdMob = await getAdMob();
      adLog('AdMob module imported, calling initialize...');
      await AdMob.initialize();

      isInitialized = true;
      adLog('AdMob initialized successfully');

      await resolveConsent();
      await Promise.allSettled([loadRewardedAd(), loadInterstitialAd()]);
    } catch (error) {
      adLog(`AdMob init FAILED: ${safeStringify(error)}`, 'error');
      throw error;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

export async function showBannerAd(position: 'TOP' | 'BOTTOM' = 'BOTTOM'): Promise<void> {
  if (!isNative() || bannerVisible) return;

  try {
    await initAdMob();
    const AdMob = await getAdMob();
    const { BannerAdSize, BannerAdPosition } = await getAdMobModule();

    adLog(`Showing banner: ${AD_UNITS.banner}, position=${position}`);
    await AdMob.showBanner({
      adId: AD_UNITS.banner,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: position === 'TOP' ? BannerAdPosition.TOP_CENTER : BannerAdPosition.BOTTOM_CENTER,
    });

    bannerVisible = true;
    adLog('Banner shown request sent');
  } catch (error) {
    adLog(`Banner FAILED: ${safeStringify(error)}`, 'error');
  }
}

export async function hideBannerAd(): Promise<void> {
  if (!isNative() || !bannerVisible) return;

  try {
    const AdMob = await getAdMob();
    await AdMob.hideBanner();
    bannerVisible = false;
  } catch (error) {
    adLog(`Hide banner failed: ${safeStringify(error)}`, 'warn');
  }
}

export async function removeBannerAd(): Promise<void> {
  if (!isNative() || !bannerVisible) return;

  try {
    const AdMob = await getAdMob();
    await AdMob.removeBanner();
    bannerVisible = false;
  } catch (error) {
    adLog(`Remove banner failed: ${safeStringify(error)}`, 'warn');
  }
}

async function loadInterstitialAd(): Promise<void> {
  if (!isNative()) return;

  try {
    const AdMob = await getAdMob();
    adLog(`Preparing interstitial: ${AD_UNITS.interstitial}`);
    await AdMob.prepareInterstitial({ adId: AD_UNITS.interstitial });
    interstitialAdLoaded = true;
    adLoadAttempts.interstitial = 0;
    adLog('Interstitial prepared');
  } catch (error) {
    interstitialAdLoaded = false;
    adLoadAttempts.interstitial += 1;
    adLog(`Interstitial prepare FAILED (attempt ${adLoadAttempts.interstitial}): ${safeStringify(error)}`, 'error');
  }
}

export async function showInterstitialAd(): Promise<AdResult> {
  if (!isNative()) return { granted: true, adShown: false, message: '' };

  try {
    await initAdMob();
  } catch {
    return { granted: true, adShown: false, message: '' };
  }

  if (!canShowAd('interstitial')) {
    adLog('Interstitial on cooldown, skipping');
    return { granted: true, adShown: false, message: '' };
  }

  if (!interstitialAdLoaded) {
    adLog('Interstitial not ready, preparing and waiting...');
    await loadInterstitialAd();
    const isReady = await waitFor(() => interstitialAdLoaded);
    if (!isReady) {
      adLog('Interstitial still not ready after wait, skipping', 'warn');
      return { granted: true, adShown: false, message: '' };
    }
  }

  try {
    const AdMob = await getAdMob();
    await AdMob.showInterstitial();
    lastAdShownAt.interstitial = Date.now();
    interstitialAdLoaded = false;
    adLog('Interstitial shown');
    void loadInterstitialAd();
    return { granted: true, adShown: true, message: '' };
  } catch (error) {
    adLog(`Show interstitial FAILED: ${safeStringify(error)}`, 'error');
    void loadInterstitialAd();
    return { granted: true, adShown: false, message: '' };
  }
}

async function loadRewardedAd(): Promise<void> {
  if (!isNative()) return;

  try {
    const AdMob = await getAdMob();
    adLog(`Preparing rewarded: ${AD_UNITS.rewarded}`);
    await AdMob.prepareRewardVideoAd({ adId: AD_UNITS.rewarded });
    rewardedAdLoaded = true;
    adLoadAttempts.rewarded = 0;
    adLog('Rewarded prepared');
  } catch (error) {
    rewardedAdLoaded = false;
    adLoadAttempts.rewarded += 1;
    adLog(`Rewarded prepare FAILED (attempt ${adLoadAttempts.rewarded}): ${safeStringify(error)}`, 'error');
  }
}

export async function showRewardedAd(featureName: string = 'Feature'): Promise<AdResult> {
  if (!isNative()) return { granted: true, adShown: false, message: '' };

  try {
    await initAdMob();
  } catch {
    return { granted: true, adShown: false, message: '' };
  }

  if (!canShowAd('rewarded')) {
    adLog('Rewarded on cooldown, granting free');
    return { granted: true, adShown: false, message: '' };
  }

  if (!rewardedAdLoaded) {
    adLog(`Rewarded not ready for ${featureName}, preparing and waiting...`);
    await loadRewardedAd();
    const isReady = await waitFor(() => rewardedAdLoaded);
    if (!isReady) {
      adLog(`Rewarded still not ready for ${featureName}, granting free`, 'warn');
      return { granted: true, adShown: false, message: '' };
    }
  }

  try {
    const AdMob = await getAdMob();
    await AdMob.showRewardVideoAd();
    lastAdShownAt.rewarded = Date.now();
    rewardedAdLoaded = false;
    adLog(`Rewarded shown for ${featureName}`);
    void loadRewardedAd();
    return { granted: true, adShown: true, message: '' };
  } catch (error) {
    adLog(`Show rewarded FAILED: ${safeStringify(error)}`, 'error');
    void loadRewardedAd();
    return { granted: true, adShown: false, message: '' };
  }
}

export async function showAppOpenAd(): Promise<AdResult> {
  adLog(
    `Skipping App Open ad: this plugin does not support native App Open ads, and unit ${AD_UNITS.appOpen} cannot be shown through the interstitial API.`,
    'warn',
  );
  return { granted: true, adShown: false, message: '' };
}

export function createAdGate(featureName: string) {
  return async (callback: () => void): Promise<{ adShown: boolean; message: string }> => {
    const result = await showRewardedAd(featureName);
    if (result.granted) callback();
    return { adShown: result.adShown, message: result.message };
  };
}
