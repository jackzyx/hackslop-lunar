const { chromium } = require('../.slide-tools/node_modules/playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:5174/';

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined),
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
    await page.addInitScript(() => {
      window.introProfile = { tasks: [], frames: [], phases: [] };
      new PerformanceObserver(list => window.introProfile.tasks.push(...list.getEntries().map(entry => ({ at: entry.startTime, duration: entry.duration })))).observe({ type: 'longtask' });
      let previous = performance.now(), phase;
      function sample(now) {
        const intro = document.querySelector('#intro');
        if (intro) {
          if (phase !== intro.dataset.phase) {
            phase = intro.dataset.phase;
            window.introProfile.phases.push({ phase, at: now });
          }
          if (Number(intro.dataset.time) >= 4.5) window.introProfile.frames.push({ dt: now - previous, at: now, phase });
          if (intro.hidden) return;
        }
        previous = now;
        requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    await page.goto(base + '#compare');
    await page.waitForFunction(() => document.querySelector('#intro').hidden, null, { timeout: 60000 });
    console.log(await page.evaluate(() => {
      const { frames, phases, tasks } = window.introProfile;
      const handoff = frames.filter(frame => frame.phase === 'revealing').map(frame => frame.dt).sort((a, b) => a - b);
      return {
        phases, longTasksDuringApproach: tasks.filter(task => task.at >= frames[0]?.at),
        longFrames: frames.filter(frame => frame.dt > 50),
        handoffP95ms: handoff[Math.floor(handoff.length * .95)],
        renderer: document.querySelector('#landing-terrain canvas')?.dataset,
      };
    }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
