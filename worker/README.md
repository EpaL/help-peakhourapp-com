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

44 tests, including the two URLs measured as broken above, the prefix and
`:splat` cases, case and slash insensitivity, query preservation, the
PeakHour 2/3/4 spaces landing on /earlier-versions/, the PeakHour 5 live-format
URLs mapping by page id, and a sweep asserting that all 162 generated rules
resolve to the new host without looping.

## The cutover (done)

Cut over on **2026-09-20**. `help.peakhourapp.com` is now proxied through the
`peakhourapp.com` zone, so the Worker route fires and every legacy URL 301s to
`help.peakhour.app`. The Refined / Atlassian help centre no longer serves that
hostname.

Verified in production against the old KB's own sitemap — all 189 URLs:

```
189 tested
 44 -> a specific page
144 -> /earlier-versions/
  1 -> home   ("/", which is correct)
  0 not a 301
  0 still pointing at the old site
```

Every redirect resolves in a single hop to a live page. The appcasts on
`updates.peakhourapp.com`, and the apex and www redirects, were checked against
a pre-cutover baseline and are unchanged.

Getting here needed a DNS change, not a deploy. The hostname had been a
DNS-only CNAME to `custom.domain.refined.site`, so traffic never entered the
zone and the Worker route could not fire no matter how often it was deployed.
(An earlier note here claimed it was already proxied, on the strength of
`server: cloudflare` and `cf-cache-status` in its responses. Those headers came
from *Refined's* Cloudflare in front of their origin, not from this zone.)

**Still to do:** retire the Refined / Atlassian subscription. It is no longer
serving anything.

**Rollback:** point the `help` record back at `custom.domain.refined.site`,
unproxied, and the old site answers again. Removing the Worker route will not
do it — the route is not what makes traffic arrive here.

**Keep this deployed for as long as the domain is registered.** Shipped
PeakHour binaries link to `help.peakhourapp.com`.
