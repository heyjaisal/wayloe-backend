import mongoose from 'mongoose';
import { z } from 'zod';

export const createGroupSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  profileImage: z.string().url().optional(),
});

export const joinGroupSchema = z.object({
  inviteCode: z.string().length(6).trim(),
});

export const groupIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid group ID format'),
});

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
    default: '',
  },
  profileImage: {
    type: String,
    default: null,
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
    index: true,
  },
}, {
  timestamps: true,
});

groupSchema.index({ createdBy: 1, createdAt: -1 });
groupSchema.index({ members: 1 });

groupSchema.pre('save', function() {
  if (this.isNew) {
    if (!this.inviteCode) {
      this.inviteCode = this._generateInviteCode();
    }
    if (this.createdBy) {
      const createdByStr = this.createdBy.toString();
      const isMember = this.members.some((m) => m && m.toString() === createdByStr);
      if (!isMember) {
        this.members.push(this.createdBy);
      }
    }
  }
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
