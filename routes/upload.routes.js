import { Router } from 'express';
import { generateSignedUrl } from '../controllers/upload.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadSignUrlSchema } from '../models/FavoritePlace.js';

const router = Router();

router.post('/sign-url', protect, validate(uploadSignUrlSchema), generateSignedUrl);

export default router;
