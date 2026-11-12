import { Platform } from 'react-native';

const DEFAULT_AD_ID = 'd8819a07-c3f9-476d-8de6-a38b1a830026';

function getNativeModule() {
  try {
    // Lazy require so this file can be loaded during config resolution without exploding
    const { requireNativeModule, NativeModulesProxy } = require('expo-modules-core');
    try {
      return requireNativeModule('Appaloo');
    } catch {
      return NativeModulesProxy?.Appaloo || null;
    }
  } catch {
    return null;
  }
}

/**
 * Returns true only on Android when the native module is linked.
 */
export function isAvailable() {
  if (Platform.OS !== 'android') return false;
  try {
    const mod = getNativeModule();
    return mod?.isAvailable?.() ?? !!mod;
  } catch {
    return false;
  }
}

/**
 * Load & show an interstitial ad.
 *
 * @param {string} [adId] - Optional Ad ID. Defaults to project ad ID.
 * @returns {Promise<{success: boolean, appName?: string, adId: string}>}
 */
export async function loadInterstitial(adId = DEFAULT_AD_ID) {
  if (Platform.OS !== 'android') {
    console.warn('[Appaloo] Interstitial ads are only supported on Android');
    return { success: false, reason: 'unsupported_platform' };
  }

  const AppalooNative = getNativeModule();

  if (!AppalooNative || typeof AppalooNative.loadInterstitial !== 'function') {
    console.warn(
      '[Appaloo] Native module not found. Did you run `npx expo prebuild` and rebuild the app?'
    );
    return { success: false, reason: 'module_not_found' };
  }

  try {
    const result = await AppalooNative.loadInterstitial(adId || DEFAULT_AD_ID);
    return result;
  } catch (err) {
    console.warn('[Appaloo] loadInterstitial failed:', err?.message || err);
    throw err;
  }
}

export default {
  isAvailable,
  loadInterstitial,
  DEFAULT_AD_ID,
};
