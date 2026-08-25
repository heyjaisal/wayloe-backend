import * as mapService from '../services/map.service.js';

export const getFavorites = async (req, res) => {
  const result = await mapService.getFavorites(req.user._id, req.query);
  res.json({ success: true, ...result });
};

export const addFavorite = async (req, res) => {
  const data = await mapService.addFavorite(req.user._id, req.body);
  res.status(201).json({ success: true, data });
};

export const deleteFavorite = async (req, res) => {
  await mapService.deleteFavorite(req.user._id, req.params.id);
  res.json({ success: true, message: 'Favorite deleted successfully' });
};
