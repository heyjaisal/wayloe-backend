import { Router } from 'express';
import { getMessages, sendMessage } from './messages.controller.js';
import { protect } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { sendMessageSchema, getMessagesSchema } from './messages.schema.js';
import { objectIdParamSchema } from '../../shared/schemas/common.js';

const router = Router();

router.get('/:groupId', protect, validate(objectIdParamSchema, 'params'), validate(getMessagesSchema, 'query'), getMessages);
router.post('/:groupId', protect, validate(objectIdParamSchema, 'params'), validate(sendMessageSchema), sendMessage);

export default router;
