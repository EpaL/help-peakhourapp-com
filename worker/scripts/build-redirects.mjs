// Generates worker/src/redirects.generated.js from public/_redirects.
//
// public/_redirects is the source of truth. It is what Cloudflare Pages applies
// on help.peakhour.app, and it is what this Worker applies on the old
// help.peakhourapp.com host (sc-2148). Generating one from the other means the
// two hosts can never drift apart.
//
// Run: npm run build:redirects   (from worker/)

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SOURCE = new URL('../../public/_redirects', import.meta.url);
const OUTPUT = new URL('../src/redirects.generated.js', import.meta.url);

/**
 * Parses a Cloudflare Pages _redirects file.
 *
 * Each significant line is `<from> <to> <status>`, separated by runs of
 * whitespace. Comments start with `#`. A `from` ending in `/*` is a prefix
 * rule, and its `to` may contain `:splat`, which stands for whatever the `*`
 * matched.
 */
export function parseRedirects(text) {
  const exact = [];
  const prefix = [];

  for (const [index, rawLine] of text.split('\n').entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const [from, to, status] = line.split(/\s+/);
    if (!from || !to) {
      throw new Error(`_redirects line ${index + 1}: expected "<from> <to> <status>", got "${line}"`);
    }
    const code = Number(status ?? 301);
    if (!Number.isInteger(code) || code < 300 || code > 399) {
      throw new Error(`_redirects line ${index + 1}: "${status}" is not a redirect status`);
    }

    if (from.endsWith('/*')) {
      prefix.push({ from: from.slice(0, -2), to, status: code });
    } else {
      exact.push({ from, to, status: code });
    }
  }

  // Longest prefix first, so /space/P5W/28901383 wins over a hypothetical
  // /space. Matching then just takes the first hit.
  prefix.sort((a, b) => b.from.length - a.from.length);

  return { exact, prefix };
}

const text = await readFile(SOURCE, 'utf8');
const { exact, prefix } = parseRedirects(text);

const banner = `// GENERATED FILE — do not edit.
//
// Built from public/_redirects by worker/scripts/build-redirects.mjs.
// Edit that file and run \`npm run build:redirects\` from worker/.
//
// ${exact.length} exact rules, ${prefix.length} prefix rules.
`;

// A plain object keyed by the lowercased path: matching is case-insensitive
// because the old Confluence URLs carried mixed case (/wiki/spaces/P5D/...)
// and nothing guarantees an inbound link preserved it.
const exactEntries = exact
  .map(({ from, to, status }) => `  ${JSON.stringify(from.toLowerCase())}: [${JSON.stringify(to)}, ${status}],`)
  .join('\n');

const prefixEntries = prefix
  .map(({ from, to, status }) => `  [${JSON.stringify(from.toLowerCase())}, ${JSON.stringify(to)}, ${status}],`)
  .join('\n');

await writeFile(
  OUTPUT,
  `${banner}
export const EXACT = {
${exactEntries}
};

export const PREFIX = [
${prefixEntries}
];
`,
  'utf8',
);

console.log(
  `wrote ${fileURLToPath(OUTPUT)} — ${exact.length} exact, ${prefix.length} prefix`,
);
