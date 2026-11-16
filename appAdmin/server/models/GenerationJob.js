import mongoose from 'mongoose';

const generationJobSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  providerRequestId: { type: String, required: true, index: true },
  promptText: { type: String, required: true },
  ratio: { type: String, default: '3:4' },
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending', index: true },
  imageUrl: { type: String, default: '' },
  error: { type: String, default: '' },
}, { timestamps: true });

generationJobSchema.index({ user: 1, createdAt: -1 });
export default mongoose.model('GenerationJob', generationJobSchema);
