// help.peakhourapp.com → help.peakhour.app permanent redirect (sc-2148).
//
// The help centre moved to help.peakhour.app. The old host still served the
// Atlassian knowledge base, fully open to crawlers, so Google indexed both and
// every legacy link landed on the old site or a 404.
//
// The redirect table in public/_redirects was already written for those legacy
// URLs, but Pages applies it on help.peakhour.app — the host where those URLs
// never existed. Measured before this Worker:
//
//   /wiki/spaces/P5D/pages/7143462/Requirements_7143462
//       help.peakhour.app     301 -> /user-guide/requirements/
//       help.peakhourapp.com  404
//
//   /space/P5D/7144061
//       help.peakhour.app     301 -> /user-guide/monitor-another-mac-peakhour-enabler/
//       help.peakhourapp.com  200, old KB page
//
// This Worker puts the table where the URLs actually are. It runs only on
// help.peakhourapp.com. The apex and www hosts belong to peakhourapp-com-redirect,
// and updates.peakhourapp.com serves the PeakHour 3 and 4 Sparkle appcasts from
// its own Worker — neither must ever match these routes.
//
// Shipped PeakHour builds link to this host, so it must stay deployed for as
// long as the domain is registered.

import { EXACT, PREFIX } from './redirects.generated.js';

const SITE = 'https://help.peakhour.app';

// Path prefixes that exist on the new help site. An unmapped URL under one of
// these is very likely a link to the new site that reached the old host, so it
// is passed through unchanged; the new site will serve it or show its own 404.
// Anything else goes to the help centre home rather than a 404, matching what
// peakhourapp-com-redirect does for the marketing site.
const NEW_SITE_SECTIONS = ['/user-guide/', '/troubleshooting/'];

/** Strips trailing slashes, keeping the root as "/". */
function normalise(pathname) {
  return pathname.replace(/\/+$/, '') || '/';
}

/**
 * The help site builds every page as <path>/index.html, so a target without
 * the trailing slash costs a second redirect hop. normalise() strips the slash
 * off the incoming path, which means a :splat substitution has to put it back.
 * A path whose last segment looks like a filename is left alone.
 */
function withTrailingSlash(path) {
  if (path.endsWith('/')) return path;
  const lastSegment = path.slice(path.lastIndexOf('/') + 1);
  return /\.[a-z0-9]+$/i.test(lastSegment) ? path : `${path}/`;
}

/**
 * Resolves the destination for one incoming URL.
 *
 * Returns { url, status }. Matching is case-insensitive: the old Confluence
 * paths carried mixed case (/wiki/spaces/P5D/...) and an inbound link may not
 * have preserved it.
 */
export function redirectTarget(url) {
  const path = normalise(url.pathname);
  const key = path.toLowerCase();
  const query = url.search;

  const exact = EXACT[key];
  if (exact) {
    const [to, status] = exact;
    return { url: `${SITE}${to}${query}`, status };
  }

  for (const [from, to, status] of PREFIX) {
    // A prefix rule written as `/docs/*` matches /docs and anything below it.
    if (key !== from && !key.startsWith(`${from}/`)) continue;

    const splat = path.slice(from.length).replace(/^\//, '');
    const target = to.includes(':splat')
      ? withTrailingSlash(to.replace(':splat', splat))
      : to;
    return { url: `${SITE}${target}${query}`, status };
  }

  // Unmapped. Pass through anything that looks like a new-site path so a
  // mistyped host still reaches the right page.
  const looksLikeNewSite = NEW_SITE_SECTIONS.some((section) =>
    `${key}/`.startsWith(section),
  );
  if (looksLikeNewSite) {
    return { url: `${SITE}${url.pathname}${query}`, status: 301 };
  }

  return { url: `${SITE}/${query}`, status: 301 };
}

export default {
  fetch(request) {
    const { url, status } = redirectTarget(new URL(request.url));
    return new Response(null, {
      status,
      headers: {
        Location: url,
        // The mapping is permanent, but keep it revalidating for a day rather
        // than a year: a wrong 301 cached by a browser is painful to undo.
        'Cache-Control': 'public, max-age=86400',
      },
    });
  },
};
