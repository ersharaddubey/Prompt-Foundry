# Billing update — Puter User-Pays only

- Removed the Cashfree payment router and its order, checkout-page, and verify endpoints.
- Removed the in-app Cashfree creator-support/tipping controls that depended on that payment path.
- The former credit-purchase destination is now an informational **AI Billing** page. It does not sell Prompt Foundry credits or collect payment; it explains Puter User-Pays and links to Puter account management.
- Removed the legacy Cloudflare server-side image-generation endpoint and its Prompt Foundry credit deductions. Native image generation continues through the customer's Puter session.
- Kept ImageKit for Prompt Foundry reference uploads and avatars. Existing Cloudinary functionality is not removed or reconfigured.
- Kept MongoDB `credits` and `dailyCredits` fields as legacy data for backward compatibility; native Puter image generation does not read or deduct them. No MongoDB data migration is required for this UI/payment removal.
- Removed creator tipping controls rather than leaving a nonfunctional payment option. Travel sharing, likes, saves, reports, and AI inspiration remain.

## Deployment cleanup

After deploying the updated backend to Vercel, remove obsolete environment variables if present: `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, and `CASHFREE_ENV`. Do not remove `IMAGEKIT_*`, Cloudinary, MongoDB, JWT, or Puter bridge settings.

## Verification

From `appAdmin/server`, run:

```bash
npm run qa:billing-removal
```

This static QA verifies the payment route is absent, the API no longer mounts it, the native app screens contain no Cashfree checkout references, and the image-generation backend uses Puter User-Pays metadata. It is not a live Android device or production billing test.
