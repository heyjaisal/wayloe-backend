import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  inviteCode: {
    type: String,
    unique: true,
  },
  isPublic: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

groupSchema.index({ createdBy: 1, createdAt: -1 });
groupSchema.index({ members: 1 });

groupSchema.pre('save', function(next) {
  if (this.isNew) {
    this.inviteCode = this._generateInviteCode();
  }
  next();
});

groupSchema.methods._generateInviteCode = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export default mongoose.model('Group', groupSchema);
