# Hardware: the lunar heliodon

Owner: Hardware. Skills: `relief-print`, `twin-rig`. Cap: 1/3 of team hours.
Build hardware only if all five hold: (1) it expresses the challenge's physics, not a
control surface; (2) a motor-free version works by Sat 18:00; (3) the software answers
the challenge with the hardware unplugged; (4) one owner, <= 1/3 of team hours;
(5) it reads on camera without narration.

**Say this before a judge does:** at 1 mm = 1 km with a 0.4 mm nozzle the print resolves
features of ~400 m and up. IM-2 landed 250 m off target. The table shows regional
shadowing and builds intuition. Every number in the pitch comes from the software.

## Geometry

```
 Lamp, fixed, 3 m from table             black hood, open toward lamp
 height sets the season                         [webcam] overhead, de-rotated
 +/-250 mm covers 2025-2030      parallel grazing light (<= ~4.8 deg at k=3)
   [] ==========================================>  /\_/\  LOLA relief on its cap
   |                                              [=======] turntable
 lamp set by hand            WebSerial ->  stepper   table angle sets the time
                                                   1 deg of turn = 1.97 h lunar day
 Web app (from the SPICE table): sub-solar lon -> table angle; sub-solar lat -> lamp height
```

- Scale: 1 mm = 1 km horizontally (s = 1e-6), vertical exaggeration k = 3.
- Disc: 150 mm (= 150 km square/disc centred on the pole; pole at the centre).
- Terrain on its **spherical cap** (formula in `04-science.md`), 3 mm base.
- Lamp height above the table's pole datum: `h = L * k * tan(beta)` where beta is the
  sub-solar latitude (lamp up for southern summer). L = 3 m, k = 3 -> 157 mm per degree
  of beta: +/- 242 mm at 1.54 deg, **+/- 250 mm at the real 2025-2030 extreme 1.59 deg**.
  At L = 2 m: +/- 167 mm. This weekend (beta = -1.557 deg): +245 mm at 3 m.
- Lamp below table level = polar winter, only high rims stay lit.
- Table angle = sub-solar longitude (MOON_ME). Align lunar 0 deg longitude to the table
  zero mark facing the lamp. Verify sign with one shadow on Saturday morning.
- At 3 m the lamp spreads 1.4 deg in azimuth and 0.04 deg in true elevation across the
  model. A lamp 300 mm from a 150 mm model gives 2.05 vs 1.23 deg: never do that.

## Build notes that save an hour each

- A flat surface lit at 4.6 deg receives 8 % of the beam. Room light washes out the
  shadows. **The hood is not optional.**
- Print at **0.16 mm layers or finer.** At 0.2 mm each layer step casts a 2.5 mm shadow
  at this lamp angle and shows as contour stripes on gentle slopes.
- Matte grey primer + light 400 grit sand kills gloss and softens layer lines.
- Lock phone exposure and focus for every shot (auto-exposure pumps as shadows move).

## Bill of materials

Kit covers controller, motor and print. Bring light, bearing, hood and paint (~EUR 40).

| Item | Source | Job | Fallback |
|---|---|---|---|
| Arduino Uno | Kit | Stepper control over USB serial | Own RP2040-Zero or Pico 2 W |
| Stepper + driver | Kit lists "stepper"; assume 28BYJ-48 + ULN2003 | Turns the table | Hand-turned table with degree ring; or own NEMA 17 + A4988/TMC2209 + 12 V |
| Separate 5 V for stepper | Bring: USB lead or power bank | Keep motor current off the Uno's 5 V pin; share ground | Kit 9 V into Uno barrel jack, motor on its own 5 V |
| Turntable bearing | Bring: lazy Susan bearing or cake stand | Low-friction, wobble-free | Printed ring with 6 mm BBs; printed pin and bushing |
| Platter + drive coupling | Print on site | Platter smaller than relief so low light is not blocked. Friction wheel + rubber band, or direct drive | Direct drive on motor shaft |
| Relief, 150 mm | Makerspace PLA, white or light grey | The model | Two halves on two printers -> 120 mm -> CNC foam -> paper hillshade + software only |
| Matte grey primer, 400 grit | Bring | Kill gloss, soften layers | Matte white acrylic + brush, or bare white PLA |
| Light | Bring: zoomable LED torch >= 500 lm | The Sun | Phone torch (needs hood + dark room) |
| Lamp stand | Bring: camera tripod or mic stand + ruler taped vertically | Fixed position, marked heights | Teammate, broom handle, tape marks |
| 3 m string or tape | Bring | Sets lamp distance anywhere | Count floor tiles |
| Hood | Bring: black foam board/card, black tape | Blocks room light | Cardboard box lined with black bin bags |
| Overhead camera | Bring: USB webcam on gooseneck or printed arm | De-rotated top view; how the room sees the table | Phone on a boom as webcam |
| Site pins | Bring coloured map pins; kit glue gun | Mark the 8 sites | Printed 1 mm pegs |
| Site LEDs (stretch) | Own WS2812B + Pico 2 W + 74AHCT125 | Show software's prediction per pin | Kit LEDs + resistors on Uno pins |
| Bench tools | Kit: soldering, multimeter, callipers, glue gun, jumpers, breadboard | Assembly | |
| Extension lead, 4 sockets | Bring | Lamp, laptops, charging | |
| Laptop with Chrome/Edge | Bring | WebSerial is Chromium desktop only | Test before Friday |
| A4 Fresnel sheet (optional) | Bring | Compact collimator so lamp sits ~40 cm away | Ignore if beam not clean |

Also bring: gaffer tape, masking tape, superglue, scalpel, zip ties, marker, USB hub,
HDMI and USB-C adapters, power bank, sleeping bag.

## Stepper facts (28BYJ-48 + ULN2003, if that is what the hackshop has)

- Nominal 4096 half-steps per output turn (0.088 deg/step); the real gear ratio is
  ~63.68:1, so ~4076 half-steps/turn. **Calibrate against the degree ring** (turn 360,
  count), store steps-per-rev in firmware.
- 5 V, ~240 mA. Max ~10-15 RPM; fine (a full table turn in ~5 s is plenty).
- Gear backlash ~1-2 deg: always approach a target from the same direction.
- Library: AccelStepper (`AccelStepper stepper(AccelStepper::HALF4WIRE, 8, 10, 9, 11);`
  note the IN1, IN3, IN2, IN4 pin order).

## Firmware line protocol (proposal; agree with Web before 16:00 Sat)

115200 baud, ASCII, newline-terminated, one command per line, one reply per command.

| Host -> device | Meaning | Reply |
|---|---|---|
| `HELLO` | Handshake | `OK LONGSHADOW <fw version> <steps_per_rev>` |
| `ZERO` | Current position is table 0 deg | `OK ZERO` |
| `GOTO <deg>` | Absolute table angle, 0-360, shortest path with fixed approach direction | `OK GOTO <deg>` when started, `DONE <deg>` when arrived |
| `POS?` | Query | `POS <deg>` |
| `SPR <n>` | Set steps per rev (calibration) | `OK SPR <n>` |
| `STOP` | Halt, release coils | `OK STOP` |
| anything else | | `ERR <reason>` |

De-energise coils when idle (28BYJ-48 gets hot). Web side: skill `twin-rig`.

## Rig alignment (Saturday morning, ~2 h)

1. Lamp at L = 3.00 m from the table axis, beam centred on the pole at datum height (h = 0).
2. Table zero mark points at the lamp. Lunar 0 deg longitude on the print aligned to it.
3. Set lamp height for the chosen date from the app ("table to X deg, lamp to Y mm").
4. V6: fix lamp height, turn the table, note the angle where 3 pins go dark; compare
   with software. Pass: within 5 deg.
5. V7: sweep lamp height over the full range at all table angles: Shackleton floor never lights.
6. Shoot the 20 s insurance clip the first time it works.
