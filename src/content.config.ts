// Register Starlight's docs collection. This is REQUIRED — without it,
// frontmatter isn't schema-validated and fields like `sidebar` come
// through undefined, which Starlight's navigation code then blows up on.
//
// Note: file is at src/content.config.ts (Astro 5 convention). For Astro 4
// it would live at src/content/config.ts.

import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    // Extend the default Starlight schema with our custom `status` field
    // used by the NeedsReview banner.
    schema: docsSchema({
      extend: z.object({
        status: z.enum(['needs-review', 'reviewed']).optional(),
      }),
    }),
  }),
};
