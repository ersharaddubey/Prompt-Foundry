import mongoose from 'mongoose';

const generatedImageSchema = new mongoose.Schema(
  {
    promptHash: {
      type: String,
      required: true,
      index: true,
    },
    promptText: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      required: true, // Cloudinary URL
    },
    cloudinaryPublicId: {
      type: String,
    },
    model: {
      type: String,
      default: 'flux',
    },
    ratio: {
      type: String,
      default: '3:4',
    },
    sourceImageUrl: {
      type: String, // if user uploaded a reference image
      default: null,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isCached: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound index for fast cache lookup
generatedImageSchema.index({ promptHash: 1, model: 1, ratio: 1 });

export default mongoose.model('GeneratedImage', generatedImageSchema);
