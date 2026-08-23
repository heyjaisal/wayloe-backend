import { Router } from 'express';
import {
  getSellers, searchSellers, getNearbySellers, getRoute,
  updateUserLocation, updateSellerLocation,
  getFavorites, addFavorite, deleteFavorite,
} from './map.controller.js';
import { protect, authorize } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import {
  getSellersSchema, searchSellersSchema, nearbySellersSchema, routeSchema,
  updateLocationSchema, sellerLocationBodySchema,
  getFavoritesSchema, addFavoriteSchema,
} from './map.schema.js';
import { objectIdParamSchema } from '../../shared/schemas/common.js';

const router = Router();

router.get('/sellers', validate(getSellersSchema, 'query'), getSellers);
router.get('/search', validate(searchSellersSchema, 'query'), searchSellers);
router.get('/nearby', validate(nearbySellersSchema, 'query'), getNearbySellers);
router.get('/route', validate(routeSchema, 'query'), getRoute);

router.post('/location', protect, validate(updateLocationSchema), updateUserLocation);
router.get('/favorites', protect, validate(getFavoritesSchema, 'query'), getFavorites);
router.post('/favorites', protect, validate(addFavoriteSchema), addFavorite);
router.delete('/favorites/:id', protect, validate(objectIdParamSchema, 'params'), deleteFavorite);

router.patch('/seller-location', protect, authorize('admin'), validate(sellerLocationBodySchema), updateSellerLocation);

export default router;
