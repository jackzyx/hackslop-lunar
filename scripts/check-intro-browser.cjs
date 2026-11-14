// Start Vite on port 5174; npm.cmd install --prefix .slide-tools playwright
const { chromium } = require('../.slide-tools/node_modules/playwright');
const assert = require('node:assert/strict');
const base = process.env.TEST_URL || 'http://127.0.0.1:5174/';
// Exercise cached playback directly; the planner no longer has a replay button.
const replay = page => page.evaluate(async () => {
  const [{ playIntro }, { initialTerrain }, scene] = await Promise.all([
    import('/src/intro/intro.js'), import('/src/terrain/startup.js'),
    fetch('/intro-scene.json').then(response => response.json()),
  ]);
  void playIntro({ ...scene, terrain: await initialTerrain() });
});
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined), headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '#compare');
    await page.waitForFunction(() => document.querySelector('#intro').dataset.phase === 'playing');
    await page.evaluate(() => {
      window.preparationTasks = [];
      window.preparationObserver = new PerformanceObserver(list => window.preparationTasks.push(...list.getEntries().map(e => e.duration)));
      window.preparationObserver.observe({ type: 'longtask' });
    });
    await page.waitForFunction(() => document.querySelector('#intro').dataset.assets === 'complete', { timeout: 30000 });
    const preparationTasks = await page.evaluate(() => { window.preparationObserver.disconnect(); return window.preparationTasks; });
    await page.waitForFunction(() => Number(document.querySelector('#intro').dataset.time) > .3);
    const jump = await page.evaluate(() => {
      const intro = document.querySelector('#intro'), before = +intro.dataset.time;
      const start = performance.now(); while (performance.now() - start < 1200) { /* synthetic main-thread stall */ }
      return new Promise(resolve => requestAnimationFrame(() => resolve(+intro.dataset.time - before)));
    });
    assert.ok(jump <= .1, `intro skipped ${jump}s after synthetic stall`);
    await page.waitForFunction(() => Number(document.querySelector('#intro').dataset.time) > 5.1);
    assert.ok(await page.locator('#intro').evaluate(el => Number(el.dataset.closeResolution) >= 512), 'localized terrain must be ready during approach, before the live map loads');
    await page.screenshot({ path: 'docs/intro-close-detail-preview.png' });
    await page.waitForFunction(() => Number(document.querySelector('#intro').dataset.time) > 5.8);
    await page.screenshot({ path: '.slide-tools/intro-smooth.png' });
    const names = await page.locator('.intro-site-marker span').allTextContents();
    await page.waitForFunction(() => document.querySelector('#intro').dataset.phase === 'revealing');
    assert.deepEqual(await page.locator('.intro-site-marker span').allTextContents(), names, 'site labels must survive the handoff');
    assert.deepEqual(await page.locator('.shell .mapwrap .pin-label').allTextContents(), names, 'intro and map must use the same site labels');
    assert.ok(await page.locator('.shell .details').evaluate(el => el.getAnimations().length > 0), 'graphs should fade in during the handoff');
    await page.waitForTimeout(750);
    assert.equal(await page.locator('.intro-site-marker').count(), 2);
    assert.ok(await page.locator('.intro-map-decorations').evaluate(el => Number(getComputedStyle(el).opacity) > 0), 'map overlay should fade in before the intro ends');
    await page.screenshot({ path: '.slide-tools/intro-handoff.png' });
    await page.waitForFunction(() => document.querySelector('#intro').hidden, { timeout: 20000 });
    assert.equal(await page.locator('.intro-site-marker').count(), 0, 'handoff markers must be removed after revealing the real map');
    await replay(page);
    await page.waitForFunction(() => document.querySelector('#intro').dataset.phase === 'playing');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('#intro').hidden);
    // Starting another run while one is active must not cancel the new run.
    await replay(page);
    await page.waitForFunction(() => document.querySelector('#intro').dataset.phase === 'playing');
    await page.evaluate(() => document.querySelector('#intro .skip').click());
    await page.waitForFunction(() => document.querySelector('#intro').hidden);
    // A slow texture request leaves Skip responsive during preparation.
    const slow = await browser.newPage(); slow.on('pageerror', error => errors.push(error.message));
    await slow.route('**/moon-albedo-4k.jpg', async route => { await new Promise(resolve => setTimeout(resolve, 1200)); await route.continue(); });
    await slow.goto(base + '#compare');
    await slow.waitForFunction(() => document.querySelector('#intro').dataset.phase === 'playing');
    await slow.getByRole('button', { name: /SKIP INTRO/i }).click();
    await slow.waitForFunction(() => document.querySelector('#intro').hidden);
    await slow.waitForTimeout(2500);
    assert.equal(await slow.locator('#intro').isVisible(), false, 'finished preparation resurrected a skipped intro');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ stallAdvanceSeconds: jump, preparationLongTasksMs: preparationTasks, fullPlayback: 'passed', cachedReplay: 'passed', skipDuringPreparation: 'passed', pageErrors: errors }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
