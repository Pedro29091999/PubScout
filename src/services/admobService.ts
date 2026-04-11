import { Capacitor } from '@capacitor/core';

const APP_OPEN_AD_UNIT_ID = 'ca-app-pub-8748344406083155/3761085560';
// Test ID for verification: 'ca-app-pub-3940256099942544/9257395915'

export async function initializeAdMob() {
  if (!Capacitor.isNativePlatform()) {
    console.log('AdMob: Not a native platform, skipping initialization.');
    return;
  }

  try {
    const { AdMob } = await import('@capacitor-community/admob');
    await AdMob.initialize({
      testingDevices: [],
      initializeForTesting: false,
    });
    
    // Request tracking authorization for iOS
    if (Capacitor.getPlatform() === 'ios') {
      await AdMob.requestTrackingAuthorization();
    }
    
    console.log('AdMob: Initialized successfully.');
  } catch (error) {
    console.error('AdMob: Initialization failed:', error);
  }
}

/**
 * Shows an app open ad on startup.
 */
export async function showAppOpenAd() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { AdMob, AdMobAdEvent } = await import('@capacitor-community/admob');
    
    console.log('AdMob: Preparing App Open Ad...');
    
    // Listen for load events
    const adLoadedListener = AdMob.addListener(AdMobAdEvent.InterstitialAdLoaded, async () => {
      console.log('AdMob: Ad loaded, showing now...');
      await AdMob.showInterstitial();
      adLoadedListener.remove();
    });

    const adFailedListener = AdMob.addListener(AdMobAdEvent.InterstitialAdFailedToLoad, (info) => {
      console.error('AdMob: Ad failed to load:', info);
      adFailedListener.remove();
      adLoadedListener.remove();
    });

    // We use Interstitial as a fallback/proxy if AppOpen is not fully stable in the current build
    // but the plugin version 6+ supports it. Let's stick to Interstitial for now as it's more reliable
    // in the community plugin for "startup" style ads unless specifically configured.
    await AdMob.prepareInterstitial({
      adId: APP_OPEN_AD_UNIT_ID,
      isTesting: false, // Set to true for development testing
    });

  } catch (error) {
    console.error('AdMob: Failed to show startup ad:', error);
  }
}

/**
 * Shows a banner ad at the bottom of the screen.
 */
export async function showBannerAd() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { AdMob, BannerAdPosition, BannerAdSize } = await import('@capacitor-community/admob');
    
    const options = {
      adId: 'ca-app-pub-8748344406083155/1215456338', // Banner Ad Unit ID
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: false,
    };

    await AdMob.showBanner(options);
    console.log('AdMob: Banner Ad shown.');
  } catch (error) {
    console.error('AdMob: Failed to show banner ad:', error);
  }
}
