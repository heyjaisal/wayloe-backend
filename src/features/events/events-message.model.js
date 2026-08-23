import mongoose from 'mongoose';

const eventMessageSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
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
    enum: ['text', 'image', 'system', 'announcement'],
    default: 'text',
  },
  text: {
    type: String,
    required: true,
    trim: true,
  },
  imageUrl: {
    type: String,
    default: null,
  },
  systemEvent: {
    type: String,
    enum: {
      values: [
        'event-created', 'event-updated', 'event-cancelled',
        'member-joined', 'member-left', 'member-approved',
        'member-rejected', 'member-checked-in',
      ],
      message: 'systemEvent `{VALUE}` is not valid',
    },
    required: false,
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
}, {
  timestamps: true,
});

eventMessageSchema.index({ eventId: 1, createdAt: -1 });
eventMessageSchema.index({ eventId: 1, type: 1, createdAt: -1 });

export default mongoose.model('EventMessage', eventMessageSchema);
