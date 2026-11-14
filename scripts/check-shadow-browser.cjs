const {chromium}=require('../.slide-tools/node_modules/playwright');
const assert=require('node:assert/strict');
const base=process.env.TEST_URL||'http://127.0.0.1:5174/';
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined),headless:true});try{
 const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'#about');
 const cases=await p.evaluate(async()=>{
  const {createGPUShadow}=await import('/src/shadow-gpu.js');
  const {terrainFrom,shadeView,paint,sunVector,TERRAIN}=await import('/src/shadow.js');
  const real=terrainFrom(await(await fetch('/terrain_500m.bin')).arrayBuffer());
  const flat={...TERRAIN,h:new Int16Array(1000000),hmax:0};
  const wall={...TERRAIN,h:new Int16Array(1000000),hmax:2};for(let r=0;r<1000;r++)for(let c=520;c<524;c++)wall.h[r*1000+c]=2000;
  const tests=[['flat lit',flat,sunVector(-88,120,200,3),{cx:60,cy:-40,half:30}],['flat dark',flat,sunVector(-88,120,200,-3),{cx:60,cy:-40,half:30}],['wall',wall,sunVector(-89.9,90,0,2),{cx:10,cy:0,half:20}],['real close',real,sunVector(-89.46,222.5,80,1),{cx:0,cy:0,half:30}],['real region',real,sunVector(-89.46,222.5,260,1.5),{cx:0,cy:0,half:170}]];
  tests.push(['real wide',real,sunVector(-89.46,222.5,260,1.5),{cx:0,cy:0,half:110,aspect:2}]);
  return tests.map(([name,terrain,sun,view])=>{
   const renderer=createGPUShadow(terrain);if(!renderer)throw Error('GPU renderer failed to initialize');const n=64;
   const width=Math.round(n*(view.aspect??1));
   renderer.render({sun,view,size:n,id:0});const gl=renderer.canvas.getContext('webgl2');const gpu=new Uint8Array(width*n*4);gl.readPixels(0,0,width,n,gl.RGBA,gl.UNSIGNED_BYTE,gpu);
   const cpu=new Uint8ClampedArray(width*n*4);paint(shadeView(terrain,sun,view,width,n),cpu);let total=0,max=0,large=0;
   for(let j=0;j<n;j++)for(let i=0;i<width;i++)for(let c=0;c<3;c++){const delta=Math.abs(cpu[4*(j*width+i)+c]-gpu[4*((n-1-j)*width+i)+c]);total+=delta;max=Math.max(max,delta);if(delta>5)large++;}
   const error=gl.getError();renderer.dispose();return {name,meanChannelError:total/(width*n*3),maxChannelError:max,largeErrorFraction:large/(width*n*3),glError:error};
  });
 });
 cases.forEach(c=>{assert.ok(c.meanChannelError<1.5,JSON.stringify(c));assert.ok(c.largeErrorFraction<.02,JSON.stringify(c));assert.equal(c.glError,0)});
 await p.getByRole('navigation').getByRole('link',{name:'Compare sites'}).click();await p.waitForFunction(()=>document.querySelector('.shadow-surface canvas')?.dataset.renderer==='webgl2');
 // Releasing the thumb without moving it must still restore full resolution.
 const thumb=await p.getByRole('slider',{name:'Launch delay in days'}).boundingBox();
 await p.mouse.move(thumb.x+thumb.width/2,thumb.y+thumb.height/2);await p.mouse.down();await p.mouse.up();
 await p.waitForFunction(()=>document.querySelector('.shadow-surface canvas')?.height===512);
 await p.getByRole('slider',{name:'Launch delay in days'}).focus();await p.keyboard.press('End');
 await p.waitForFunction(()=>document.querySelector('.shadow-surface canvas')?.height===512);
 const before=await p.locator('.shadow-surface canvas').getAttribute('data-frame');await p.keyboard.press('Home');
 await p.waitForFunction(old=>document.querySelector('.shadow-surface canvas')?.dataset.frame!==old,before);
 await p.locator('.mapcard').screenshot({path:'.slide-tools/shadow-gpu.png'});
 await p.setViewportSize({width:1920,height:1080});
 await p.getByRole('button',{name:'WHOLE REGION',exact:true}).click();
 await p.waitForFunction(()=>{const c=document.querySelector('.shadow-surface canvas'),wrap=document.querySelector('.mapwrap');return c&&Math.abs(c.width/c.height-wrap.clientWidth/wrap.clientHeight)<.01});
 const layout=await p.evaluate(()=>{const card=document.querySelector('.mapcard'),map=document.querySelector('.mapwrap'),circle=map.querySelector('.ring'),style=getComputedStyle(card),ring=circle.getBoundingClientRect();return{contentWidth:card.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),mapWidth:map.offsetWidth,ringWidth:ring.width,ringHeight:ring.height}});
 assert.ok(Math.abs(layout.contentWidth-layout.mapWidth)<2,JSON.stringify(layout));
 assert.ok(Math.abs(layout.ringWidth-layout.ringHeight)<1,'distance rings must remain circular');
 await p.screenshot({path:'docs/map-full-width-preview.png'});
 // Force context loss and verify the worker eventually finishes the newest date at full resolution.
 await p.locator('.shadow-surface canvas').evaluate(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
 await p.getByRole('slider',{name:'Launch delay in days'}).focus();await p.keyboard.press('ArrowRight');await p.waitForFunction(()=>document.querySelector('.shadow-surface canvas')?.dataset.renderer==='worker'&&document.querySelector('.shadow-surface canvas')?.height===360);
 await p.setViewportSize({width:390,height:844});
 await p.waitForFunction(()=>{const r=document.querySelector('.mapwrap').getBoundingClientRect();return Math.abs(r.width-r.height)<2});
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile horizontal overflow');
 const fallback=await b.newPage();fallback.on('pageerror',e=>errors.push(e.message));
 await fallback.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:get.call(this,type,...args)}});
 await fallback.goto(base+'#compare');await fallback.locator('#intro .skip').evaluate(b=>b.click());
 await fallback.waitForFunction(()=>document.querySelector('.shadow-surface canvas')?.dataset.renderer==='worker'&&document.querySelector('.shadow-surface canvas')?.height===360);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({parity:cases,keyboard:'passed',thumbRelease:'passed',contextLossFallback:'passed',noGPUFallback:'passed',pageErrors:errors}));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
