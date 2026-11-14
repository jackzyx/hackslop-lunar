---
name: twin-rig
description: DROPPED Sat 14 Nov (software only, reference only). The physical twin rig (lunar heliodon) - lamp height and table angle from the ephemeris, Arduino/AccelStepper firmware for a 28BYJ-48 or NEMA 17 turntable, the ASCII line protocol, and the browser WebSerial client bound to the date slider. Use for firmware, WebSerial, stepper, calibration, alignment or "table to X, lamp to Y" work.
---

# Twin rig: firmware + WebSerial (Hardware + Web, integrate Sat 16:00)

> **Dropped Sat 14 Nov 10:15: software only.** Reference only, do not build.

Context: `context/06-hardware.md` (geometry, BOM, protocol, alignment).

## Driving numbers

- Table angle (deg) = sub-solar east longitude in MOON_ME, mod 360, relative to the
  table zero mark that is aligned with lunar 0 deg longitude facing the lamp.
  The Sun's sub-solar longitude decreases with time (~12.2 deg/day). The print is
  viewed from above with east increasing clockwise, so check on Saturday morning which
  way the platter must turn to keep the lit side facing the lamp; store the sign as one
  constant.
- Lamp height (mm) above the pole datum = L * k * tan(-beta), beta = sub-solar latitude.
  L = 3000 mm, k = 3: 157 mm per deg; this weekend about +245 mm. Lamp below datum =
  polar winter.
- App panel text: "Table to 126.6 deg, lamp to +245 mm (3.00 m, k = 3)".

## Firmware (Arduino Uno, AccelStepper)

- 28BYJ-48 + ULN2003: `AccelStepper stepper(AccelStepper::HALF4WIRE, 8, 10, 9, 11);`
  (IN1, IN3, IN2, IN4). ~4076 half-steps per rev (nominal 4096): calibrate with the
  degree ring, keep `steps_per_rev` in EEPROM or set via `SPR`.
- `setMaxSpeed(800)`, `setAcceleration(400)` (half-steps/s). `disableOutputs()` when idle.
- Backlash 1-2 deg: always finish a move in the same direction (overshoot then come back).
- Motor on its own 5 V supply, grounds shared with the Uno.
- Serial 115200, read lines into a buffer, parse: `HELLO`, `ZERO`, `GOTO <deg>`,
  `POS?`, `SPR <n>`, `STOP`; reply `OK ...`, `DONE <deg>`, `POS <deg>`, `ERR <why>`.
  Never block in `loop()`: call `stepper.run()` every iteration; send `DONE` when
  `distanceToGo()` hits 0.
- NEMA 17 + A4988/TMC2209: `AccelStepper stepper(AccelStepper::DRIVER, STEP, DIR);`
  200 steps x microsteps per rev, 12 V supply.

## WebSerial (Chrome/Edge desktop only, secure context)

```js
const port = await navigator.serial.requestPort();      // must be in a click handler
await port.open({ baudRate: 115200 });
const enc = new TextEncoderStream(); enc.readable.pipeTo(port.writable);
const writer = enc.writable.getWriter();
const dec = new TextDecoderStream(); port.readable.pipeTo(dec.writable);
const reader = dec.readable.getReader();
// read loop: accumulate chunks, split on "\n", dispatch replies
await writer.write(`GOTO ${angle.toFixed(2)}\n`);
```

- Debounce the slider (send on `change`, or throttle to ~5 Hz on `input`); only send
  the latest target; show "moving..." until `DONE`.
- The app must work with no port connected (button hidden or greyed, no errors).
- Feature-detect `"serial" in navigator`; show a one-line hint otherwise.

## Integration checklist (Sat 16:00)

1. `HELLO` handshake shows firmware version in the app.
2. `ZERO` at the aligned mark; `GOTO 90` turns the platter a quarter turn the right way.
3. Slider over 30 days -> table turns ~366 deg total; shadows move the right direction.
4. V6: three pins go dark within 5 deg of the software's prediction.
5. Unplug USB mid-move: app recovers, no crash.
