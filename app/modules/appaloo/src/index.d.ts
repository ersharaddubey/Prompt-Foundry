export declare const DEFAULT_AD_ID: string;

export declare function isAvailable(): boolean;

export declare function loadInterstitial(
  adId?: string
): Promise<{
  success: boolean;
  appName?: string;
  adId?: string;
  reason?: string;
}>;

declare const _default: {
  isAvailable: typeof isAvailable;
  loadInterstitial: typeof loadInterstitial;
  DEFAULT_AD_ID: string;
};

export default _default;
