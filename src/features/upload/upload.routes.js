import { Router } from 'express';
import { generateSignedUrl } from './upload.controller.js';
import { protect } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { uploadSignUrlSchema } from '../map/map.schema.js';

const router = Router();

router.post('/sign-url', protect, validate(uploadSignUrlSchema), generateSignedUrl);

export default router;
