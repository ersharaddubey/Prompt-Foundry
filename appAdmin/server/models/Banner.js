import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, default: '', trim: true },
    imageUrl: { type: String, required: true, trim: true },
    linkUrl: { type: String, required: true, trim: true }, // click par ye website khulegi
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Banner', bannerSchema);
