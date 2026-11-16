# Prompt Foundry — AI Horde generation

## Active image flow

Prompt Foundry app login/register -> authenticated backend -> AI Horde anonymous API -> ImageKit -> user's Prompt Foundry gallery.

The mobile and web generation screens call `POST /api/generate/ai-horde`, then poll `GET /api/generate/ai-horde/:jobId`. `GET /api/generate/quota` returns the user's remaining quota.

## Free quota

- Maximum 3 requests in any rolling 60-minute window.
- Maximum 10 requests in any rolling 24-hour window.
- Failed submissions/generations are marked failed and do not count toward quota.
- Pending requests reserve quota while they are in the queue; pending jobs older than 9 minutes are expired and their reservation is ignored.

## Environment variables

Keep the existing backend variables:

- `MONGO_URI`
- `JWT_SECRET`
- `IMAGEKIT_PUBLIC_KEY`
- `IMAGEKIT_PRIVATE_KEY`
- `IMAGEKIT_URL_ENDPOINT`

Optional:

- `AI_HORDE_CLIENT_AGENT=PromptFoundry:1.0.0:your-contact-email`

No AI Horde API key is required for anonymous access. The anonymous key is used server-side only. Do not call AI Horde directly from the mobile/web client.

## Deployment

1. Deploy the updated `appAdmin/server` backend.
2. Confirm ImageKit environment variables are configured.
3. Deploy/rebuild the Expo app and the web client.
4. Register a normal Prompt Foundry email/password account.
5. Generate a test image and verify it appears in the user's gallery.
6. Test quota behaviour with multiple requests and verify failed requests restore quota.

AI Horde is an asynchronous community-worker service. Queue time and compatible worker availability are not guaranteed. Anonymous requests have low queue priority. Anonymous requests are shared under AI Horde's rules; tell users that prompts/reference images are processed by third-party community workers and may be shared for service/dataset purposes.

## Slider banners

The existing `/api/banners` API provides slide records (`title`, `imageUrl`, `linkUrl`, `order`, `isActive`). Admin Panel -> Slider Banners lets an admin add an image URL and destination website URL. Tapping a slide opens its `linkUrl`.

## AI Billing

The existing in-app AI Billing screen is intentionally left unchanged as requested. It is separate from the AI Horde image-generation path.
