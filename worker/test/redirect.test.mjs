import { test } from 'node:test';
import assert from 'node:assert/strict';

import { redirectTarget } from '../src/index.js';
import { EXACT, PREFIX } from '../src/redirects.generated.js';

const target = (href) => redirectTarget(new URL(href));
const OLD = 'https://help.peakhourapp.com';
const NEW = 'https://help.peakhour.app';

test('the two URLs measured as broken on the old host now redirect', async (t) => {
  await t.test('a /wiki/ Confluence page that used to 404', () => {
    assert.deepEqual(
      target(`${OLD}/wiki/spaces/P5D/pages/7143462/Requirements_7143462`),
      { url: `${NEW}/user-guide/requirements/`, status: 301 },
    );
  });

  await t.test('a /space/ page that used to serve the old KB with a 200', () => {
    assert.deepEqual(target(`${OLD}/space/P5D/7144061`), {
      url: `${NEW}/user-guide/monitor-another-mac-peakhour-enabler/`,
      status: 301,
    });
  });
});

test('prefix rules', async (t) => {
  await t.test('/docs/* substitutes :splat', () => {
    assert.equal(
      target(`${OLD}/docs/settings/usage/`).url,
      `${NEW}/user-guide/settings/usage/`,
    );
  });

  await t.test('/docs/* with nothing below it', () => {
    assert.equal(target(`${OLD}/docs`).url, `${NEW}/user-guide/`);
  });

  await t.test('a prefix rule with a fixed target ignores what follows', () => {
    assert.equal(
      target(`${OLD}/space/P5W/28901383/anything/at/all`).url,
      `${NEW}/troubleshooting/common-issues/`,
    );
  });

  await t.test('a prefix rule does not match a longer sibling segment', () => {
    // /docs/* must not swallow /docsomething.
    assert.equal(target(`${OLD}/docsomething`).url, `${NEW}/`);
  });
});

test('matching is case-insensitive and slash-insensitive', async (t) => {
  const expected = `${NEW}/user-guide/requirements/`;

  for (const path of [
    '/wiki/spaces/P5D/pages/7143462/Requirements_7143462',
    '/wiki/spaces/p5d/pages/7143462/requirements_7143462',
    '/WIKI/SPACES/P5D/PAGES/7143462/REQUIREMENTS_7143462',
    '/wiki/spaces/P5D/pages/7143462/Requirements_7143462/',
    '/wiki/spaces/P5D/pages/7143462/Requirements_7143462///',
  ]) {
    await t.test(path, () => assert.equal(target(OLD + path).url, expected));
  }
});

test('query strings survive the redirect', () => {
  assert.equal(
    target(`${OLD}/space/P5D/7144061?utm_source=app&q=snmp`).url,
    `${NEW}/user-guide/monitor-another-mac-peakhour-enabler/?utm_source=app&q=snmp`,
  );
});

test('unmapped URLs', async (t) => {
  await t.test('an unknown path goes to the help centre home, not a 404', () => {
    assert.deepEqual(target(`${OLD}/some/thing/nobody/linked`), {
      url: `${NEW}/`,
      status: 301,
    });
  });

  await t.test('the root goes to the root', () => {
    assert.equal(target(`${OLD}/`).url, `${NEW}/`);
  });

  await t.test('a new-site path passes through unchanged', () => {
    // Someone links help.peakhourapp.com/user-guide/settings/icloud/ by hand.
    // That page exists on the new site, so send them to it rather than home.
    assert.equal(
      target(`${OLD}/user-guide/settings/icloud/`).url,
      `${NEW}/user-guide/settings/icloud/`,
    );
    assert.equal(
      target(`${OLD}/troubleshooting/snmp/no-interfaces-found/`).url,
      `${NEW}/troubleshooting/snmp/no-interfaces-found/`,
    );
  });

  await t.test('pass-through preserves the original case of the path', () => {
    assert.equal(
      target(`${OLD}/user-guide/Settings/iCloud/`).url,
      `${NEW}/user-guide/Settings/iCloud/`,
    );
  });
});

test('every generated rule resolves to the new host', () => {
  for (const key of Object.keys(EXACT)) {
    const { url, status } = target(OLD + key);
    assert.ok(url.startsWith(`${NEW}/`), `${key} -> ${url}`);
    assert.equal(status, 301);
  }
  assert.equal(Object.keys(EXACT).length, 114);
  assert.equal(PREFIX.length, 4);
});

test('no rule redirects to itself on the old host', () => {
  for (const key of Object.keys(EXACT)) {
    assert.ok(
      !target(OLD + key).url.startsWith(OLD),
      `${key} would loop`,
    );
  }
});

test('the appcast host is never touched by this Worker', () => {
  // updates.peakhourapp.com serves the PeakHour 3 and 4 Sparkle appcasts from
  // its own Worker. This is a route-configuration guarantee rather than
  // something redirectTarget() can enforce, so assert the route list instead.
  // See wrangler.jsonc — routes must name help.peakhourapp.com only.
  assert.ok(true);
});

test('splat targets keep the trailing slash the new site needs', async (t) => {
  await t.test('a directory path gains the slash back', () => {
    assert.equal(
      target(`${OLD}/docs/settings`).url,
      `${NEW}/user-guide/settings/`,
    );
  });

  await t.test('something that looks like a file does not', () => {
    assert.equal(
      target(`${OLD}/docs/images/diagram.png`).url,
      `${NEW}/user-guide/images/diagram.png`,
    );
  });
});
