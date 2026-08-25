import { Router } from 'express';
import { getFavorites, addFavorite, deleteFavorite } from '../controllers/map.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getFavoritesSchema, addFavoriteSchema, objectIdParamSchema } from '../models/FavoritePlace.js';

const router = Router();

router.get('/favorites', protect, validate(getFavoritesSchema, 'query'), getFavorites);
router.post('/favorites', protect, validate(addFavoriteSchema), addFavorite);
router.delete('/favorites/:id', protect, validate(objectIdParamSchema, 'params'), deleteFavorite);

export default router;
