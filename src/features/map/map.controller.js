import * as mapService from './map.service.js';

export const getSellers = async (req, res) => {
  const result = await mapService.getSellers(req.query);
  res.json({ success: true, ...result });
};

export const searchSellers = async (req, res) => {
  const result = await mapService.searchSellers(req.query);
  res.json({ success: true, ...result });
};

export const getNearbySellers = async (req, res) => {
  const result = await mapService.getNearbySellers(req.query);
  res.json({ success: true, ...result });
};

export const getRoute = async (req, res) => {
  const data = await mapService.getRoute(req.query);
  res.json({ success: true, data });
};

export const updateUserLocation = async (req, res) => {
  const data = await mapService.updateUserLocation(req.user.userId, req.body);
  res.json({ success: true, data });
};

export const updateSellerLocation = async (req, res) => {
  const data = await mapService.updateSellerLocation(req.body.sellerId, {
    latitude: req.body.latitude,
    longitude: req.body.longitude,
  });
  res.json({ success: true, data });
};

export const getFavorites = async (req, res) => {
  const result = await mapService.getFavorites(req.user._id, req.query);
  res.json({ success: true, ...result });
};

export const addFavorite = async (req, res) => {
  const io = req.app.get('io');
  const data = await mapService.addFavorite(req.user._id, req.body, io);
  res.status(201).json({ success: true, data });
};

export const deleteFavorite = async (req, res) => {
  const io = req.app.get('io');
  await mapService.deleteFavorite(req.user._id, req.params.id, io);
  res.json({ success: true, message: 'Favorite deleted successfully' });
};
