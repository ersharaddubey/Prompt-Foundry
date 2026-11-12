# Appaloo SDK Integration (Android)

Ad ID: `d8819a07-c3f9-476d-8de6-a38b1a830026`

## What was added

1. **Config Plugin** → `plugins/withAppaloo.js`
   - Adds Maven repo: `https://download.appaloo.io/appaloo-sdk/android`
   - Adds dependency: `io.appaloo:sdk:1.0.3`
   - Ensures `INTERNET` permission

2. **Local Expo Module** → `modules/appaloo`
   - Native Kotlin bridge (`AppalooModule.kt`)
   - JS API: `loadInterstitial(adId?)`

3. **Helper** → `src/utils/appaloo.js`
   - Safe wrapper: `showInterstitial()`

4. **Usage**
   - After successful image generation on **Generate** screen, an interstitial is requested automatically (Android only).

## How to build (required)

Appaloo is a **native Android SDK**. It will **not** work inside Expo Go.

```bash
cd app

# 1. Install deps (includes local module)
npm install

# 2. Generate native android/ folder with the plugin applied
npx expo prebuild --clean --platform android

# 3a. Local development build
npx expo run:android

# 3b. Or EAS cloud build
eas build -p android --profile preview
```

## Manual check after prebuild

After `expo prebuild`, open:

- `android/settings.gradle` or `android/build.gradle` → should contain the Appaloo Maven URL
- `android/app/build.gradle` → should contain `implementation("io.appaloo:sdk:1.0.3")`

## JS usage anywhere

```js
import { showInterstitial, APPALOO_AD_ID } from '../utils/appaloo';

// Fire and forget
showInterstitial();

// Or with custom ad ID
showInterstitial('your-other-ad-id');
```

## Notes

- iOS is not supported by the Appaloo SDK provided.
- The ad call is non-blocking. Failures are logged and ignored so generation UX is never broken.
- If the native module is missing (e.g. you forgot prebuild), `showInterstitial` simply returns `{ success: false }`.
