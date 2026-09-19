import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    // Extra payload sent to the app (e.g. { screen: 'challenge' }) so tapping
    // the notification can deep-link somewhere.
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Right now we only support 'all', but this leaves room to add
    // segments (e.g. 'active', 'paid') later without a schema change.
    target: { type: String, default: 'all' },
    // null/undefined scheduledAt = send immediately.
    scheduledAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['scheduled', 'sent', 'failed', 'cancelled'],
      default: 'scheduled',
    },
    sentAt: { type: Date, default: null },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    error: { type: String, default: '' },
    // Set when this notification was auto-created by a Daily Challenge being
    // published, so the admin UI can show "linked to challenge".
    relatedChallenge: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('Notification', notificationSchema);
