# Handoff: build the Long Shadow app mockup

Written Fri 13 Nov 2026, late evening, for a fresh Claude Code session in this repo.
Read `CLAUDE.md` first; it is the rulebook. This file tells you what was decided
tonight and what to build next.

## Your task

Build a clickable mockup of the web app in `web/` (Vite, Node 20+), running locally
and offline. It must show the one screen the product is: two lunar south pole sites
side by side with a launch-delay slider. Done means: `npm run dev` serves the screen,
the slider moves, the numbers and bars change, and it is committed.

The science pipeline does not exist yet, so the mockup runs on placeholder data.

## What the project is (one paragraph)

Long Shadow answers NASA Space Apps Challenge 11, Lunar Landing Site Navigator. For a
lunar south pole site and date it shows hours of sunlight and of direct Earth contact,
and what a launch delay does to them. A 3D-printed relief of the real terrain turns
under a fixed lamp so a real shadow crosses the site pin. The software must fully
answer the challenge with the hardware unplugged.

## Decisions made tonight (these override older text in `context/`)

1. **Stay on Challenge 11.** Goal is the local podium (3-minute pitch, 2 minutes of
   questions, generalist judges). Podium has meant NASA Global Nominee in past years.
2. **NFC is cut.** Do not build tag or reader support.
3. **Stepper and WebSerial are cut** unless the MVP is finished by Sat 18:00. The
   table is hand-turned. Do not mock up a serial connect button.
4. **No purchases.** Hardware is a venue 3D print (bare white PLA), a phone torch, a
   cardboard hood. The app only needs to print "table to X deg, lamp to Y mm".
5. **One headline number, shown large:** sunlit hours in the next 30 days, with a
   colour. The other three numbers go small beneath it: longest dark gap, Earth
   contact hours, time to next sunset or Earthset.
6. **A plain verdict per site**, for example "Holds through a 30-day delay" or
   "Goes dark after day 12". This is the Impact answer.
7. **Say "launch delay", never "slip"** in the UI. No jargon on the main screen
   (no SPICE, LOLA, heliodon, ephemeris). Those belong in the validation panel.
8. **Validation is one visible line** on the main screen ("Sun and Earth angles
   within X deg of JPL Horizons"), linking to the full table.
9. **Do not compete on 3D.** No globe, no surface view. Fast and 2D.

## What the mockup screen contains

Top to bottom:

- **Header:** product name, date picker for the planned landing date.
- **Launch-delay slider:** minus 60 to plus 60 days, shows the resulting date. This
  is the main control; it must respond instantly.
- **Two site columns, side by side.** Each has:
  - Site picker (8 curated sites; names are placeholders until Story supplies the list).
  - The headline number, large, coloured by how good it is.
  - The one-line verdict.
  - Three small numbers (see decision 5).
  - A one-month timeline strip: lit hours and Earth-visible hours as two bars.
  - A 360 degree horizon panorama: skyline curve with the Sun and Earth tracks over it.
- **Polar map** with the site pins, the two chosen sites highlighted.
- **Table panel:** "Table to X deg, lamp to Y mm" for the chosen date.
- **Validation line** and a link to the validation table (table can be a stub).
- **"What we do not model"** list: no power or thermal model, no link budget, no
  slopes or landing hazards, line of sight only.

It must read on a projector: large type, high contrast, works at 1280 x 720.

## Placeholder data rules (important)

- Every number in the mockup is fake. Put a visible **"MOCK DATA"** badge on screen
  until real data replaces it. Project rule: no number reaches the pitch unless the
  software computed it.
- Keep all fake data in one file, `web/src/mock-data.json`, shaped like the real
  files will be, so real data drops in without UI changes:
  - `sites`: id, name, lat, lon, and `horizon` (720 elevation angles in degrees, one
    per 0.5 deg of azimuth, clockwise from north).
  - `ephemeris`: hourly rows of time (UTC), Sun azimuth and elevation, Earth azimuth
    and elevation, per site.
  - `rig`: sub-solar longitude and latitude per hour (drives table angle and lamp height).
- Compute the displayed metrics in the browser from that data, not hard-coded, so
  the slider genuinely changes them.
- Make the fake data tell the story: one site that loses the Sun as the delay grows,
  one neighbour that stays lit.

## Open risks the mockup should not hide

- Nobody has yet confirmed that a real site pair shows this contrast. Science must
  find one in computed data; the mockup only illustrates it.
- Team size and who owns the ephemeris maths were unconfirmed at the time of writing.
- Whether a phone torch gives a visible shadow on the print is untested. If it does
  not, the on-screen shadow map (skill `shadow-map`) becomes the demo, so leave room
  for a shadow-map panel beside the polar map.

## Read these, in this order

1. `CLAUDE.md` (rules, ownership, architecture)
2. `context/03-plan.md` (scope, cut order, gates)
3. `context/02-challenge.md` (what the challenge asks, judging criteria)
4. `context/07-pitch.md` (the demo moment the screen must support)
5. `context/09-competitors.md` (what not to copy or chase)

## Skills to use

Project skills in `.claude/skills/` (invoke by name):

| Skill | Use it for |
|---|---|
| `shadow-map` | The top-down shadow map panel and the software-only fallback demo |
| `horizon-mask` | The shape of horizon data and how sunlit hours, dark gap, Earth contact and time to sunset are derived |
| `lunar-ephemeris` | The shape of the ephemeris table, azimuth and elevation conventions, sub-solar point |
| `twin-rig` | The "table to X deg, lamp to Y mm" formulas (ignore its stepper and WebSerial parts) |
| `horizons-validation` | How the validation table should look in the app |
| `lola-dem` | Hillshade or polar map tiles for the map, once real data is in |
| `gate-check` | Checking progress against the plan's gates |
| `pitch-video` | Screen-capture needs for the 29 s video |
| `space-apps-submission` | Licence, references and AI-disclosure rules before anything goes public |

General skills: `dataviz` before writing any chart code (timeline strip, panorama,
colour for the headline number), and `run` to launch and check the app.

Subagents in `.claude/agents/`: `judge` (ask it to react to the mockup as a judge
would) and `science-red-team` (not needed until real data arrives).

## Rules that still bind you

- Frames: `MOON_ME`, correction `LT+S`, azimuth clockwise from north, east-positive
  longitude. Label units and frames on anything technical.
- Keep the static, offline architecture: no backend, no runtime API calls.
- `data/` is never committed.
- Log AI use and every library in `context/references.md`.
- Commit every hour; `web/` belongs to the Web owner.
- Do not copy code or text from competitor repos.
