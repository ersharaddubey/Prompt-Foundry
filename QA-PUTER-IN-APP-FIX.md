# Prompt Foundry — in-app Puter bridge fix

## User-visible issue addressed
- Removed `expo-web-browser` / Android Custom Tabs from the Puter login and generation flow.
- Puter login and image generation now open the Prompt Foundry-branded bridge inside a full-screen React Native WebView modal.
- Successful bridge results are sent to the native app through `window.ReactNativeWebView.postMessage`; they no longer redirect to `somyalaya://puter-auth`.
- The native app returns to its own login/generate screen after the bridge reports success.
- WebView JavaScript, DOM storage, shared cookies, and third-party cookies are enabled to support Puter session persistence.
- Added `react-native-webview` dependency.
- Added default Worker URL `https://prompt-foundry-bridge.puter.work`, while allowing override using `EXPO_PUBLIC_PUTER_WORKER_URL`.

## Important deployment prerequisite
The default URL only removes the missing-configuration error if the Worker has actually been deployed at that exact URL. Deploy `worker/index.js`, replace its placeholder shared secret with the same value as Vercel `PUTER_BRIDGE_SECRET`, then check:

```bash
curl -i https://prompt-foundry-bridge.puter.work/health
```

Expected: HTTP 200 and `{"ok":true,"service":"prompt-foundry-puter-bridge"}`.

If the Worker was deployed under a different name, set that exact HTTPS URL in `app/.env` as `EXPO_PUBLIC_PUTER_WORKER_URL` before rebuilding.

## Local Android test
From `app/`:

```bash
npm install
npx expo install react-native-webview
npx expo-doctor
npx expo run:android
```

Do not use `npm ci` before refreshing the lockfile; the environment used to prepare this patch had no npm registry access, so it could not resolve and regenerate `package-lock.json` for the new native dependency.

## Checks performed here
- `node --check` passed for Worker and server JavaScript files.
- Verified the native auth context uses an embedded WebView and no longer calls `openAuthSessionAsync`.
- Verified app configuration contains a default Worker URL and the bridge HTML posts success results to the native WebView.
- ZIP integrity check passed after packaging.

## Not yet verified
- Android native build and runtime behavior.
- Actual Puter login/consent behavior inside Android WebView (Puter may require a supported browser/auth surface on some devices).
- Live Worker deployment, Vercel secret configuration, and real paid image generation.
