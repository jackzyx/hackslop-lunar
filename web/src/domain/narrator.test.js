import { test } from "node:test";
import assert from "node:assert/strict";
import { narrate } from "./narrator.js";

const A = { name: "Ridge", now: 369, onTime: 369, d: 2 }, B = { name: "Rim", now: 200, onTime: 200, d: 0 };

test("on time: both totals, then the site a slip hurts first", () => {
  assert.equal(narrate(0, [A, B]), "On time: Ridge gets 369 h of sunlight, Rim 200 h. A 2-day slip drops Ridge below half.");
  assert.match(narrate(0, [{ ...A, d: null }, B]), /Rim is under half even on time\.$/);
  assert.match(narrate(0, [{ ...A, d: null }, { ...B, d: null }]), /Both stay above half through a 60-day slip\.$/);
});

test("a slip: crossing half, small changes hold, larger ones count hours", () => {
  assert.equal(narrate(3, [{ ...A, now: 310 }, { ...B, now: 205 }]), "Slip 3 days: Ridge drops below half, 369 h to 310 h; Rim holds at 205 h.");
  assert.equal(narrate(-1, [{ ...A, now: 400 }, { ...B, now: 170 }]), "Launch 1 day early: Ridge gains 31 h, now 400 h; Rim loses 30 h, now 170 h.");
  assert.match(narrate(5, [A, { ...B, now: 380 }]), /Rim climbs above half, 200 h to 380 h\.$/);
});
