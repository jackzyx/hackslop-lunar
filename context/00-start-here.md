# Start here

Read this page first. Ten minutes. Then open your role's section of
`03-plan.md` and the matching skill in `.claude/skills/`.

## Before you leave home (Friday)

- [ ] **Registration.** Open your Space Apps profile. It must show the **Athlone Local
      Event as confirmed**, not waitlisted or cancelled. The organisers say only
      confirmed registrations get a place. Every team member checks their own.
- [ ] Team created on spaceappschallenge.org (max 6), Challenge 11 selected.
- [ ] Laptop with **Chrome or Edge** (WebSerial does not work in Firefox or Safari).
- [ ] Run `scripts/setup.sh` (Windows: `py scripts\setup.py`) on a good connection.
      It installs Python packages and fetches kernels and the core DEMs (~0.75 GB,
      about 15 min, resumable). Then `check_env.py` must end with ALL REQUIRED CHECKS PASSED.
- [ ] Photo ID, chargers, extension lead (4 sockets), sleeping bag.
- [ ] Hardware "Bring" list in `06-hardware.md` (torch 500+ lm, tripod/stand,
      3 m tape, black foam board, primer, 400 grit paper, lazy Susan bearing,
      USB webcam, map pins, gaffer tape, zip ties, power bank, USB hub, HDMI/USB-C adapters).
- [ ] Read the official challenge text once: `02-challenge.md`.

## Friday timeline (from the participation kit)

| Time | What | Where |
|---|---|---|
| 16:00 | Registration check-in: ID, T-shirt, merch | Engineering Building, TUS Athlone, N37 HD68 |
| 18:00 | Opening ceremony and HACK101 | Douglas Hyde Theatre, Main Building |
| 19:15 | PITCH101 | |
| 19:20 | **Pitch-Fest**: 30 s on stage. Take it even if the team is full ("the Moon table") | |
| 19:55 | **Hackspaces open** (first come, first served). Clock starts | |
| 21:00 | Pizza dinner (eat in shifts) | |

Saturday: 08:00 mentor breakfast (Atrium X), mentor slots 09-13, 14-18, 20-23,
project submission opens 09:00. Sunday: **06:00 team confirmation** at the
Atrium X support desk (one member, mandatory), 07:00 draft deadline for the
mentor dry run at 08:00, presentations from 11:30, awards 17:30.
Submission on spaceappschallenge.org closes Sun 23:59, **our target is 10:00**.

## First hour after 19:55, by role

**Hardware.** Claim two printers, ask about queue rules, slicer and overnight
printing. Find the stepper and driver in the hackshop. Then the heightmap-to-mesh
script (skill `relief-print`), test coupon by 21:00, full print running by 23:00
on printer A and 23:30 on printer B. Gate: Fri 23:30 full print running.

**Science.** Data should already be on disk. If not, start
`scripts/fetch_data.sh core` immediately (or copy from the USB stick). Load the
80 m DEM, crop a 150 km square, hand Hardware a 16-bit heightmap by 20:45 (skill
`lola-dem`). Then SPICE Sun/Earth in MOON_ME and the first Horizons comparison
**before midnight** (skills `lunar-ephemeris`, `horizons-validation`).
Gate: Sat 00:00 first Sun elevation agrees with Horizons.

**Web.** Claim a table by a wall socket with 3 m of clear floor on one side.
Scaffold the Vite app, deploy an empty page (public repo + licence), then polar
map from the DEM hillshade with site pins.

**Story.** Pitch-Fest at 19:20. Recruit a maths/physics person and a front-end
developer if short. Site list (8 sites, coordinates, a source link each). Start
`references.md` now. One-page storyline with the IM-2 and Chang'e 7 facts.

## Commands

```bash
scripts/setup.sh                 # venv + packages + kernels + core DEMs
source .venv/bin/activate
python scripts/check_env.py      # all green before you start
scripts/fetch_data.sh core       # (re)fetch DEMs only, resumable
```

Windows: `py scripts\setup.py`, then `.venv\Scripts\python scripts\check_env.py`;
`.venv\Scripts\python scripts\fetch_data.py core` re-fetches one tier.

## Open questions to close on Friday night

- Team size and names. Who owns Science (ephemeris + horizon maths)? If nobody,
  apply the switch rule in `03-plan.md`.
- Pitch length and Q&A, slides vs live demo, projector input, can the rig be
  pre-set, can lights be dimmed, presenting order, how People's Choice is voted.
- Printer count, models, slicer, filament colours, overnight printing, CNC?
- Hackshop stepper model (assumed 28BYJ-48 + ULN2003).
- Challenge **Resources tab** content (published Friday): diff it against
  `05-data.md` and add anything new to `references.md`.
- The 2026 Project Submission Guide (published 13 Nov): re-check video and
  slide limits in `10-submission.md`.
