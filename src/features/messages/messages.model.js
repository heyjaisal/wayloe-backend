import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  senderName: {
    type: String,
    required: true,
  },
  senderImage: {
    type: String,
    default: null,
  },
  type: {
    type: String,
    enum: ['text', 'image', 'favorite'],
    default: 'text',
  },
  text: {
    type: String,
    trim: true,
  },
  imageUrl: {
    type: String,
    trim: true,
  },
  favorite: {
    name: String,
    address: String,
    latitude: Number,
    longitude: Number,
    image: String,
  },
}, {
  timestamps: true,
});

messageSchema.index({ groupId: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);
