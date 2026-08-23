import mongoose from 'mongoose';

const userLocationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  userType: {
    type: String,
    enum: ['customer', 'seller', 'rider'],
    required: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function(v) {
          return v.length === 2 &&
                 v[0] >= -180 && v[0] <= 180 &&
                 v[1] >= -90 && v[1] <= 90;
        },
        message: 'Invalid coordinates',
      },
    },
  },
  accuracy: {
    type: Number,
    default: 0,
  },
  heading: {
    type: Number,
    min: 0,
    max: 360,
  },
  speed: {
    type: Number,
    default: 0,
  },
  altitude: {
    type: Number,
  },
}, {
  timestamps: true,
});

userLocationSchema.index({ userId: 1, userType: 1, updatedAt: -1 });
userLocationSchema.index({ location: '2dsphere' });
userLocationSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model('UserLocation', userLocationSchema);
