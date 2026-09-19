# help.peakhourapp.com → help.peakhour.app redirect Worker

Built for sc-2148. **Not deployed yet** — deploying it takes the old Atlassian
help centre offline, so the cutover is a deliberate, separate step.

## Why this exists

The help centre moved to `help.peakhour.app`, but `help.peakhourapp.com` kept
serving the old Atlassian knowledge base. Both were live, both returned 200,
and the old host's `robots.txt` was `Allow: /` with its own sitemap — so Google
indexed both and they competed with each other.

The redirect table in `../public/_redirects` was written for the legacy
Confluence URLs, but Cloudflare Pages applies it on `help.peakhour.app` — the
host where those URLs never existed. Measured on 2026-09-19:

| URL | `help.peakhour.app` | `help.peakhourapp.com` |
|---|---|---|
| `/wiki/spaces/P5D/pages/7143462/Requirements_7143462` | 301 → `/user-guide/requirements/` | **404** |
| `/space/P5D/7144061` | 301 → correct page | **200, old KB** |

Every legacy inbound link, bookmark, Google result and contextual help button
in shipped PeakHour builds lands on the old KB or a 404. This Worker puts the
redirect table where the URLs actually are.

## One source of truth

`../public/_redirects` stays authoritative. `scripts/build-redirects.mjs` parses
it into `src/redirects.generated.js`, so the two hosts cannot drift apart.

Regenerate after editing `_redirects`:

```bash
npm run build:redirects
```

`npm test` and `npm run deploy` both regenerate first, so a stale generated file
cannot ship.

## Behaviour

- **Exact and prefix rules** from `_redirects`, all 301. Matching is
  case-insensitive (the old Confluence paths carried mixed case) and ignores
  trailing slashes.
- **`:splat`** substitution for `/docs/*`, with the trailing slash restored —
  the help site builds every page as `<path>/index.html`, so a target without
  the slash costs a second hop.
- **Query strings** are preserved.
- **Unmapped paths under `/user-guide/` or `/troubleshooting/`** pass through
  unchanged, so a new-site link that reaches the old host still works.
- **Anything else** goes to `https://help.peakhour.app/` rather than a 404,
  matching what `peakhourapp-com-redirect` does for the marketing site.
- `Cache-Control: public, max-age=86400` — permanent in intent, but a wrong 301
  cached for a year in a browser is painful to undo.

## Tests

```bash
npm test
```

26 tests, including the two URLs measured as broken above, the prefix and
`:splat` cases, case and slash insensitivity, query preservation, and a sweep
asserting that all 114 generated rules resolve to the new host without looping.

## Deploying (the cutover)

This is the step that retires the old help centre. Before running it:

1. Confirm `help.peakhourapp.com` is proxied through Cloudflare in the
   `peakhourapp.com` zone. It is as of 2026-09-19 (`cf-cache-status` present on
   its responses), so a Worker route will take effect.
2. Confirm nothing else needs the Atlassian site — it goes dark immediately for
   everyone, including any Atlassian-hosted assets that the old KB served.
3. Deploy:

   ```bash
   npm run deploy
   ```

4. Verify the two URLs from the table above now 301 on the old host.
5. Retire the Atlassian subscription once traffic has drained.

To roll back, remove the route from the Worker in the Cloudflare dashboard (or
`wrangler delete`) and the old host returns to whatever DNS points at.

**Keep this deployed for as long as the domain is registered.** Shipped
PeakHour binaries link to `help.peakhourapp.com`.
