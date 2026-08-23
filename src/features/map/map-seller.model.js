import mongoose from 'mongoose';

const sellerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  phone: {
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
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' },
  },
  logo: {
    type: String,
    default: '',
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  totalRatings: {
    type: Number,
    default: 0,
  },
  category: {
    type: String,
    enum: ['organic', 'nursery', 'seeds', 'plants', 'tools', 'fertilizers'],
    required: true,
  },
  deliveryAvailable: {
    type: Boolean,
    default: true,
  },
  openStatus: {
    type: Boolean,
    default: true,
  },
  openingHours: {
    type: String,
    default: '9:00 AM - 8:00 PM',
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

sellerSchema.index({ location: '2dsphere' });
sellerSchema.index({ category: 1, openStatus: 1 });
sellerSchema.index({ rating: -1 });
sellerSchema.index({ 'address.city': 1, 'address.pincode': 1 });

sellerSchema.virtual('fullAddress').get(function() {
  const parts = [this.address?.street, this.address?.city, this.address?.state, this.address?.pincode];
  return parts.filter(Boolean).join(', ');
});

sellerSchema.methods.getDistanceFrom = function(coordinates) {
  if (!this.location?.coordinates) return null;
  const R = 6371;
  const lat1 = this.location.coordinates[1] * Math.PI / 180;
  const lat2 = coordinates[1] * Math.PI / 180;
  const deltaLat = (coordinates[1] - this.location.coordinates[1]) * Math.PI / 180;
  const deltaLon = (coordinates[0] - this.location.coordinates[0]) * Math.PI / 180;
  const a = Math.sin(deltaLat / 2) ** 2 +
           Math.cos(lat1) * Math.cos(lat2) *
           Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

sellerSchema.statics.findNearby = function(coordinates, maxDistance = 10) {
  return this.find({
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates },
        $maxDistance: maxDistance * 1000,
      },
    },
    isActive: true,
  });
};

export default mongoose.model('Seller', sellerSchema);
