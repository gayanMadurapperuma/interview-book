import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const chapters = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content' }),
  schema: z.object({
    title: z.string(),
    part: z.string(),
    order: z.number(),
    summary: z.string(),
    level: z.enum(['foundation', 'core', 'advanced']).default('core'),
    demo: z.string().optional(),
  }),
});

export const collections = { chapters };
