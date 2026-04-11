import { Capacitor } from '@capacitor/core';

const APP_OPEN_AD_UNIT_ID = 'ca-app-pub-8748344406083155/3761085560';

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
 * Shows an ad on app startup. 
 * Note: Using Interstitial as a proxy for App Open since the current 
 * community plugin version primarily supports Interstitial for full-screen ads.
 */
export async function showAppOpenAd() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { AdMob } = await import('@capacitor-community/admob');
    const options = {
      adId: APP_OPEN_AD_UNIT_ID,
      isTesting: false,
    };

    await AdMob.prepareInterstitial(options);
    await AdMob.showInterstitial();
    console.log('AdMob: Startup Ad (Interstitial) shown.');
  } catch (error) {
    console.error('AdMob: Failed to show startup ad:', error);
  }
}
