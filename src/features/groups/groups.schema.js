import { z } from 'zod';

export const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100).trim(),
  description: z.string().max(500).trim().optional(),
  isPublic: z.boolean().optional(),
});

export const joinGroupSchema = z.object({
  inviteCode: z.string().length(6, 'Invite code must be 6 characters').toUpperCase(),
});
