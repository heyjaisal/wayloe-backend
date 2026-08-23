import { z } from 'zod';

const coordinateSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

const locationBodySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().optional(),
  heading: z.coerce.number().min(0).max(360).optional(),
  speed: z.coerce.number().optional(),
  altitude: z.coerce.number().optional(),
  userType: z.enum(['customer', 'seller', 'rider']).default('customer'),
});

const favoriteBodySchema = z.object({
  name: z.string().min(1).max(100).trim(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  address: z.string().max(500).trim().optional(),
  icon: z.string().optional(),
  image: z.string().url().optional(),
  groupId: z.string().optional(),
});

const sellerLocationSchema = z.object({
  sellerId: z.string(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export const getSellersSchema = z.object({
  category: z.enum(['organic', 'nursery', 'seeds', 'plants', 'tools', 'fertilizers']).optional(),
  openNow: z.coerce.boolean().optional(),
  delivery: z.coerce.boolean().optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  maxDistance: z.coerce.number().positive().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
}).refine(
  (data) => (data.lat && data.lng) || (!data.lat && !data.lng),
  { message: 'Both lat and lng are required' }
);

export const searchSellersSchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  category: z.enum(['organic', 'nursery', 'seeds', 'plants', 'tools', 'fertilizers']).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  maxDistance: z.coerce.number().positive().default(50),
});

export const nearbySellersSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  maxDistance: z.coerce.number().positive().default(10),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const routeSchema = z.object({
  startLat: z.coerce.number().min(-90).max(90),
  startLng: z.coerce.number().min(-180).max(180),
  endLat: z.coerce.number().min(-90).max(90),
  endLng: z.coerce.number().min(-180).max(180),
  profile: z.enum(['driving', 'walking', 'cycling']).default('driving'),
});

export const updateLocationSchema = locationBodySchema;

export const sellerLocationBodySchema = sellerLocationSchema;

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
