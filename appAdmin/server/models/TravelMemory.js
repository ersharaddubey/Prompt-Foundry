import mongoose from 'mongoose';

const travelMemorySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: '', maxlength: 2000 },
  imageUrl: { type: String, required: true },
  imageFileId: { type: String, default: '' },
  externalLink: { type: String, default: '', trim: true },
  locationName: { type: String, required: true, trim: true },
  city: { type: String, default: '', trim: true },
  country: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  tags: [{ type: String, trim: true }],
  visibility: { type: String, enum: ['public', 'private'], default: 'public' },
  ownershipConfirmed: { type: Boolean, default: false },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'removed'], default: 'pending', index: true },
  moderationNote: { type: String, default: '' },
  likeCount: { type: Number, default: 0 },
  aiCreationCount: { type: Number, default: 0 },
}, { timestamps: true });

travelMemorySchema.index({ status: 1, visibility: 1, createdAt: -1 });
travelMemorySchema.index({ title: 'text', description: 'text', locationName: 'text', city: 'text', country: 'text', tags: 'text' });

export default mongoose.models.TravelMemory || mongoose.model('TravelMemory', travelMemorySchema);
