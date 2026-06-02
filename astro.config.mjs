// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import remarkGfm from 'remark-gfm';

// https://astro.build/config
export default defineConfig({
  site: 'https://help.peakhourapp.com',
  markdown: {
    // Astro 6 / @astrojs/mdx 5 stopped applying GFM to .mdx tables by
    // default; add it explicitly so Markdown tables render.
    remarkPlugins: [remarkGfm],
  },
  integrations: [
    starlight({
      title: 'PeakHour Help',
      description: 'Documentation, guides and troubleshooting for PeakHour 6 — professional network monitoring for macOS.',
      // Drop a logo file at src/assets/peakhour-logo.svg and uncomment:
      // logo: { src: './src/assets/peakhour-logo.svg', replacesTitle: false },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/EpaL/help-peakhourapp-com' },
      ],
      customCss: [
        './src/styles/theme.css',
      ],
      components: {
        // Inject the "needs review" banner automatically when an article's
        // frontmatter has `status: needs-review`.
        MarkdownContent: './src/components/MarkdownContent.astro',
        // Add a "Was this page helpful?" feedback block (GitHub issue + email)
        // above the default footer on every page.
        Footer: './src/components/Footer.astro',
      },
      sidebar: [
        {
          label: 'User Guide',
          items: [
            { label: 'Overview', slug: 'user-guide' },
            { slug: 'user-guide/requirements' },
            { slug: 'user-guide/first-time-setup' },
            {
              label: 'Main View',
              items: [{ autogenerate: { directory: 'user-guide/main-view' } }],
            },
            { slug: 'user-guide/history-view' },
            {
              label: 'Configuration Assistant',
              items: [
                { slug: 'user-guide/configuration-assistant' },
                { slug: 'user-guide/configuration-assistant/configuration-assistant-bandwidth' },
                { slug: 'user-guide/configuration-assistant/configuration-assistant-latency' },
              ],
            },
            {
              label: 'Settings',
              items: [
                { label: 'Overview', slug: 'user-guide/settings' },
                {
                  label: 'Monitors',
                  items: [
                    { label: 'Overview', slug: 'user-guide/settings/monitors-settings' },
                    { slug: 'user-guide/settings/monitors-settings/bandwidth-monitor' },
                    { slug: 'user-guide/settings/monitors-settings/latency-monitor' },
                  ],
                },
                { slug: 'user-guide/settings/dashboard' },
                { slug: 'user-guide/settings/display' },
                { slug: 'user-guide/settings/menu-bar' },
                { slug: 'user-guide/settings/usage' },
                { slug: 'user-guide/settings/remote' },
                { slug: 'user-guide/settings/icloud' },
                { slug: 'user-guide/settings/general' },
              ],
            },
            { slug: 'user-guide/monitor-another-mac-peakhour-enabler' },
          ],
        },
        {
          label: 'Troubleshooting & FAQ',
          items: [
            {
              label: 'Frequently Asked Questions',
              items: [
                { label: 'Overview', slug: 'troubleshooting/frequently-asked-questions-faq' },
                { slug: 'troubleshooting/frequently-asked-questions-faq/what-is-peakhour' },
                { slug: 'troubleshooting/frequently-asked-questions-faq/how-do-i-beta-test-early-release-versions-of-peakhour' },
                {
                  label: 'Configuration',
                  items: [{ autogenerate: { directory: 'troubleshooting/frequently-asked-questions-faq/configuration' } }],
                },
                {
                  label: 'Monitoring & Compatibility',
                  items: [{ autogenerate: { directory: 'troubleshooting/frequently-asked-questions-faq/monitoring-compatibility' } }],
                },
                {
                  label: 'Purchasing & Licensing',
                  items: [{ autogenerate: { directory: 'troubleshooting/frequently-asked-questions-faq/purchasing-licensing' } }],
                },
                {
                  label: 'Known Issues',
                  items: [
                    { label: 'Overview', slug: 'troubleshooting/frequently-asked-questions-faq/troubleshooting-known-issues' },
                    { slug: 'troubleshooting/frequently-asked-questions-faq/troubleshooting-known-issues/adjust-scaling-factor' },
                    { slug: 'troubleshooting/frequently-asked-questions-faq/troubleshooting-known-issues/error-initializing-appstore-offerings' },
                    { slug: 'troubleshooting/frequently-asked-questions-faq/troubleshooting-known-issues/how-do-i-check-if-peakhour-is-reporting-data-accurately' },
                    { slug: 'troubleshooting/frequently-asked-questions-faq/troubleshooting-known-issues/my-graph-isn-t-smooth-or-network-traffic-appears-in-bursts-instead-of-a-smooth-line' },
                    {
                      label: 'Common Troubleshooting',
                      items: [{ autogenerate: { directory: 'troubleshooting/frequently-asked-questions-faq/troubleshooting-known-issues/common-troubleshooting' } }],
                    },
                    {
                      label: 'SNMP Troubleshooting',
                      items: [{ autogenerate: { directory: 'troubleshooting/frequently-asked-questions-faq/troubleshooting-known-issues/snmp-troubleshooting' } }],
                    },
                    {
                      label: 'UPnP Troubleshooting',
                      items: [{ autogenerate: { directory: 'troubleshooting/frequently-asked-questions-faq/troubleshooting-known-issues/upnp-troubleshooting' } }],
                    },
                  ],
                },
              ],
            },
            {
              label: 'Wiki',
              items: [
                { label: 'Overview', slug: 'troubleshooting/wiki' },
                { slug: 'troubleshooting/wiki/peakhour' },
                { slug: 'troubleshooting/wiki/usage-monitoring' },
                {
                  label: 'Terminology',
                  items: [
                    { label: 'Overview', slug: 'troubleshooting/wiki/terminology' },
                    { slug: 'troubleshooting/wiki/terminology/upnp' },
                    {
                      label: 'SNMP',
                      items: [{ autogenerate: { directory: 'troubleshooting/wiki/terminology/snmp' } }],
                    },
                  ],
                },
              ],
            },
          ],
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
