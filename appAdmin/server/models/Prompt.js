import mongoose from 'mongoose';

const promptSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    promptText: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      default: 'Social Buzz',
      trim: true,
    },
    author: {
      name: String,
      username: String,
      avatar: String,
    },
    likes: {
      type: Number,
      default: 0,
    },
    uses: {
      type: Number,
      default: 0,
    },
    tags: [String],
    isFeatured: {
      type: Boolean,
      default: false,
    },
    aspectRatio: {
      type: String,
      default: '3:4',
    },
  },
  { timestamps: true }
);

export default mongoose.model('Prompt', promptSchema);
