import mongoose from 'mongoose';
import { z } from 'zod';

export const objectIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format'),
});

const addressObjectSchema = z.object({
  display: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  neighbourhood: z.string().optional().nullable(),
  locality: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  countryCode: z.string().optional().nullable(),
}).optional().nullable();

const favoriteBodySchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(1000).trim().optional(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  address: addressObjectSchema,
  icon: z.string().optional(),
  image: z.string().trim().optional(),
  images: z.array(z.string().trim()).optional(),
  groupId: z.string().optional(),
});

export const getFavoritesSchema = z.object({
  groupId: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  maxDistance: z.coerce.number().positive().default(10),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const addFavoriteSchema = favoriteBodySchema;

export const uploadSignUrlSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.enum(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']),
  context: z.enum(['event', 'favorite', 'group-favorite', 'profile']),
  groupId: z.string().optional(),
}).refine(
  (data) => {
    if (data.context === 'group-favorite') return !!data.groupId;
    return true;
  },
  { message: 'groupId is required for group-favorite uploads' }
);

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
  description: {
    type: String,
    trim: true,
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
        validator: function (coords) {
          return (
            coords.length === 2 &&
            coords[0] >= -180 && coords[0] <= 180 &&
            coords[1] >= -90 && coords[1] <= 90
          );
        },
        message: 'Invalid coordinates',
      },
    },
  },
  address: {
    display: { type: String, default: null },
    street: { type: String, default: null },
    neighbourhood: { type: String, default: null },
    locality: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    postalCode: { type: String, default: null },
    country: { type: String, default: null },
    countryCode: { type: String, default: null },
  },
  icon: {
    type: String,
    default: 'home',
  },
  image: {
    type: String,
    trim: true,
  },
  images: {
    type: [String],
    default: [],
  },
}, {
  timestamps: true,
});

favoritePlaceSchema.index({ userId: 1, createdAt: -1 });
favoritePlaceSchema.index({ groupId: 1, createdAt: -1 });
favoritePlaceSchema.index({ location: '2dsphere' });

export default mongoose.model('FavoritePlace', favoritePlaceSchema);
