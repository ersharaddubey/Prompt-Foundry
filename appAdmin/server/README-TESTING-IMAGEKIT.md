# Prompt Foundry — AI Horde + ImageKit test setup

The image-generation backend now submits anonymous jobs to AI Horde and saves completed images to ImageKit. Prompt Foundry accounts use email/password login; AI Horde login is not required.

## Backend environment

```env
PORT=5001
MONGO_URI=YOUR_MONGODB_CONNECTION_STRING
JWT_SECRET=YOUR_LONG_RANDOM_SECRET
IMAGEKIT_PUBLIC_KEY=YOUR_IMAGEKIT_PUBLIC_KEY
IMAGEKIT_PRIVATE_KEY=YOUR_IMAGEKIT_PRIVATE_KEY
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/YOUR_IMAGEKIT_ID
AI_HORDE_CLIENT_AGENT=PromptFoundry:1.0.0:YOUR_REAL_CONTACT_EMAIL
```

No AI Horde key is required for anonymous generation. Keep all ImageKit private credentials on the backend host.

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

Register/login in Prompt Foundry and generate one image. The app submits a job to `/api/generate/ai-horde`, polls `/api/generate/ai-horde/:jobId`, and stores the completed image in the user's gallery.

## Quota and limitations

- 3 images in any rolling 60-minute window.
- 10 images in any rolling 24-hour window.
- Failed generation requests restore the reservation.
- AI Horde is volunteer-worker based; queue time and model availability are not guaranteed.
- Anonymous requests are low priority and processed under AI Horde's sharing rules. Disclose third-party worker/data handling to users.
