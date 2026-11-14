# Sun Shade (working name): HackAthlone 2026, Lunar Landing Site Navigator

NASA Space Apps Challenge 2026, Challenge 11, at HackAthlone (TUS Athlone, 13-15 Nov 2026).

> For any lunar south pole site and date: how many hours of sunlight and Earth contact
> you get, and what a launch slip does to them, on screen over the real LOLA terrain.

**This branch is the team's prep environment** (context, data scripts, Claude Code
skills). Product code starts when the hackspaces open (Fri 19:55) unless the organisers
say otherwise. `context/` is internal: remove it before the repo goes public.

## Get going (10 minutes, do it at home)

```bash
git clone <this repo> && cd HackAthlone-Lunar
scripts/setup.sh                 # Python venv + packages, SPICE kernels, core LOLA DEMs (~0.75 GB)
.venv/bin/python scripts/check_env.py   # must end with ALL REQUIRED CHECKS PASSED
```

Windows (PowerShell or cmd, no WSL needed):

```bat
py scripts\setup.py
.venv\Scripts\python scripts\check_env.py
```

Needs 64-bit Python 3.11-3.14 (python.org installer, tick "Add python.exe to PATH"),
Node 20+, git, and Chrome or Edge. The download is about 15 min from NASA's servers and
resumes if you run the same command again. `scripts/fetch_data.py [kernels|core|extra|big]`
fetches one tier.

## Read next

1. `context/00-start-here.md`: before-you-leave checklist, Friday timeline, first hour by role.
2. `context/03-plan.md`: scope, cut order, gates, schedule.
3. Your role's doc: Science `04-science.md` + `05-data.md`,
   Web `02-challenge.md` + skills, Story `07-pitch.md` + `10-submission.md`.
4. `STARS.md`: the in-app assistant (local LLM via Ollama, voice, demo script, limits).

## Using Claude Code here

`CLAUDE.md` gives Claude the whole project context. Project skills (loaded when
relevant, or ask for one by name):

| Skill | For |
|---|---|
| `lunar-ephemeris` | SPICE Sun/Earth az/el in MOON_ME, debugging table |
| `horizons-validation` | JPL Horizons API for lunar sites, V1-V8, in-app validation table |
| `lola-dem` | PGDA 90 DEMs, projection, crops, map layers |
| `horizon-mask` | 720-azimuth masks, Sun disc fraction, Earth visibility, site metrics |
| `shadow-map` | Browser shadow map of the real terrain (built: `web/src/terrain/shadow.js`) |
| `relief-print` | Spherical-cap STL, slicing, coupon, finishing (dropped Sat 14 Nov) |
| `twin-rig` | Firmware line protocol, AccelStepper, WebSerial client (dropped Sat 14 Nov) |
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
