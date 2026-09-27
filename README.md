# help.peakhourapp.com

The PeakHour support site, built with [Astro Starlight](https://starlight.astro.build/) and deployed to Cloudflare Pages.

## Development

```bash
npm install
npm run dev
```

The site will be available at `http://localhost:4321`.

## Structure

- `src/content/docs/user-guide/` — migrated from the old P5D (Documentation) Confluence space
- `src/content/docs/troubleshooting/` — migrated from the old P5W (Wiki) Confluence space
- `src/components/NeedsReview.astro` — banner shown on articles carried over from PeakHour 5 that still need a v6 revision
- `src/styles/theme.css` — brand palette (edit `--peakhour-green` to match the marketing site exactly)
- `public/_redirects` — Cloudflare Pages redirect map, including legacy URLs from the old Confluence site
- The original Confluence migration script (`scripts/migrate.py`) has been removed — both sections are hand-maintained now (the troubleshooting tree was reorganised in June 2026 into `faq/`, `common-issues/`, `snmp/`, `upnp/`, `reference/`). It's in git history if ever needed

## Marking articles reviewed

Migrated articles include `status: needs-review` in frontmatter. Once an article
has been updated for PeakHour 6, remove that field (or set it to `reviewed`) and
the orange banner will disappear.

## Deployment

Two Cloudflare Pages projects, neither connected to git:

| Site | Pages project | Deploys |
|------|---------------|---------|
| `help.peakhour.app` (production) | `peakhour-help` | Automatically on every push to `main` (`.github/workflows/deploy.yml`). |
| `help-dev.peakhour.app` (dev) | `peakhour-help-dev` | By hand: `npm run deploy:dev` from the branch you want to show. |

Pages for a release that has not shipped live on a `release/<version>` branch
(for example `release/6.1`). Show them on dev with `npm run deploy:dev`, and
merge the branch into `main` only when the release ships: the merge publishes
them. `public/_headers` marks every host except `help.peakhour.app` noindex.

Build command: `npm run build`. Output directory: `dist`.
