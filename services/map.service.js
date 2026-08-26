import FavoritePlace from '../models/FavoritePlace.js';
import Group from '../models/Group.js';
import { generateSignedGetUrl } from './upload.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { publishFavoriteCreated, publishFavoriteDeleted } from './realtime.service.js';
import logger from '../utils/logger.js';

async function resolveImageUrls(urls) {
  if (!urls || urls.length === 0) return urls;

  return Promise.all(
    urls.map(async (url) => {
      if (!url) return url;
      try {
        const { signedUrl } = await generateSignedGetUrl(url);
        return signedUrl;
      } catch (err) {
        logger.error({ err, url }, 'Failed to generate signed GET URL for favorite image');
        return url;
      }
    })
  );
}

async function resolveFavoriteImages(favorite) {
  const obj = typeof favorite.toObject === 'function' ? favorite.toObject() : { ...favorite };

  if (Array.isArray(obj.images) && obj.images.length > 0) {
    const validUrls = obj.images.filter(Boolean);
    obj.images = await resolveImageUrls(validUrls);
    obj.image = obj.images[0] || obj.image;
  } else if (obj.image) {
    const [resolved] = await resolveImageUrls([obj.image]);
    obj.image = resolved;
    obj.images = [resolved];
  } else {
    obj.images = [];
  }

  return obj;
}

export const getFavorites = async (userId, { groupId, lat, lng, maxDistance, limit }) => {
  let scope = {};

  if (groupId) {
    const group = await Group.findById(groupId);
    if (!group) {
      throw new AppError('Group not found', 404);
    }
    const isMember = group.members.some((m) => m.toString() === userId.toString());
    if (!isMember) {
      throw new AppError('You are not a member of this group', 403);
    }
    scope.groupId = groupId;
  } else {
    scope.userId = userId;
    scope.groupId = null;
  }

  let favorites;

  if (lat && lng) {
    const radiusMeters = maxDistance * 1000;

    const rawFavorites = await FavoritePlace.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distance',
          maxDistance: radiusMeters,
          spherical: true,
          query: scope,
        },
      },
      { $limit: limit },
    ]);

    favorites = await Promise.all(rawFavorites.map(resolveFavoriteImages));

    return {
      data: favorites,
      nearby: true,
      center: { lat, lng },
      maxDistance,
    };
  }

  const rawFavorites = await FavoritePlace.find(scope).sort({ createdAt: -1 });
  favorites = await Promise.all(rawFavorites.map(resolveFavoriteImages));
  return { data: favorites };
};

export const addFavorite = async (userId, favoriteData) => {
  const { name, description, latitude, longitude, address, icon, image, images, groupId } = favoriteData;

  // Security: verify the authenticated user is a member of the group before creating a group favorite.
  // Personal favorites (groupId null/undefined) skip this check — unchanged behavior.
  if (groupId) {
    const group = await Group.findById(groupId);
    if (!group) {
      throw new AppError('Group not found', 404);
    }
    const isMember = group.members.some((m) => m.toString() === userId.toString());
    if (!isMember) {
      throw new AppError('You are not a member of this group', 403);
    }
  }

  let finalImages = Array.isArray(images) ? images.filter(Boolean) : [];
  if (finalImages.length === 0 && image) {
    finalImages = [image];
  }
  const primaryImage = finalImages[0] || image || undefined;

  const favorite = await FavoritePlace.create({
    userId,
    groupId: groupId || null,
    name,
    description,
    location: { type: 'Point', coordinates: [longitude, latitude] },
    address: address || null,
    icon,
    image: primaryImage,
    images: finalImages,
  });

  logger.info({ favoriteId: favorite._id, userId }, 'Favorite added');

  const resolved = await resolveFavoriteImages(favorite);

  // Publish realtime event AFTER successful MongoDB write — group favorites only.
  // publishFavoriteCreated is internally wrapped in try/catch; a Socket.IO failure
  // does not affect the API response or the already-persisted MongoDB document.
  if (favorite.groupId) {
    publishFavoriteCreated(favorite.groupId, resolved);
  }

  return resolved;
};

export const deleteFavorite = async (userId, favoriteId) => {
  const favoriteToDelete = await FavoritePlace.findOne({ _id: favoriteId });
  if (!favoriteToDelete) {
    throw new AppError('Favorite not found', 404);
  }

  if (favoriteToDelete.groupId) {
    const group = await Group.findById(favoriteToDelete.groupId);
    if (!group) {
      throw new AppError('Group not found', 404);
    }
    const isMember = group.members.some((m) => m.toString() === userId.toString());
    if (!isMember) {
      throw new AppError('Not authorized to delete this favorite', 403);
    }
  } else {
    const isOwner = favoriteToDelete.userId.toString() === userId.toString();
    if (!isOwner) {
      throw new AppError('Not authorized to delete this favorite', 403);
    }
  }

  // Capture groupId BEFORE deleting — the document will be gone after findByIdAndDelete.
  const groupId = favoriteToDelete.groupId;

  await FavoritePlace.findByIdAndDelete(favoriteId);

  // Publish realtime event AFTER successful MongoDB delete — group favorites only.
  if (groupId) {
    publishFavoriteDeleted(groupId, favoriteId);
  }
};
