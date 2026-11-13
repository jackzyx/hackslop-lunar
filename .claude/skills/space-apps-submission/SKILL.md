---
name: space-apps-submission
description: Prepare and check the NASA Space Apps 2026 project submission and repo for release - project page text, NASA data section, references, AI disclosure, licence, README, video link, team confirmation and deadlines. Use when writing the project page or README, before making the repo public, or when checking eligibility rules.
---

# Space Apps submission (Story owns; everyone checks)

Checklist: `context/10-submission.md`. References: `context/references.md`.
Deadlines: portal opens Sat 09:00; **our target Sun 10:00**; hard close Sun 23:59.
Sun 06:00 team confirmation at Atrium X; Sun 07:00 draft for the 08:00 mentor dry run.

## Before writing the page

1. Re-read the 2026 Project Submission Guide and the challenge Resources tab (both
   published around 13 Nov) and update `context/10-submission.md` if anything differs.
2. Collect the measured numbers: V1 (Horizons max/RMS), V3 (80 vs 240 m RMS), V4
   (benchmark), V6 (table vs software). No number without a source.

## Project page skeleton

- **Summary (2-3 sentences):** problem (polar lighting + slips), what we built (slip
  comparison + lunar heliodon), why it matters (first answer in seconds).
- **How it works:** SPICE ephemeris (MOON_ME, DE440) + LOLA PGDA 90 terrain -> horizon
  masks -> hourly Sun/Earth visibility; static web app, offline; the table driven by
  two numbers (sub-solar lon -> table, lat -> lamp).
- **Validation:** the in-app table in words; what is not modelled.
- **NASA data:** each product with link (see references).
- **Impact:** mission analysts after a slip; teachers ("print your own south pole").
- **Links:** video (29 s), live app, public repo with LICENSE, STL + build guide, slides.
- **AI use:** honest list (tools, tasks, people). Pull from the AI section of references.

## Before making the repo public

- `git rm -r context/` (internal strategy and personal names) or move public-safe
  parts to `docs/`. Remove `context/source/` PDFs.
- LICENSE present; README has run-offline and rebuild-data instructions, data
  attribution, validation numbers, limits, AI disclosure.
- No secrets, no data files, no large binaries (STL under ~50 MB is fine).
