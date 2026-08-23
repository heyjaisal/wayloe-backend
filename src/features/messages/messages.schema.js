import { z } from 'zod';

export const sendMessageSchema = z.object({
  type: z.enum(['text', 'image', 'favorite']).default('text'),
  text: z.string().min(1, 'Message cannot be empty').max(2000).trim().optional(),
  imageUrl: z.string().url().optional(),
  favorite: z.object({
    name: z.string(),
    address: z.string().optional(),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    image: z.string().url().optional(),
  }).optional(),
}).refine(
  (data) => {
    if (data.type === 'text') return !!data.text;
    if (data.type === 'image') return !!data.imageUrl;
    if (data.type === 'favorite') return !!data.favorite;
    return false;
  },
  { message: 'Required field missing for message type' }
);

export const getMessagesSchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
