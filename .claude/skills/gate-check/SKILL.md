---
name: gate-check
description: Run a schedule/gate review for the HackAthlone Long Shadow build - compare the current time and repo state against the plan's gates (Fri 23:30 print, Sat 00:00 Horizons, Sat 12:00 0.05 deg, Sat 18:00 MVP, Sun 02:00 feature freeze, Sun 06:00 code freeze), apply the cut order, and say what each role should do next. Use when someone asks "where are we", "what should I do now", "are we on track", or at each gate.
---

# Gate check

1. Get the current Irish time (`TZ=Europe/Dublin date`). Read `context/03-plan.md`
   (gates, cut order, schedule) and `git log --since="3 hours ago" --oneline`.
2. Identify the last passed and the next gate:

| When | Check | If it fails |
|---|---|---|
| Fri 23:30 | Full-size print is running | Shrink to 120 mm, or two halves on two printers |
| Sat 00:00 | First Sun elevation compared with Horizons | Science stops everything else until it matches |
| Sat 12:00 | Agreement with Horizons better than 0.05 deg | Use Horizons tables for the 8 sites, drop custom coordinates |
| Sat 16:00 | Stepper + WebSerial integration slot | Table stays hand-turned (cut #7) |
| Sat 18:00 | MVP review, all hands, 30 min | Unfinished MVP items simplified, not extended |
| Sat 19:00 | Video shoot starts | Use the Saturday insurance clip + screen captures |
| Sun 02:00 | Feature freeze | Bug fixes only |
| Sun 06:00 | Code freeze; team confirmation at Atrium X | Pitch only |
| Sun 07:00 | Draft presentation submitted | Lose the 08:00 mentor dry run |
| Sun 10:00 | Submitted on spaceappschallenge.org | Hard close 23:59 |

3. Walk the MVP list (plan, Scope) and mark each item done / in progress / not started
   from evidence in the repo (files, deploy URL, validation output), not from memory.
4. If behind, apply the **cut order** strictly (Earth hardware, lamp motor, site LEDs,
   mast height, custom coordinates, webcam overlay, stepper, 240 m tier). Never cut:
   Horizons validation table, two-site slip comparison, the print, the video.
5. Output: one line per role (Hardware, Science, Web, Story): the next concrete task,
   who, and the deadline. Then any rule risks (references log stale? AI log? sleep plan:
   never fewer than two awake, everyone >= 3.5 h).
Keep it under 25 lines.
