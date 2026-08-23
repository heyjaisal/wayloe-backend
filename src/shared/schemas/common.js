import { z } from 'zod';

export const objectIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format'),
});

export const eventObjectIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid event ID format'),
});

export const eventIdParamSchema = z.object({
  eventId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid event ID format'),
});
