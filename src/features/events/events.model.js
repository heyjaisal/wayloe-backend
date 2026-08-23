import mongoose from 'mongoose';

const eventAttendeeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  profileImage: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'joined', 'checked-in', 'cancelled'],
    default: 'joined',
  },
  requestedAt: { type: Date, default: Date.now },
  joinedAt: { type: Date, default: null },
  approvedAt: { type: Date, default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  rejectedAt: { type: Date, default: null },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  rejectionReason: { type: String, trim: true, maxlength: 500, default: null },
  checkedInAt: { type: Date, default: null },
  checkedInLocation: {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number] },
  },
}, { _id: false });

const eventSettingsSchema = new mongoose.Schema({
  chatEnabled: { type: Boolean, default: true },
  liveLocationEnabled: { type: Boolean, default: false },
  checkInEnabled: { type: Boolean, default: true },
  checkInRadius: {
    type: Number,
    default: 100,
    min: [10, 'Check-in radius must be at least 10m'],
    max: [5000, 'Check-in radius cannot exceed 5000m'],
  },
}, { _id: false });

const eventSchema = new mongoose.Schema({
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  creatorName: { type: String, required: true },
  creatorImage: { type: String, default: null },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
    default: '',
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: [true, 'Coordinates are required'],
      validate: {
        validator: function(coords) {
          return coords.length === 2 &&
                 coords[0] >= -180 && coords[0] <= 180 &&
                 coords[1] >= -90 && coords[1] <= 90;
        },
        message: 'Invalid coordinates',
      },
    },
  },
  address: { type: String, trim: true, default: '' },
  coverImage: { type: String, trim: true, default: null },
  category: {
    type: String,
    enum: ['social', 'outdoor', 'music', 'food', 'sports', 'cultural', 'other'],
    default: 'other',
  },
  startDate: { type: Date, required: [true, 'Start date is required'] },
  endDate: { type: Date, required: [true, 'End date is required'] },
  maxAttendees: {
    type: Number,
    min: [1, 'Max attendees must be at least 1'],
    default: null,
  },
  visibility: {
    type: String,
    enum: ['public', 'friends', 'private'],
    default: 'public',
  },
  joinPolicy: {
    type: String,
    enum: ['auto', 'approval'],
    default: 'auto',
  },
  eventStatus: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
    default: 'upcoming',
  },
  tags: { type: [String], default: [] },
  attendees: { type: [eventAttendeeSchema], default: [] },
  settings: { type: eventSettingsSchema, default: () => ({}) },
  attendeeCount: { type: Number, default: 0, min: 0 },
  checkedInCount: { type: Number, default: 0, min: 0 },
  pendingCount: { type: Number, default: 0, min: 0 },
  rejectedCount: { type: Number, default: 0, min: 0 },
}, {
  timestamps: true,
});

eventSchema.index({ creator: 1, createdAt: -1 });
eventSchema.index({ groupId: 1, createdAt: -1 });
eventSchema.index({ location: '2dsphere' });
eventSchema.index({ startDate: 1 });
eventSchema.index({ visibility: 1, startDate: 1 });
eventSchema.index({ eventStatus: 1, startDate: 1 });
eventSchema.index({ eventStatus: 1, visibility: 1, startDate: 1 });
eventSchema.index({ 'attendees.userId': 1 });
eventSchema.index({ category: 1, startDate: 1 });

eventSchema.methods.computeStatus = function() {
  const now = new Date();
  if (this.eventStatus === 'cancelled') return 'cancelled';
  if (now < this.startDate) return 'upcoming';
  if (now >= this.startDate && now <= this.endDate) return 'ongoing';
  return 'completed';
};

eventSchema.methods.recount = function() {
  this.attendeeCount = this.attendees.filter(
    a => ['joined', 'approved', 'checked-in'].includes(a.status)
  ).length;
  this.checkedInCount = this.attendees.filter(a => a.status === 'checked-in').length;
  this.pendingCount = this.attendees.filter(a => a.status === 'pending').length;
  this.rejectedCount = this.attendees.filter(a => a.status === 'rejected').length;
};

eventSchema.methods.findAttendee = function(userId) {
  return this.attendees.find(a => a.userId.toString() === userId.toString());
};

eventSchema.methods.isUserAttending = function(userId) {
  const attendee = this.findAttendee(userId);
  return attendee && ['joined', 'approved', 'checked-in'].includes(attendee.status);
};

eventSchema.methods.hasCapacity = function() {
  if (!this.maxAttendees) return true;
  return this.attendeeCount < this.maxAttendees;
};

eventSchema.pre('validate', function(next) {
  if (this.eventStatus !== 'cancelled') {
    this.eventStatus = this.computeStatus();
  }
  this.recount();
  next();
});

export default mongoose.model('Event', eventSchema);
