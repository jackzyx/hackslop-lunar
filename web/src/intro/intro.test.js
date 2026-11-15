import { test } from "node:test";
import assert from "node:assert/strict";
import { introResolution, introTerrainView, createIntroClock, clippedImage, terrainBlend, terrainHandoff } from "./intro.js";

const near = (a, b, tol) => assert.ok(Math.abs(a - b) < tol, `${a} vs ${b}`);

test('intro detail covers a wider landing region without exceeding available terrain', () => {
  assert.deepEqual(introTerrainView({ cx: 10, cy: -20, half: 12 }), { cx: 10, cy: -20, half: 48 });
  for (const view of [{ cx: 0, cy: 0, half: 170 }, { cx: 220, cy: -30, half: 12 }]) {
    const detail = introTerrainView(view);
    assert.ok(Math.abs(detail.cx) + detail.half <= 248);
    assert.ok(Math.abs(detail.cy) + detail.half <= 248);
  }
});

test('terrain uses a soft approach edge, with full contrast only after covering every corner', () => {
  const approach = terrainBlend(400, 960, 540, 1920, 1080, 500);
  assert.equal(approach.detail, 0);
  assert.equal(approach.opacity, 1);
  const final = terrainBlend(1250, 960, 540, 1920, 1080, 108);
  assert.equal(final.detail, 1);
  assert.equal(final.opacity, 1);
  assert.equal(terrainBlend(100, 960, 540, 1920, 1080, 1800).opacity, 0);
  let previous = 0;
  for (let radius = 700; radius <= 1300; radius += 10) {
    const blend = terrainBlend(radius, 960, 540, 1920, 1080, 500);
    assert.ok(blend.detail >= previous && blend.detail <= 1);
    previous = blend.detail;
  }
});

test('intro clock resumes smoothly after a long frame or a hidden tab', () => {
  const clock = createIntroClock();
  near(clock(1000), 0, 1e-9);
  near(clock(1016), .016, 1e-9);
  near(clock(4016), .066, 1e-9); // a 3-second stall never skips 3 seconds of the intro
  near(clock(8016, true), .066, 1e-9);
  near(clock(8032), .082, 1e-9);
});

test('oversized lunar images are cropped to the visible viewport before drawing', () => {
  const crop = clippedImage(1000, 1000, -4500, -4500, 10000, 10000, 1000, 600);
  assert.deepEqual(crop, [450,450,100,60,0,0,1000,600]);
  assert.equal(clippedImage(100,100,2000,2000,100,100,1000,600), null);
  assert.deepEqual(clippedImage(100,100,20,30,200,200,1000,600), [0,0,100,100,20,30,200,200]);
});

test('intro final camera keeps every screen corner inside the detailed terrain', () => {
  for (const [w, h, dpr] of [[1920,1080,1], [3840,2160,2], [2560,1080,1], [390,844,3]]) {
    const q = introResolution(w,h,dpr);
    const longHalf = q.half * Math.max(w,h) / Math.min(w,h);
    assert.ok(Math.hypot(q.half, longHalf) < 250 * 0.94, 'corners must avoid the fading rim');
    assert.ok(q.terrain >= 800 && q.terrain <= 1280);
    assert.ok(q.sphere >= 768 && q.sphere <= 1536);
  }
});

test('terrain handoff lands all four edges on the planner map', () => {
  for (const [width, height, size, left, top, mapWidth, mapHeight] of [
    [1440, 900, 1440, 495.5, 260.25, 449, 449],
    [390, 844, 844, 17, 204, 356, 356],
    [1280, 720, 1280, 620, 155, 600, 550],
  ]) {
    const target = { left, top, width: mapWidth, height: mapHeight, right: left + mapWidth, bottom: top + mapHeight };
    const { x, y, scaleX, scaleY, tx, ty } = terrainHandoff(width, height, size, target);
    assert.ok(scaleX > 0 && scaleX < 1 && scaleY > 0 && scaleY < 1);
    assert.ok(x <= 0 && y <= 0 && x + size >= width && y + size >= height);
    near(x + tx, target.left, 1e-9);
    near(y + ty, target.top, 1e-9);
    near(x + tx + size * scaleX, target.right, 1e-9);
    near(y + ty + size * scaleY, target.bottom, 1e-9);
  }
});


test('wide map handoff preserves its aspect ratio while shrinking', () => {
  const target = { left: 680, top: 290, width: 1040, height: 650 };
  const aspect = target.width / target.height;
  const h = terrainHandoff(1920,1080,1200,target,aspect);
  near(h.scaleX,h.scaleY,1e-9);
  near(h.x+h.tx,target.left,1e-9);
  near(h.y+h.ty,target.top,1e-9);
  near(1200*aspect*h.scaleX,target.width,1e-9);
  near(1200*h.scaleY,target.height,1e-9);
});

