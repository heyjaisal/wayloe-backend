import { Router } from 'express';
import { getMessages, sendMessage } from '../controllers/message.controller.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.get('/:groupId', protect, getMessages);
router.post('/:groupId', protect, sendMessage);

export default router;
