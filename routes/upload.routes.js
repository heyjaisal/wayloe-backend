import { Router } from 'express';
import { generateSignedUrl, uploadImage, generateSignedGetUrl } from '../controllers/upload.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadImage as uploadMiddleware, handleMulterErrors } from '../middleware/upload.js';
import { uploadSignUrlSchema } from '../models/FavoritePlace.js';
import { z } from 'zod';

const router = Router();

router.post('/sign-url', protect, validate(uploadSignUrlSchema), generateSignedUrl);

router.post('/image', protect, uploadMiddleware.single('image'), handleMulterErrors, uploadImage);

const signedGetUrlSchema = z.object({
  url: z.string().url('Invalid URL'),
});

router.post('/signed-get-url', protect, validate(signedGetUrlSchema), generateSignedGetUrl);

export default router;
