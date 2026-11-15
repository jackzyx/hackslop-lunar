import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitForIntroStart } from './wait-for-start.js';

const overlay = (dataset = {}) => Object.assign(new EventTarget(), { dataset });
test('intro waits for input instead of starting when assets are ready', async () => {
  const element = overlay();
  let started = false;
  const pending = waitForIntroStart(element).then(value => { started = value; return value; });
  await Promise.resolve();
  assert.equal(started, false);
  element.dispatchEvent(new Event('intro:initialise'));
  assert.equal(await pending, true);
});
test('intro remembers a key pressed before the main module loaded', async () => {
  assert.equal(await waitForIntroStart(overlay({ initialised: 'true' })), true);
});
test('skip dismisses waiting and takes priority over an early key', async () => {
  assert.equal(await waitForIntroStart(overlay({ initialised: 'true', bootSkipped: 'true' })), false);
  const element = overlay();
  const pending = waitForIntroStart(element);
  element.dispatchEvent(new Event('intro:skip'));
  assert.equal(await pending, false);
});
