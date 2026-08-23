import { Router } from 'express';
import {
  getEvents, getEventById, createEvent, updateEvent, deleteEvent,
  updateEventStatus, joinEvent, leaveEvent, cancelJoinRequest,
  removeAttendee, approveJoinRequest, rejectJoinRequest,
  checkIn, getEventAttendees, getPendingRequests,
  updateEventSettings, getEventMessages, sendEventMessage, markMessagesRead,
} from './events.controller.js';
import { protect } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import {
  getEventsSchema, createEventSchema, updateEventSchema,
  updateEventStatusSchema, checkInSchema,
  approveRejectSchema, removeAttendeeSchema,
  updateEventSettingsSchema, eventMessageSchema,
} from './events.schema.js';
import { eventObjectIdParamSchema, eventIdParamSchema } from '../../shared/schemas/common.js';

const router = Router();

router.get('/', protect, validate(getEventsSchema, 'query'), getEvents);
router.get('/:id', protect, validate(eventObjectIdParamSchema, 'params'), getEventById);
router.post('/', protect, validate(createEventSchema), createEvent);
router.put('/:id', protect, validate(eventObjectIdParamSchema, 'params'), validate(updateEventSchema), updateEvent);
router.delete('/:id', protect, validate(eventObjectIdParamSchema, 'params'), deleteEvent);

router.put('/:id/status', protect, validate(eventObjectIdParamSchema, 'params'), validate(updateEventStatusSchema), updateEventStatus);

router.post('/:id/join', protect, validate(eventObjectIdParamSchema, 'params'), joinEvent);
router.post('/:id/leave', protect, validate(eventObjectIdParamSchema, 'params'), leaveEvent);
router.post('/:id/cancel', protect, validate(eventObjectIdParamSchema, 'params'), cancelJoinRequest);

router.post('/:id/remove', protect, validate(eventObjectIdParamSchema, 'params'), validate(removeAttendeeSchema), removeAttendee);

router.post('/:id/approve', protect, validate(eventObjectIdParamSchema, 'params'), validate(approveRejectSchema), approveJoinRequest);
router.post('/:id/reject', protect, validate(eventObjectIdParamSchema, 'params'), validate(approveRejectSchema), rejectJoinRequest);

router.post('/:id/checkin', protect, validate(eventObjectIdParamSchema, 'params'), validate(checkInSchema), checkIn);

router.get('/:id/attendees', protect, validate(eventObjectIdParamSchema, 'params'), getEventAttendees);
router.get('/:id/pending', protect, validate(eventObjectIdParamSchema, 'params'), getPendingRequests);

router.put('/:id/settings', protect, validate(eventObjectIdParamSchema, 'params'), validate(updateEventSettingsSchema), updateEventSettings);

router.get('/:eventId/messages', protect, validate(eventIdParamSchema, 'params'), getEventMessages);
router.post('/:eventId/messages', protect, validate(eventIdParamSchema, 'params'), validate(eventMessageSchema), sendEventMessage);
router.post('/:eventId/read', protect, validate(eventIdParamSchema, 'params'), markMessagesRead);

export default router;
