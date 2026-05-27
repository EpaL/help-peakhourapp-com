// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  site: 'https://help.peakhourapp.com',
  integrations: [
    starlight({
      title: 'PeakHour Help',
      description: 'Documentation, guides and troubleshooting for PeakHour 6 — professional network monitoring for macOS.',
      // Drop a logo file at src/assets/peakhour-logo.svg and uncomment:
      // logo: { src: './src/assets/peakhour-logo.svg', replacesTitle: false },
      social: {
        github: 'https://github.com/EpaL/help-peakhourapp-com',
      },
      customCss: [
        './src/styles/theme.css',
      ],
      components: {
        // Inject the "needs review" banner automatically when an article's
        // frontmatter has `status: needs-review`.
        MarkdownContent: './src/components/MarkdownContent.astro',
      },
      sidebar: [
        {
          label: 'User Guide',
          autogenerate: { directory: 'user-guide' },
        },
        {
          label: 'Troubleshooting & FAQ',
          autogenerate: { directory: 'troubleshooting' },
        },
      ],
      editLink: {
        baseUrl: 'https://github.com/EpaL/help-peakhourapp-com/edit/main/',
      },
      lastUpdated: true,
      favicon: '/favicon.ico',
    }),
  ],
});
