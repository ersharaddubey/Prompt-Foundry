# Travel Memories – Create, Share & Earn

Incremental feature added on top of existing PromptFoundry (Expo mobile + Express/Mongo API).

## What was implemented

### Backend (`appAdmin/server/`)

| File | Purpose |
|------|---------|
| `models/TravelMemory.js` | Core photo + location + moderation (ImageKit file id) |
| `models/TravelMemoryLike.js` | Likes |
| `models/TravelMemorySave.js` | Saves / bookmarks |
| `models/AIInspiration.js` | Links generated AI image → original memory |
| `models/CreatorSupport.js` | Buy-me-a-coffee style payments (Cashfree) + payout tracking |
| `models/TravelMemoryReport.js` | Copyright / abuse reports |
| `middleware/auth.js` | JWT `requireAuth` / `optionalAuth` / `requireAdmin` |
| `lib/imagekitUpload.js` | Buffer upload helpers → **ImageKit** |
| `routes/travelMemories.js` | Full CRUD, feed, like/save, inspire, report, admin moderate |
| `routes/creatorSupport.js` | **Cashfree** order + webhook + verify + admin transactions |
| `index.js` | Mounted `/api/travel-memories` and `/api/support` |

### Mobile (`app/`)

| Route / Screen | Purpose |
|----------------|---------|
| Tab **Travel** → `TravelExploreScreen` | Pinterest-style grid, search, category/sort chips |
| `/travel/upload` | Upload with ownership confirmation |
| `/travel/[id]` | Detail, like/save, Create with AI, Support Creator, report |
| `GenerateScreen` | Accepts `inspirationId` + remote reference image; records AIInspiration; shows attribution |

### Not fully live (by design)

1. **Payment provider keys** – Without `CASHFREE_CLIENT_ID` + `CASHFREE_CLIENT_SECRET`, `/api/support/create-intent` returns `503 PAYMENT_PROVIDER_MISSING`. No fake success.
2. **Creator payouts** – Platform holds funds; admin uses `mark-paid` until Cashfree Easy Split / vendor payout is wired.
3. **Missing original server source** – `routes/auth.js`, `models/User.js`, existing generate route, etc. were not in the zip. Merge carefully with your live backend.
4. **Admin web UI** – API endpoints for moderation/reports exist; Admin.jsx tab UI for Travel Memories can be added similarly to existing prompts tab.

## API summary

```
GET    /api/travel-memories              Feed (q, category, sort, page)
GET    /api/travel-memories/categories
GET    /api/travel-memories/:id
POST   /api/travel-memories              multipart image + fields (auth) → ImageKit
PATCH  /api/travel-memories/:id
DELETE /api/travel-memories/:id
POST   /api/travel-memories/:id/like
POST   /api/travel-memories/:id/save
POST   /api/travel-memories/:id/inspire  { generatedImageUrl, prompt, ratio }
POST   /api/travel-memories/:id/report
GET    /api/travel-memories/me/dashboard
GET    /api/travel-memories/creator/:userId
GET    /api/travel-memories/admin/pending
POST   /api/travel-memories/admin/:id/moderate  { action: approve|reject|remove }
GET    /api/travel-memories/admin/reports
POST   /api/travel-memories/admin/reports/:id/resolve

POST   /api/support/create-intent       { toUserId, travelMemoryId?, amountCents|amountInr, message? }
POST   /api/support/webhook             Cashfree notify / webhook
POST   /api/support/verify              { supportId|orderId } – poll after checkout
GET    /api/support/received
GET    /api/support/admin/transactions
POST   /api/support/admin/:id/mark-paid
```

## Environment variables

```
MONGO_URI=
JWT_SECRET=

# ImageKit (images)
IMAGEKIT_PUBLIC_KEY=
IMAGEKIT_PRIVATE_KEY=
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_imagekit_id

# Cashfree (creator support payments)
CASHFREE_CLIENT_ID=          # also accepts REMOVED_CASHFREE_APP_ID
CASHFREE_CLIENT_SECRET=      # also accepts REMOVED_CASHFREE_SECRET_KEY
REMOVED_CASHFREE_ENV=sandbox         # or production
CASHFREE_API_VERSION=2023-08-01
CASHFREE_NOTIFY_URL=https://your-api.com/api/support/webhook
API_PUBLIC_URL=https://your-api.com
CLIENT_URL=https://your-frontend-or-app-deep-link
PLATFORM_FEE_PERCENT=10
```

## Server dependencies

```bash
cd appAdmin/server
npm install multer imagekit jsonwebtoken mongoose express cors dotenv
# Optional cleanup:
# npm uninstall cloudinary stripe
```

## Integration checklist

1. Copy new models/routes/middleware/lib into your **real** server repo.
2. Set ImageKit + Cashfree env vars (never commit secrets).
3. Ensure `User` model has `name`, `username`, `avatar`, `country`, `bio` (or adjust populate).
4. Align `middleware/auth.js` with your JWT payload (`id` vs `_id`).
5. Deploy; confirm ImageKit upload + Cashfree sandbox order.
6. Cashfree Dashboard → Webhooks → point to `/api/support/webhook` (or use `notify_url` on order).
7. Mobile: rebuild / restart Expo; open **Travel** tab.

## Support payment amounts

- Stored as **paise** in `amountCents` (₹1 = 100).
- Minimum **₹10** (`amountCents: 1000` or `amountInr: 10`).
- Currency fixed to **INR** for Cashfree.

## Testing (manual)

- [ ] Upload photo → ImageKit URL saved, status `pending`
- [ ] Admin approve → appears in public feed
- [ ] Like / save / search / category filters
- [ ] Create with AI → Generate opens with reference + attribution
- [ ] Report flow
- [ ] Support without Cashfree keys → clear `503 PAYMENT_PROVIDER_MISSING`
- [ ] Support with Cashfree sandbox → order + `paymentSessionId` / link
- [ ] Webhook or `/api/support/verify` marks `succeeded`

## Remaining limitations

- Original backend source not in zip → merge into live server carefully.
- Web admin Travel moderation tab not yet added to `Admin.jsx` (APIs ready).
- Real creator payouts need Cashfree Easy Split / vendor onboarding or manual bank transfer + `mark-paid`.
- Image-to-image quality depends on existing `/api/generate` reference-image support.


## Admin dashboard integration (included in this revision)

The web Admin Panel now includes a **Travel Memories** tab with status filtering,
search, image previews, creator/location metadata, and approve/reject/remove/delete actions.
The Express API mounts `/api/travel-memories`; uploads are stored in MongoDB and images
are uploaded to ImageKit.

Because the existing User model in this project does not define an admin role, protect
the moderation endpoints by setting `ADMIN_EMAILS` on the API deployment to a comma-
separated list of administrator login email addresses (or `ADMIN_EMAIL` for one address).
The existing JWT login must belong to one of those email addresses. Do not leave this
variable unset in production.

Required existing server environment:
- `MONGO_URI`
- `JWT_SECRET`
- `IMAGEKIT_PUBLIC_KEY`
- `IMAGEKIT_PRIVATE_KEY`
- `IMAGEKIT_URL_ENDPOINT`
- `ADMIN_EMAILS` (administrator login email(s), comma-separated)

Deploy/restart the API and web admin together. Mobile uploads will be saved as `pending`;
they appear under Admin → Travel Memories → Pending review. Approved public submissions
appear in the mobile Travel feed. Existing uploads made before this integration are not
automatically imported unless they already exist in the same MongoDB collection.
