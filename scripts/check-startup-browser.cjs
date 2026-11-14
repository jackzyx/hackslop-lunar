const { chromium } = require('../.slide-tools/node_modules/playwright');
const assert = require('node:assert/strict');
const base = process.env.TEST_URL || 'http://127.0.0.1:5174/';
(async () => {
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined),headless:true});
 try {
  const bare=await browser.newPage({viewport:{width:1440,height:900}});
  await bare.route(/\/(src\/main\.jsx|assets\/index-[^/]+\.js)/,route=>route.abort());
  await bare.goto(base,{waitUntil:'domcontentloaded'});
  const colors=await bare.evaluate(()=>({html:getComputedStyle(document.documentElement).backgroundColor,body:getComputedStyle(document.body).backgroundColor,intro:getComputedStyle(document.querySelector('#intro')).backgroundColor}));
  assert.equal(colors.html,'rgb(5, 4, 3)');assert.equal(colors.body,'rgb(5, 4, 3)');assert.equal(colors.intro,'rgb(0, 0, 0)');
  assert.ok(await bare.locator('#intro-boot').isVisible());
  await bare.screenshot({path:'.slide-tools/first-paint-dark.png'});
  await bare.keyboard.press('x');assert.equal(await bare.locator('#intro').isVisible(),false);
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let released=false;
  await page.route(/\/(src\/App\.jsx|assets\/App-[^/]+\.js)/,async route=>{await new Promise(r=>setTimeout(r,3500));released=true;await route.continue()});
  await page.route('**/terrain_500m.bin',async route=>{await new Promise(r=>setTimeout(r,1800));await route.continue()});
  const start=Date.now();await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#intro').dataset.phase==='playing'&&Number(document.querySelector('#intro').dataset.time)>.1);
  const motionMs=Date.now()-start;
  assert.equal(released,false,'intro waited for the planner JavaScript');
  assert.equal(await page.locator('#intro').getAttribute('data-assets'),'loading','test should observe animation before terrain is ready');
  await page.waitForFunction(()=>document.querySelector('#intro').hidden,{timeout:30000});
  await page.getByRole('navigation',{name:'Main navigation'}).waitFor();
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({firstPaint:colors,skipBeforeJS:'passed',animationStartsBeforePlannerAndTerrain:'passed',motionMs,plannerReveal:'passed',pageErrors:errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
