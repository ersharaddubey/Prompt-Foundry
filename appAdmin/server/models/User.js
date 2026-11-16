import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: false,
      minlength: 6,
    },
    avatar: {
      type: String,
      default: '',
    },
    credits: {
      type: Number,
      default: 0, // no free credits on register
    },
    dailyCredits: {
      type: Number,
      default: 0,
    },
    lastDailyReset: {
      type: Date,
      default: Date.now,
    },
    generationLockUntil: { type: Date, default: null },
    generationUsage: {
      type: [{ jobId: String, createdAt: Date, status: { type: String, enum: ['pending', 'success', 'failed'] } }],
      default: [],
    },
    favorites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Prompt',
      },
    ],
    // Expo push tokens for this user's devices (a user can be logged in on
    // more than one phone, so we keep an array instead of a single field).
    pushTokens: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
