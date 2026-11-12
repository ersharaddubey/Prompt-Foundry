# Prompt Foundry — Puter primary auth + User-Pays image generation

## What changed

- Native Android sign-in now uses Puter as the primary identity. No separate Prompt Foundry password or signup is required in the mobile app.
- A trusted Puter Worker reads the caller identity from `user.puter`, then asks the Vercel API to issue a short-lived, one-time exchange code.
- The mobile app exchanges that code for a Prompt Foundry JWT. The JWT is stored with `expo-secure-store` (Android Keystore-backed storage).
- Puter authorization and generation now run inside an embedded React Native WebView modal. The user returns directly to the Prompt Foundry screen; the app does not intentionally open the Puter website in an external browser. WebView cookies and DOM storage are enabled for session persistence. Puter may still show its own first-time login/consent UI inside the app.
- Text-to-image and reference-image generation run through `user.puter.ai.txt2img`, so Puter meters the customer's own account. The generated output is stored in that customer's Puter app storage.
- Existing ImageKit remains enabled for profile avatars and optional reference-image uploads. Existing Cloudinary routes/features are untouched and remain on your account for your own app images. This integration does not remove either storage provider or their existing keys/configuration.
- Cashfree payment routes and credit-purchase checkout have been removed. The mobile app has no Prompt Foundry credit packs or internal image-generation balance.
- The old server-side Cloudflare image-generation path has been removed from `/api/generate`; image generation and user billing run through the customer's Puter session.
- ImageKit remains enabled for app-owned assets, profile avatars, and optional reference-image uploads. It is not used to bill customers.

## 1. Configure Vercel

In the Vercel project that deploys `appAdmin/server`, add:

- `PUTER_BRIDGE_SECRET`: a newly generated random secret (at least 64 hex characters).
- Keep existing `MONGO_URI`, `JWT_SECRET`, and `IMAGEKIT_*` variables. ImageKit is still used for uploaded reference images and avatars.

Generate a secret locally with:

```bash
openssl rand -hex 32
```

Do not commit the value to Git or put it in the Android app. Set it only in Vercel and in the private Puter Worker source.

## 2. Deploy the Puter Worker

1. Open `worker/index.js` from this repository.
2. Replace `REPLACE_WITH_64_CHAR_RANDOM_SECRET` with the exact `PUTER_BRIDGE_SECRET` value configured in Vercel.
3. Keep `PROMPT_FOUNDRY_API` set to `https://prompt-foundry-nine.vercel.app/api`.
4. Sign in to Puter CLI using your own Puter owner account, then deploy:

```bash
npm install -g @heyputer/cli
puter login
puter worker deploy worker/index.js prompt-foundry-bridge
```

5. The Worker URL will be `https://prompt-foundry-bridge.puter.work`. Wait for deployment propagation, then test:

```bash
curl https://prompt-foundry-bridge.puter.work/health
```

Expected response: `{"ok":true,"service":"prompt-foundry-puter-bridge"}`.

The worker is the trusted identity boundary. Do not move the shared secret into the app, HTML bridge, or query string.

## 3. Deploy the Vercel API

Deploy the updated `appAdmin/server` project to Vercel. The new static bridge page must be reachable at:

`https://prompt-foundry-nine.vercel.app/puter-bridge.html`

The new API routes are:

- `POST /api/auth/puter/issue` — worker-only, protected by `PUTER_BRIDGE_SECRET`.
- `POST /api/auth/puter/exchange` — consumes a two-minute one-time code and returns the Prompt Foundry JWT.
- `POST /api/generate/puter-reference-upload` — authenticated upload to existing ImageKit.
- `POST /api/generate/puter-record` — records the output URL/path in MongoDB history.

Run the index migration once against the production MongoDB database (from `appAdmin/server` with the production `MONGO_URI` in your shell):

```bash
npm install
node scripts/migrate-puter.js
```

The `PuterAuthCode` collection uses a TTL index; expired codes are automatically removed by MongoDB.

## 4. Configure and build Android

From the `app` directory, set the Worker URL in the build environment:

```bash
export EXPO_PUBLIC_PUTER_WORKER_URL=https://prompt-foundry-bridge.puter.work
npm install
npx expo-doctor
npx expo run:android
```

For an EAS preview APK:

```bash
EXPO_PUBLIC_PUTER_WORKER_URL=https://prompt-foundry-bridge.puter.work eas build -p android --profile preview
```

The Puter bridge runs inside the app WebView and returns results through the native WebView message channel. The legacy `somyalaya` URL scheme remains in app configuration for backward compatibility, but is no longer used by the Puter flow.

## 5. Important behavior and limits

- First-time Puter sign-in/authorization is required and cannot be silently bypassed. The bridge page is branded Prompt Foundry; Puter's own account/consent UI remains visible when authorization is required.
- Android keeps the Puter web session in the embedded WebView cookie/DOM storage and the Prompt Foundry JWT in SecureStore. The JWT currently expires after 30 days; after that, users can sign in again and Puter should reuse its remembered authorization where still valid.
- Generated output links are long-lived read URLs (10 years) for the image saved in the user's Puter storage. The user owns the underlying file and can remove it from their Puter account.
- User-Pays is Puter's billing model; model availability, included allowance, prices, and overage rules are controlled by Puter and may change.
- This ZIP contains code only. Vercel deployment, Vercel environment-variable setup, Puter Worker deployment, and a real Android device sign-in/generation test must be completed by the owner.

## 6. Billing behavior

- There is no Cashfree integration, Cashfree checkout page, credit-purchase API, or in-app image credit pack in this build.
- The in-app **AI Billing** screen is informational only. It explains Puter User-Pays and links users to their Puter account; it does not sell credits or collect payment.
- Puter controls its own allowance, usage metering, pricing, and any pay-as-you-go/top-up flow. Prompt Foundry does not receive or store payment details.
- Legacy `credits` / `dailyCredits` MongoDB fields are retained for backward-compatible records only; they are not used by the native Puter image-generation flow. Do not manually grant or deduct these fields for Puter usage.
- Creator tipping/payment buttons were also removed because they depended on the removed Cashfree payment path. Travel posts, likes, saves, reports, and AI inspiration remain.
