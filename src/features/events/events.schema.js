import { z } from 'zod';

const eventCategories = ['social', 'outdoor', 'music', 'food', 'sports', 'cultural', 'other'];
const eventStatuses = ['upcoming', 'ongoing', 'completed', 'cancelled'];

export const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200).trim(),
  description: z.string().max(2000).trim().optional(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  address: z.string().max(500).trim().optional(),
  coverImage: z.string().url().optional(),
  category: z.enum(eventCategories).optional(),
  startDate: z.coerce.date().refine(date => date > new Date(), 'Start date must be in the future'),
  endDate: z.coerce.date(),
  maxAttendees: z.coerce.number().int().positive().optional(),
  visibility: z.enum(['public', 'friends', 'private']).optional(),
  joinPolicy: z.enum(['auto', 'approval']).optional(),
  tags: z.array(z.string()).optional(),
  groupId: z.string().optional(),
  settings: z.object({
    chatEnabled: z.boolean().optional(),
    liveLocationEnabled: z.boolean().optional(),
    checkInEnabled: z.boolean().optional(),
    checkInRadius: z.coerce.number().min(10).max(5000).optional(),
  }).optional(),
}).refine(data => data.endDate > data.startDate, {
  message: 'End date must be after start date',
  path: ['endDate'],
});

export const updateEventSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2000).trim().optional(),
  address: z.string().max(500).trim().optional(),
  coverImage: z.string().url().optional(),
  category: z.enum(eventCategories).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  maxAttendees: z.coerce.number().int().positive().nullable().optional(),
  visibility: z.enum(['public', 'friends', 'private']).optional(),
  joinPolicy: z.enum(['auto', 'approval']).optional(),
  tags: z.array(z.string()).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  settings: z.object({
    chatEnabled: z.boolean().optional(),
    liveLocationEnabled: z.boolean().optional(),
    checkInEnabled: z.boolean().optional(),
    checkInRadius: z.coerce.number().min(10).max(5000).optional(),
  }).optional(),
});

export const updateEventStatusSchema = z.object({
  eventStatus: z.enum(eventStatuses),
});

export const checkInSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export const approveRejectSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  reason: z.string().max(500).trim().optional(),
});

export const removeAttendeeSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
});

export const updateEventSettingsSchema = z.object({
  chatEnabled: z.boolean().optional(),
  liveLocationEnabled: z.boolean().optional(),
  checkInEnabled: z.boolean().optional(),
  checkInRadius: z.coerce.number().min(10).max(5000).optional(),
});

export const getEventsSchema = z.object({
  groupId: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().positive().optional(),
  status: z.enum(eventStatuses).optional(),
  category: z.enum(eventCategories).optional(),
  myEvents: z.coerce.boolean().optional(),
});

export const eventMessageSchema = z.object({
  text: z.string().min(1, 'Message text is required').max(2000).trim(),
  type: z.enum(['text', 'announcement']).optional(),
});

export const getEventMessagesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const getAttendeesSchema = z.object({
  status: z.string().optional(),
});
