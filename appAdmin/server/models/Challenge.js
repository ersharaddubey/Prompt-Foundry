import mongoose from 'mongoose';

const challengeSchema = new mongoose.Schema(
  {
    theme: { type: String, required: true },
    description: { type: String, default: '' },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    entries: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        imageUrl: String,
        prompt: String,
        votes: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model('Challenge', challengeSchema);
