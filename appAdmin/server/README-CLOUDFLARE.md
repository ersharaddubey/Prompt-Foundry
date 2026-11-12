# Cloudflare Workers AI image generation

The API server calls `@cf/black-forest-labs/flux-1-schnell` from `POST /api/generate`.

Set these variables in the backend deployment environment (or local `appAdmin/server/.env`):

- `CLOUDFLARE_API_TOKEN`: a newly rotated Workers AI API token with Workers AI permissions.
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account ID copied from the Workers AI dashboard.
- `CLOUDFLARE_IMAGE_MODEL`: defaults to `@cf/black-forest-labs/flux-1-schnell`.
- `FREE_TESTING_MODE=true`: skips the app's credit balance check and does not deduct credits.

The Admin Panel's **AI Image API** tab displays whether the backend is configured and whether free testing mode is on. It never displays secret values. Keys are deliberately configured on the backend host, not in the browser or APK.

## Important limitations

- This integration currently supports text-to-image. Reference-image/image-to-image uploads are rejected with a clear message because this FLUX endpoint integration is not wired for image conditioning.
- If Cloudinary credentials are configured, generated images are uploaded there and a persistent URL is saved to history. Without Cloudinary, the API returns a base64 data URI for immediate preview; that result is not persisted to image history.
- R2 Access Key ID / Secret Access Key are S3-compatible object-storage credentials, not Workers AI credentials. They are not used by this image-generation endpoint. R2 storage needs a bucket name and endpoint and should be integrated separately if desired.
- Free Testing Mode is a server-side switch. Turn it off after review/testing. It does not itself remove subscription UI or payment routes elsewhere in the app; those need a separate policy review.

## Local run

1. Copy `.env.example` to `.env` and fill in values locally.
2. Install server dependencies: `cd appAdmin/server && npm install`.
3. Start: `npm run dev`.
4. Sign in to the Admin Panel and open **AI Image API** to verify status.
