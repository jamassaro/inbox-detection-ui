// FE-012 evidence capture — gallery stills (EN + ES) plus console/page error
// collection. Playwright + cached Chromium (agent-browser unavailable in this
// sandbox). Window captures keep the 720px shorter-edge rule; tight element
// crops are written as supplementary *_closeup.png files. Writes to
// /home/user/work/evidence (outside the checkout).
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const OUT = '/home/user/work/evidence';
mkdirSync(OUT, { recursive: true });

const errors = [];

const browser = await chromium.launch({
  executablePath: '/home/user/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});

/** Section anchors, in document order. */
const SECTIONS = {
  cards: 'DiscoveryCard variants',
  compact: 'DiscoveryCard compact',
  list: 'DiscoveryListItem',
  locked: 'LockedDiscoveryCard',
};

const shoot = async (lang) => {
  // i18next detects the locale from localStorage before React mounts.
  // addInitScript serializes the fn, so values must travel via the arg.
  await page.addInitScript(
    (cfg) => window.localStorage.setItem(cfg.key, cfg.lang),
    { key: 'inbox-detective-locale', lang },
  );
  await page.goto('http://localhost:5173/dev/discovery-cards', {
    waitUntil: 'networkidle',
  });

  const byLang = (tc, name) => `${OUT}/${tc}-${name}-${lang}.png`;

  // Window captures (1440x900) — the uploadable evidence set.
  await page.screenshot({ path: byLang('tc-1', 'result') });

  // Full-page capture — the representative-set overview for the all-types criterion.
  await page.screenshot({ path: `${OUT}/tc-0-fullpage-${lang}.png`, fullPage: true });

  await page.locator(`section[aria-label="${SECTIONS.locked}"]`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: byLang('tc-2', 'result') });

  // At max scroll the list section and locked card share one viewport frame,
  // so the list evidence is a full-width clip of that composition rather than
  // a duplicate frame. Box is read live — ES copy can shift section heights.
  const listTop = await page
    .locator(`section[aria-label="${SECTIONS.list}"]`)
    .boundingBox()
    .then((box) => Math.max(0, box?.y ?? 0));
  await page.screenshot({
    path: byLang('tc-3', 'result'),
    clip: { x: 0, y: listTop, width: 1440, height: 900 - listTop },
  });

  // Supplementary tight crops (element-sized, not for upload).
  await page
    .getByTestId('discovery-card')
    .first()
    .screenshot({ path: `${OUT}/tc-1-result-${lang}-closeup.png` });
  await page
    .getByTestId('locked-discovery-card')
    .screenshot({ path: `${OUT}/tc-2-result-${lang}-closeup.png` });
  await page
    .getByTestId('discovery-list-item')
    .first()
    .screenshot({ path: `${OUT}/tc-3-result-${lang}-closeup.png` });
};

await shoot('en');
await shoot('es');

await browser.close();

if (errors.length) {
  console.error('BROWSER ERRORS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('EVIDENCE_OK zero console/page errors');
