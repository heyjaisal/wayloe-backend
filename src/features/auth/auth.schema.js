import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(100, 'Password must be at most 100 characters');

const emailSchema = z
  .string()
  .email('Invalid email address')
  .toLowerCase()
  .trim();

const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(50, 'Name must be at most 50 characters')
  .trim();

export const registerSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  profileImage: z.string().url('Invalid URL').optional(),
});
