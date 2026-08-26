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
    enum: ['text', 'image'],
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
}, {
  timestamps: true,
});

messageSchema.index({ groupId: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);
