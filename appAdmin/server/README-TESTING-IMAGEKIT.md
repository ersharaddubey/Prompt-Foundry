# Prompt-Foundry: Cloudflare FLUX + ImageKit test setup

## What changed
- Cloudflare Workers AI FLUX.1 Schnell generates text-to-image results.
- ImageKit stores generated images and returns CDN URLs.
- Cloudinary is no longer used by the image-generation endpoint.
- R2 is not required; remove any old R2 environment variables.
- A dedicated test account is provisioned automatically when the backend connects to MongoDB:
  - Email: `textuser@gmail.com`
  - Password: `textuser`
- `FREE_TESTING_MODE=true` grants free image generation only to `TEST_USER_EMAIL`. Other users still use the normal credit rules.
- Admin Panel > AI Image API displays provider, storage, test-mode and test-account status.

## Backend environment
Set these variables in `appAdmin/server/.env` locally and in your hosting provider's backend environment settings:

```env
PORT=5001
MONGO_URI=YOUR_MONGODB_CONNECTION_STRING
JWT_SECRET=YOUR_LONG_RANDOM_SECRET

IMAGEKIT_PUBLIC_KEY=YOUR_IMAGEKIT_PUBLIC_KEY
IMAGEKIT_PRIVATE_KEY=YOUR_IMAGEKIT_PRIVATE_KEY
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/YOUR_IMAGEKIT_ID

CLOUDFLARE_API_TOKEN=YOUR_CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID=YOUR_CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-1-schnell

FREE_TESTING_MODE=true
TEST_USER_EMAIL=textuser@gmail.com
TEST_USER_PASSWORD=textuser
```

Do not put private keys in the frontend or mobile app. The credentials in the included `.env` are placeholders; replace them with working values. The test account is created/updated on backend startup/request after MongoDB connects.

## Run locally
```bash
cd appAdmin/server
npm install
npm run dev
```

In another terminal:
```bash
cd appAdmin/client
npm install
npm run dev
```

Login in the app with the test email/password above. Open Admin Panel > AI Image API and refresh status. Generate a single image using the FLUX model.

## Important
- The test account is the only account that bypasses image credits while free testing mode is enabled.
- Cloudflare Workers AI usage and ImageKit usage remain subject to their provider limits/pricing.
- This is a testing account. Change its password or disable `FREE_TESTING_MODE` before public production launch.
