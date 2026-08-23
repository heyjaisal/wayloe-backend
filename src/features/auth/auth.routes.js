import { Router } from 'express';
import { register, login, refresh, logout, updateProfile, me } from './auth.controller.js';
import { protect } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { registerSchema, loginSchema, updateProfileSchema } from './auth.schema.js';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', protect, me);
router.put('/profile', protect, validate(updateProfileSchema), updateProfile);

export default router;
