#!/usr/bin/env node
/**
 * Tell IndexNow which help.peakhour.app pages a deploy changed.
 *
 * IndexNow is the notice that Bing, Yandex, Seznam, Naver and Yep share. Bing
 * also feeds DuckDuckGo and ChatGPT search. One POST to api.indexnow.org
 * reaches all of them. Google does not use IndexNow.
 *
 * The key is public. IndexNow fetches https://help.peakhour.app/<key>.txt to
 * prove that we own the host. That file is public/<KEY>.txt. To change the key,
 * replace the file and KEY together, then deploy.
 *
 * The deploy workflow gives the commit range of the push. A changed or deleted
 * page under src/content/docs gives its own URL. Any other changed file (the
 * site config, a component, a style, this script) can change every page, so
 * the script then sends every URL in the built sitemap.
 *
 * Usage:
 *   node scripts/submit-indexnow.mjs <before-sha> <after-sha>   # pages in the range
 *   node scripts/submit-indexnow.mjs --all                      # every sitemap URL
 *   add --dry-run to list the URLs and send nothing
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const DOCS = 'src/content/docs/';

const HOST = 'help.peakhour.app';
const KEY = '00711a2698a704ca6c4d5113494e927c';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const shas = args.filter((a) => !a.startsWith('--'));
let all = args.includes('--all');

function fail(message) {
  console.error(`indexnow: ${message}`);
  process.exit(1);
}

// Every <loc> in the built sitemap files. The index file only points at them.
function sitemapUrls() {
  if (!fs.existsSync(DIST)) fail('no dist folder. Run `npm run build` first.');
  const files = fs.readdirSync(DIST).filter((f) => /^sitemap-\d+\.xml$/.test(f));
  if (files.length === 0) fail('no sitemap-N.xml in dist.');
  return files.flatMap((f) =>
    [...fs.readFileSync(path.join(DIST, f), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]),
  );
}

// src/content/docs/a/b.mdx gives /a/b/. An index file gives its folder.
function urlForDoc(file) {
  let rel = file.slice(DOCS.length).replace(/\.mdx?$/, '');
  rel = rel === 'index' ? '' : rel.replace(/\/index$/, '');
  return `https://${HOST}/${rel ? `${rel}/` : ''}`;
}

function changedFiles(before, after) {
  // A push that opens a branch has an all-zero "before". Then no range exists.
  if (!before || /^0+$/.test(before)) return null;
  try {
    return execFileSync('git', ['diff', '--name-only', before, after], { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
  } catch {
    return null; // The "before" commit is not in the clone, for example after a force push.
  }
}

let urls;
if (!all) {
  if (shas.length !== 2) fail('give <before-sha> <after-sha>, or --all.');
  const files = changedFiles(shas[0], shas[1]);
  if (files === null) {
    console.log('indexnow: no usable commit range, so all pages go.');
    all = true;
  } else if (files.length === 0) {
    console.log('indexnow: no changed files.');
    process.exit(0);
  } else if (files.some((f) => !(f.startsWith(DOCS) && /\.mdx?$/.test(f)))) {
    console.log('indexnow: a file outside the docs pages changed, so all pages go.');
    all = true;
  } else {
    urls = [...new Set(files.map(urlForDoc))];
  }
}
if (all) urls = sitemapUrls();

console.log(`indexnow: ${urls.length} URL(s)`);
for (const u of urls) console.log(`  ${u}`);
if (dryRun) process.exit(0);

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
});
if (res.status === 200 || res.status === 202) {
  console.log(`indexnow: HTTP ${res.status} (accepted)`);
} else {
  fail(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
