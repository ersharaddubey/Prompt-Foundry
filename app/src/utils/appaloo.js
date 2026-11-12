import {
  isAvailable,
  loadInterstitial,
  DEFAULT_AD_ID,
} from 'appaloo/src';

export async function showInterstitial() {
  try {
    if (!isAvailable()) {
      console.warn('[Appaloo] Native SDK is not available.');
      return { success: false, reason: 'module_not_found' };
    }

    const result = await loadInterstitial(DEFAULT_AD_ID);

    console.log('[Appaloo] Interstitial result:', result);

    return result;
  } catch (error) {
    console.warn('[Appaloo] Interstitial error:', error);
    return {
      success: false,
      reason: 'javascript_error',
      message: error?.message,
    };
  }
}
