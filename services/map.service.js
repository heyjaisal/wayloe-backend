import FavoritePlace from '../models/FavoritePlace.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

export const getFavorites = async (userId, { groupId, lat, lng, maxDistance, limit }) => {
  let scope = {};

  if (groupId) {
    scope.groupId = groupId;
  } else {
    scope.userId = userId;
    scope.groupId = null;
  }

  if (lat && lng) {
    const radiusMeters = maxDistance * 1000;

    const favorites = await FavoritePlace.aggregate([
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

    return {
      data: favorites,
      nearby: true,
      center: { lat, lng },
      maxDistance,
    };
  }

  const favorites = await FavoritePlace.find(scope).sort({ createdAt: -1 });
  return { data: favorites };
};

export const addFavorite = async (userId, favoriteData) => {
  const { name, description, latitude, longitude, address, icon, image, images, groupId } = favoriteData;

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

  return favorite;
};

export const deleteFavorite = async (userId, favoriteId) => {
  const favoriteToDelete = await FavoritePlace.findOne({ _id: favoriteId });
  if (!favoriteToDelete) {
    throw new AppError('Favorite not found', 404);
  }

  const isOwner = favoriteToDelete.userId.toString() === userId.toString();

  if (!isOwner) {
    throw new AppError('Not authorized to delete this favorite', 403);
  }

  await FavoritePlace.findByIdAndDelete(favoriteId);
};
