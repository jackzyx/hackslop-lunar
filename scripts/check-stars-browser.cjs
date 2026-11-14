const { chromium } = require('../.slide-tools/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined), headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5174/');
    await page.locator('.site-starfield').waitFor({ state: 'attached' });
    assert.equal(await page.locator('.site-starfield').getAttribute('data-visible'), 'false');
    await page.waitForFunction(() => document.querySelector('#intro').hidden);
    await page.waitForFunction(() => document.querySelector('.site-starfield')?.dataset.visible === 'true');
    const initial = await page.locator('.site-starfield').evaluate(el => Number(getComputedStyle(el).opacity));
    await page.waitForTimeout(700);
    const fading = await page.locator('.site-starfield').evaluate(el => Number(getComputedStyle(el).opacity));
    assert.ok(fading > initial && fading < .75, `stars must fade slowly: ${initial} -> ${fading}`);
    const point = await page.evaluate(() => {
      const canvas = document.querySelector('.site-starfield'), context = canvas.getContext('2d');
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      window.starLinks = 0;
      const lineTo = CanvasRenderingContext2D.prototype.lineTo;
      CanvasRenderingContext2D.prototype.lineTo = function (...args) {
        if (this.canvas === canvas) window.starLinks++;
        return lineTo.apply(this, args);
      };
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 35) {
        const index = (i - 3) / 4;
        return { x: index % canvas.width * innerWidth / canvas.width, y: Math.floor(index / canvas.width) * innerHeight / canvas.height };
      }
    });
    assert.ok(point, 'background canvas must contain stars');
    await page.mouse.move(point.x, point.y);
    await page.waitForFunction(() => window.starLinks > 0);
    assert.equal(await page.locator('.site-starfield').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(100);
    const still = await page.locator('.site-starfield').evaluate(el => el.toDataURL());
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.site-starfield').evaluate(el => el.toDataURL()), still, 'reduced-motion stars must remain static');
    assert.deepEqual(errors, []);
    console.log('Star fade after handoff, cursor interaction, click-through and reduced motion passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
