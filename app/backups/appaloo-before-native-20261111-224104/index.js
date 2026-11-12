// Intentionally inert. Do NOT import expo-modules-core or react-native here.
// Expo may require this file while resolving config / autolinking.
// Runtime API is in src/index.js (used only by the app, not by config).

module.exports = {
  isAvailable() {
    return false;
  },
  async loadInterstitial() {
    return { success: false, reason: 'use_src_entry' };
  },
  DEFAULT_AD_ID: 'd8819a07-c3f9-476d-8de6-a38b1a830026',
};
