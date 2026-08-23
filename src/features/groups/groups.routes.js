import { Router } from 'express';
import {
  createGroup, joinGroup, getUserGroups,
  getGroupById, leaveGroup, deleteGroup,
} from './groups.controller.js';
import { protect } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { createGroupSchema, joinGroupSchema } from './groups.schema.js';
import { objectIdParamSchema } from '../../shared/schemas/common.js';

const router = Router();

router.route('/')
  .get(protect, getUserGroups)
  .post(protect, validate(createGroupSchema), createGroup);

router.post('/join', protect, validate(joinGroupSchema), joinGroup);

router.route('/:id')
  .get(protect, validate(objectIdParamSchema, 'params'), getGroupById)
  .delete(protect, validate(objectIdParamSchema, 'params'), deleteGroup);

router.delete('/:id/leave', protect, validate(objectIdParamSchema, 'params'), leaveGroup);

export default router;
