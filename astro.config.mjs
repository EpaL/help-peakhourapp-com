// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import { execFileSync } from 'node:child_process';
import remarkGfm from 'remark-gfm';

// Last commit date per doc, for the sitemap's <lastmod> (sc-2164). Starlight
// reads the same data for its "Last updated" line, so the two agree.
//
// This needs full git history. The deploy workflow now checks out with
// fetch-depth: 0 — with the default shallow clone every file reports the date
// of the single fetched commit, which is why every page used to claim it was
// updated at the instant of the last deploy.
function lastCommitDates() {
  const dates = new Map();
  try {
    const log = execFileSync(
      'git',
      ['log', '--name-only', '--format=%cI', '--', 'src/content/docs'],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
    );
    let current = null;
    for (const line of log.split('\n')) {
      if (!line.trim()) continue;
      if (/^\d{4}-\d{2}-\d{2}T/.test(line)) {
        current = line.trim();
        continue;
      }
      // git log lists newest first, so the first sighting of a file wins.
      if (current && !dates.has(line)) dates.set(line, current);
    }
  } catch {
    // No git available (a tarball build, say). Ship without lastmod rather
    // than with a build timestamp pretending to be a content date.
  }
  return dates;
}

const commitDates = lastCommitDates();

/** "/user-guide/requirements/" -> the doc file that produced it. */
function docPathFor(pathname) {
  const slug = pathname.replace(/^\/|\/$/g, '');
  const base = slug ? `src/content/docs/${slug}` : 'src/content/docs/index';
  for (const candidate of [`${base}.mdx`, `${base}.md`, `${base}/index.mdx`, `${base}/index.md`]) {
    if (commitDates.has(candidate)) return candidate;
  }
  return null;
}

// https://astro.build/config
export default defineConfig({
  site: 'https://help.peakhour.app',
  markdown: {
    // Astro 6 / @astrojs/mdx 5 stopped applying GFM to .mdx tables by
    // default; add it explicitly so Markdown tables render.
    remarkPlugins: [remarkGfm],
  },
  integrations: [
    sitemap({
      serialize: (item) => {
        const doc = docPathFor(new URL(item.url).pathname);
        return doc ? { ...item, lastmod: commitDates.get(doc) } : item;
      },
    }),
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
            { label: 'Overview', slug: 'troubleshooting' },
            {
              label: 'Frequently Asked Questions',
              items: [
                { label: 'Overview', slug: 'troubleshooting/faq' },
                { slug: 'troubleshooting/faq/what-is-peakhour' },
                { slug: 'troubleshooting/faq/beta-testing' },
                {
                  label: 'Configuration',
                  items: [
                    { slug: 'troubleshooting/faq/configuration/local-network-prompt' },
                    { slug: 'troubleshooting/faq/configuration/stop-launching-at-startup' },
                    { slug: 'troubleshooting/faq/configuration/reset-configuration' },
                    { slug: 'troubleshooting/faq/configuration/copy-configuration-to-another-mac' },
                  ],
                },
                {
                  label: 'Monitoring & Compatibility',
                  items: [
                    { slug: 'troubleshooting/faq/monitoring-compatibility/what-devices-can-peakhour-monitor' },
                    { slug: 'troubleshooting/faq/monitoring-compatibility/bandwidth-monitoring-faq' },
                    { slug: 'troubleshooting/faq/monitoring-compatibility/apple-airport-time-capsule' },
                    { slug: 'troubleshooting/faq/monitoring-compatibility/monitor-individual-devices' },
                    { slug: 'troubleshooting/faq/monitoring-compatibility/enable-snmp-on-mac-pc-linux' },
                  ],
                },
                {
                  label: 'Purchasing & Licensing',
                  items: [
                    { slug: 'troubleshooting/faq/purchasing-licensing/upgrade-from-peakhour-4' },
                    { slug: 'troubleshooting/faq/purchasing-licensing/download-older-versions' },
                    { slug: 'troubleshooting/faq/purchasing-licensing/upgrade-subscription-to-lifetime' },
                  ],
                },
              ],
            },
            {
              label: 'Common Issues',
              items: [
                { label: 'Overview', slug: 'troubleshooting/common-issues' },
                { slug: 'troubleshooting/common-issues/local-network-permission' },
                { slug: 'troubleshooting/common-issues/graph-isnt-smooth' },
                { slug: 'troubleshooting/common-issues/adjust-scaling-factor' },
                { slug: 'troubleshooting/common-issues/check-reporting-accuracy' },
                { slug: 'troubleshooting/common-issues/gathering-diagnostic-logs' },
                { slug: 'troubleshooting/common-issues/archive-and-send-configuration' },
              ],
            },
            {
              label: 'SNMP Troubleshooting',
              items: [
                { label: 'Overview', slug: 'troubleshooting/snmp' },
                { slug: 'troubleshooting/snmp/no-interfaces-found' },
                { slug: 'troubleshooting/snmp/device-responds-but-no-data' },
              ],
            },
            {
              label: 'UPnP Troubleshooting',
              items: [
                { label: 'Overview', slug: 'troubleshooting/upnp' },
                { slug: 'troubleshooting/upnp/turn-on-upnp' },
                { slug: 'troubleshooting/upnp/router-not-detected-or-data-wrong' },
                { slug: 'troubleshooting/upnp/upnp-cant-be-initialised' },
                { slug: 'troubleshooting/upnp/test-router-with-miniupnp' },
              ],
            },
            {
              label: 'Reference',
              items: [
                { label: 'Overview', slug: 'troubleshooting/reference' },
                { slug: 'troubleshooting/reference/snmp' },
                { slug: 'troubleshooting/reference/snmp-community' },
                { slug: 'troubleshooting/reference/high-capacity-counters' },
                { slug: 'troubleshooting/reference/upnp' },
                { slug: 'troubleshooting/reference/usage-monitoring' },
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
