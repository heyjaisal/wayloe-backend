import mongoose from 'mongoose';

const favoritePlaceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    default: null,
  },
  name: {
    type: String,
    required: true,
    trim: true,
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
  address: {
    type: String,
    trim: true,
  },
  icon: {
    type: String,
    default: 'home',
  },
  image: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

favoritePlaceSchema.index({ userId: 1, createdAt: -1 });
favoritePlaceSchema.index({ groupId: 1, createdAt: -1 });
favoritePlaceSchema.index({ location: '2dsphere' });

export default mongoose.model('FavoritePlace', favoritePlaceSchema);
