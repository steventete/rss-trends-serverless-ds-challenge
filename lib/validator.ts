import { z } from 'zod';
import type { RequestPayload } from '../types';

const payloadSchema = z.object({
  rssUrls: z
    .array(z.string().url({ message: 'Each rssUrls entry must be a valid URL' }))
    .min(1,  { message: 'rssUrls must contain at least one URL' })
    .max(20, { message: 'rssUrls cannot exceed 20 URLs' }),

  categories: z
    .array(z.string().min(1, { message: 'Category names cannot be empty' }))
    .min(1,  { message: 'categories must contain at least one category' })
    .max(10, { message: 'categories cannot exceed 10 entries' }),

  topN: z
    .number({ invalid_type_error: 'topN must be a number' })
    .int(   { message: 'topN must be an integer' })
    .min(1, { message: 'topN must be at least 1' })
    .max(10, { message: 'topN cannot exceed 10' })
    .default(3),
});

export function validatePayload(body: unknown): RequestPayload {
  const result = payloadSchema.safeParse(body);

  if (!result.success) {
    const messages = result.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(' | ');
    throw new Error(`Invalid payload — ${messages}`);
  }

  return result.data;
}
