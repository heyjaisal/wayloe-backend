import Seller from './map-seller.model.js';
import UserLocation from './map-location.model.js';
import FavoritePlace from './map-favorite.model.js';
import Group from '../groups/groups.model.js';
import { AppError } from '../../shared/middleware/errorHandler.js';
import logger from '../../shared/utils/logger.js';

export const getSellers = async (filters) => {
  const { category, openNow, delivery, rating, minRating, maxDistance, lat, lng, page, limit } = filters;

  const query = { isActive: true };

  if (category) query.category = category;
  if (openNow) query.openStatus = true;
  if (delivery) query.deliveryAvailable = true;
  if (rating) query.rating = { $gte: rating };
  if (minRating) query.rating = { $gte: minRating };

  if (lat && lng) {
    query.location = {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: (maxDistance || 50) * 1000,
      },
    };
  }

  const skip = (page - 1) * limit;
  const sellers = await Seller.find(query).skip(skip).limit(limit).sort({ rating: -1 });

  let sellersWithDistance = sellers;
  if (lat && lng) {
    sellersWithDistance = sellers.map(seller => {
      const obj = seller.toObject();
      obj.distance = seller.getDistanceFrom([lng, lat]);
      return obj;
    });
  }

  const total = await Seller.countDocuments(query);

  return {
    data: sellersWithDistance,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const searchSellers = async ({ q, category, lat, lng, maxDistance }) => {
  const safeQ = escapeRegex(q);

  const query = {
    isActive: true,
    $or: [
      { name: { $regex: safeQ, $options: 'i' } },
      { 'address.street': { $regex: safeQ, $options: 'i' } },
      { 'address.city': { $regex: safeQ, $options: 'i' } },
      { 'address.pincode': { $regex: safeQ, $options: 'i' } },
      { category: { $regex: safeQ, $options: 'i' } },
    ],
  };

  if (category) query.category = category;

  let sellers = await Seller.find(query).limit(50);

  if (lat && lng) {
    sellers = sellers
      .map(seller => {
        const obj = seller.toObject();
        obj.distance = seller.getDistanceFrom([lng, lat]);
        return obj;
      })
      .filter(seller => seller.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance);
  }

  return { data: sellers, total: sellers.length };
};

export const getNearbySellers = async ({ lat, lng, maxDistance, limit }) => {
  const sellers = await Seller.findNearby([lng, lat], maxDistance).limit(limit);

  const sellersWithDistance = sellers
    .map(seller => {
      const obj = seller.toObject();
      obj.distance = seller.getDistanceFrom([lng, lat]);
      return obj;
    })
    .sort((a, b) => a.distance - b.distance);

  return { data: sellersWithDistance, total: sellersWithDistance.length };
};

export const getRoute = async ({ startLat, startLng, endLat, endLng, profile }) => {
  const osrmUrl = `https://router.project-osrm.org/route/v1/${profile}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  let response;
  try {
    response = await fetch(osrmUrl, { signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new AppError('Route calculation timed out', 504);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json();

  if (data.code !== 'Ok') {
    throw new AppError('Could not calculate route', 400);
  }

  const route = data.routes[0];

  return {
    distance: route.distance,
    duration: route.duration,
    geometry: route.geometry.coordinates,
    steps: route.legs[0].steps.map(step => ({
      instruction: step.maneuver.type.replace(/_/g, ' '),
      distance: step.distance,
      duration: step.duration,
      maneuver: step.maneuver.modifier,
    })),
  };
};

export const updateUserLocation = async (userId, locationData) => {
  const { latitude, longitude, accuracy, heading, speed, altitude, userType } = locationData;

  return UserLocation.findOneAndUpdate(
    { userId, userType },
    {
      userId,
      userType,
      location: { type: 'Point', coordinates: [longitude, latitude] },
      accuracy,
      heading,
      speed,
      altitude,
    },
    { upsert: true, new: true }
  );
};

export const updateSellerLocation = async (sellerId, { latitude, longitude }) => {
  const seller = await Seller.findByIdAndUpdate(
    sellerId,
    { location: { type: 'Point', coordinates: [longitude, latitude] } },
    { new: true }
  );

  if (!seller) {
    throw new AppError('Seller not found', 404);
  }

  return seller;
};

export const getFavorites = async (userId, { groupId, lat, lng, maxDistance, limit }) => {
  let scope = {};

  if (groupId) {
    const group = await Group.findById(groupId);
    if (!group) throw new AppError('Group not found', 404);

    const isMember = group.createdBy.toString() === userId.toString() ||
      group.members.some(m => m.toString() === userId.toString());

    if (!isMember) throw new AppError('You are not a member of this group', 403);

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

export const addFavorite = async (userId, favoriteData, io) => {
  const { name, latitude, longitude, address, icon, image, groupId } = favoriteData;

  const favorite = await FavoritePlace.create({
    userId,
    groupId: groupId || null,
    name,
    location: { type: 'Point', coordinates: [longitude, latitude] },
    address,
    icon,
    image,
  });

  if (groupId && io) {
    io.to(`group-${groupId}`).emit('favorite-added', { favorite, addedBy: userId });
  }

  logger.info({ favoriteId: favorite._id, userId }, 'Favorite added');

  return favorite;
};

export const deleteFavorite = async (userId, favoriteId, io) => {
  const favoriteToDelete = await FavoritePlace.findOne({ _id: favoriteId });
  if (!favoriteToDelete) {
    throw new AppError('Favorite not found', 404);
  }

  const isOwner = favoriteToDelete.userId.toString() === userId.toString();

  if (!isOwner) {
    if (favoriteToDelete.groupId) {
      const group = await Group.findById(favoriteToDelete.groupId);
      const isMember = group && (
        group.createdBy.toString() === userId.toString() ||
        group.members.some(m => m.toString() === userId.toString())
      );
      if (!isMember) throw new AppError('Not authorized to delete this favorite', 403);
    } else {
      throw new AppError('Not authorized to delete this favorite', 403);
    }
  }

  const groupId = favoriteToDelete.groupId;
  await FavoritePlace.findByIdAndDelete(favoriteId);

  if (groupId && io) {
    io.to(`group-${groupId}`).emit('favorite-deleted', { favoriteId, deletedBy: userId });
  }
};
