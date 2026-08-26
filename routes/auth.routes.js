import { Router } from 'express';
import { register, login, refresh, logout, updateProfile, me, checkUsername } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, updateProfileSchema } from '../models/User.js';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', protect, me);
router.get('/check-username', protect, checkUsername);
router.put('/profile', protect, validate(updateProfileSchema), updateProfile);

export default router;
