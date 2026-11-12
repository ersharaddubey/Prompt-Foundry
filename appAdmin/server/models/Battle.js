import mongoose from 'mongoose';

const battleSchema = new mongoose.Schema(
  {
    promptA: { type: String, required: true },
    promptB: { type: String, required: true },
    imageA: { type: String, required: true },
    imageB: { type: String, required: true },
    votesA: { type: Number, default: 0 },
    votesB: { type: Number, default: 0 },
    voters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Battle', battleSchema);
