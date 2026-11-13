# Long Shadow (working name): HackAthlone 2026, Lunar Landing Site Navigator

NASA Space Apps Challenge 2026, Challenge 11, at HackAthlone (TUS Athlone, 13-15 Nov 2026).

> For any lunar south pole site and date: how many hours of sunlight and Earth contact
> you get, and what a launch slip does to them, on screen and on a 3D-printed relief of
> the real LOLA terrain turning under a fixed lamp.

**This branch is the team's prep environment** (context, data scripts, Claude Code
skills). Product code starts when the hackspaces open (Fri 19:55) unless the organisers
say otherwise. `context/` is internal: remove it before the repo goes public.

## Get going (10 minutes, do it at home)

```bash
git clone <this repo> && cd HackAthlone-Lunar
scripts/setup.sh                 # Python venv + packages, SPICE kernels, core LOLA DEMs (~0.75 GB)
source .venv/bin/activate
python scripts/check_env.py      # must end with ALL REQUIRED CHECKS PASSED
```

Needs Python 3.11+, Node 20+, git, and Chrome or Edge (WebSerial). Copy `data/` to a USB stick.
Windows: use WSL2, or create the venv by hand and run `bash scripts/fetch_data.sh` from Git Bash.

## Read next

1. `context/00-start-here.md`: before-you-leave checklist, Friday timeline, first hour by role.
2. `context/03-plan.md`: scope, cut order, gates, schedule.
3. Your role's doc: Science `04-science.md` + `05-data.md`, Hardware `06-hardware.md`,
   Web `02-challenge.md` + skills, Story `07-pitch.md` + `10-submission.md`.

## Using Claude Code here

`CLAUDE.md` gives Claude the whole project context. Project skills (loaded when
relevant, or ask for one by name):

| Skill | For |
|---|---|
| `lunar-ephemeris` | SPICE Sun/Earth az/el in MOON_ME, rig drivers, debugging table |
| `horizons-validation` | JPL Horizons API for lunar sites, V1-V8, in-app validation table |
| `lola-dem` | PGDA 90 DEMs, projection, crops, heightmap for print, map layers |
| `horizon-mask` | 720-azimuth masks, Sun disc fraction, Earth visibility, site metrics |
| `shadow-map` | Browser "virtual table" shadow map, de-rotated webcam |
| `relief-print` | Spherical-cap STL, slicing, coupon, finishing |
| `twin-rig` | Firmware line protocol, AccelStepper, WebSerial client |
| `pitch-video` | 29 s video with ffmpeg, pitch, slides, rehearsal |
| `space-apps-submission` | Project page, references, AI disclosure, going public |
| `gate-check` | "Where are we?" against the gates and cut order |

Agents: `science-red-team` (run before every gate), `judge` (pitch and Q&A drills).

## Repo layout

```
CLAUDE.md              project brain for Claude Code
context/               event, challenge (verbatim), plan, science, data, hardware, pitch, risks,
                       competitors, submission, references log, source PDFs   [internal]
.claude/skills/        project skills          .claude/agents/   review agents
scripts/               setup.sh, fetch_data.sh, check_env.py
data/                  fetched data (gitignored)
requirements.txt       Python dependencies     LICENSE  MIT
```

## Data

All public NASA data: LOLA south pole DEMs (PGDA product 90, Barker et al. 2023),
LOLA polar illumination (PGDA 69, Mazarico et al. 2011), NAIF SPICE generic kernels
(DE440), JPL Horizons for validation. Full citations in `context/references.md`.
