# The plan (distilled from the 31-page plan, `source/HackAthlone_2026_challenge_pick_and_build_plan.pdf`)

## Decision

Build **Challenge 11, Lunar Landing Site Navigator**, as a web tool with a physical
twin. Scored 41/50 against the next best 37 (Challenge 1 with NFC-tagged prints).
Confidence ~65 %, conditional on a team of 4+ with one person owning ephemeris and
horizon maths and one owning the front end.

**Switch rule.** If by Fri 21:00 the team is 3 or fewer and nobody is comfortable with
vectors and coordinate frames: drop the motor, the camera and custom coordinates.
If nobody can own the ephemeris at all, switch to Challenge 1 with NFC-tagged prints.

Three corrections to the original sketch (all already applied below):
1. A lamp on an arm casts wrong shadows (2.05 deg near edge vs 1.23 deg far edge
   when truth is 1.54 deg). **Fixed lamp 3 m away, turntable under the model.**
   The Moon turns, the Sun stays.
2. A flat base is wrong by more than the whole effect (75 km from the pole the
   surface has curved away 2.47 deg). **Print the terrain on its spherical cap.**
3. Hardware is not the product. Software answers the challenge with the table
   unplugged. Hardware <= 1/3 of team hours. First version motor-free.

Dropped: the second arm with an Earth LED. Photodiode pins replaced by one overhead
webcam de-rotated in software.

## Concept: Long Shadow (working name)

**Pitch.** Long Shadow shows, for any lunar south pole site and date, how many hours
of sunlight and Earth contact you get and what a launch slip does to them, on screen
and on a scale model of the real terrain turning under a fixed Sun.

**Wow moment.** A judge slips the landing date by a few days. The table turns, a
ridge shadow crosses the site pin, the sunlight bar collapses. Pick the neighbouring
site and it stays lit.

**Hooks (verified 9 Nov).**
- IM-2 Athena, 6 Mar 2025: came down ~250 m from target inside a crater at Mons
  Mouton, on its side; mission ended ~13 h later. Tipping over was the main cause;
  the shadowed crater made it unrecoverable. Say it exactly like that.
- Chang'e 7, heading for the rim of Shackleton, missed its 23-24 Aug 2026 launch
  window with no new date. That is the statement's "dates slip" problem.

**Users.** Primary: a mission analyst or student planner re-checking a shortlist
after a slip, wanting a first answer in seconds before opening Quickmap or Horizons.
Secondary: teachers and the public; the table makes polar lighting obvious without maths.

**How the twin is driven.** Two numbers from the ephemeris run the rig:
sub-solar **longitude sets the table angle**, sub-solar **latitude sets the lamp
height**. Turning the table is the lunar day (1 deg = 1.97 h). Raising/lowering the
lamp is the lunar year. Lamp below table level = polar winter, only high rims lit.

## Scope

### MVP, must exist by Sat 18:00 (complete, submittable, hand-turned table)

Software:
- 8 curated sites with precomputed horizon masks: 720 azimuths at 0.5 deg, 80 m DEM.
- Hourly Sun and Earth azimuth/elevation 2025-2030 from the SPICE table.
- One screen: polar map with site pins, 360 deg horizon panorama with Sun and Earth
  tracks, one-month timeline strip of lit and Earth-visible hours.
- Four numbers per site: sunlit hours next 30 days, longest dark gap, Earth contact
  hours, time to next sunset or Earthset.
- **Two sites side by side with a date slip slider +/- 60 days. This is the product.**
- Validation table against JPL Horizons for 3 sites, visible in the app.
- Static site deploy, public repo with a licence file.

Hardware:
- One printed relief: 150 mm disc, 1 mm = 1 km, vertical exaggeration 3, terrain on
  its spherical cap, matte grey.
- Hand-turned table with a degree ring. Lamp 2-3 m away on a stand with marked
  heights. Black hood.
- App prints "table to X deg, lamp to Y mm" for the chosen date.
- A 20 s phone clip of the shadow sweep, shot the moment it first works (insurance).

### Target, by Sun 06:00
- Stepper drive over WebSerial: the date slider turns the table.
- Overhead webcam view de-rotated in the browser beside a software shadow map.
- Sun as a 0.53 deg disc: report fraction visible, not lit/dark.
- Custom coordinates by clicking the map; horizon computed in browser from 240 m DEM.
- Mast height input: 2 m and 10 m.
- Permanently shadowed region overlay; one published benchmark reproduced.
- Project page text, 30 s video, 7 slides.

### Stretch
LEDs under site pins showing the software prediction · motorised lamp lift ·
window finder (dates with >= N h of Sun and Earth together) · real LRO photo vs
software vs table · second closer print of Shackleton and the connecting ridge.

### Cut order (first to go at the top)
1. Anything physical for Earth. Never build the second arm.
2. Lamp lift motor.
3. Site LEDs.
4. Mast height.
5. Custom coordinates.
6. Webcam overlay.
7. Stepper (table stays hand-turned).
8. The 240 m far-field tier.

**Never cut:** Horizons validation table, two-site slip comparison, the print, the video.

### Gates

| When | Check | If it fails |
|---|---|---|
| Fri 23:30 | Full-size print is running | Shrink to 120 mm, or two halves on two printers |
| Sat 00:00 | First Sun elevation compared with Horizons | Science stops everything else until it matches |
| Sat 12:00 | Agreement with Horizons better than 0.05 deg | Use Horizons tables directly for the 8 sites, drop custom coordinates |
| Sat 18:00 | MVP review, all hands, 30 min | Unfinished MVP items simplified, not extended |
| Sun 02:00 | Feature freeze | Bug fixes only |
| Sun 06:00 | Code freeze | Pitch only |

## Roles (team of 4; rename when known)

- **Hardware (Davit):** print, table, lamp, firmware, camera mount.
- **Science:** DEM handling, ephemeris, horizon masks, validation.
- **Web:** the app, WebSerial, deployment.
- **Story:** pitch, video, project page, references log, mentor liaison.

3 people: Story folds into Web by day and Hardware for the video; no stepper, no webcam.
5 people: second web developer takes the shadow map and webcam view.
6 people: sixth owns DEM-to-print and validation figures, freeing Science for horizon code.

## Long poles, in the order they bite
1. **Print**: 2-4 h on a fast printer, 6-9 h on an older one, +1 h primer. Two copies, two printers.
2. **Ephemeris frames and signs**: budget 4 h.
3. **Data**: 391 MB for the two DEMs on Wi-Fi shared by 200 people. Bring it on a USB stick.
4. **Rig alignment**: 2 h Sat morning (table zero, lunar 0 deg longitude, lamp height zero).
5. **Stepper + WebSerial integration**: 3 h Sat afternoon, fixed **16:00 integration slot**.
6. **Video**: shoot Saturday evening. A Sunday morning shoot will not happen.

## Schedule

| Time | Hardware | Science | Web | Story |
|---|---|---|---|---|
| Fri 16:00-19:55 | Walk the makerspace: printers, nozzle, filament, queue. Claim two printers. Find stepper + driver | Start DEM downloads (or copy USB) | Claim a table by a wall socket with 3 m clear floor | Pitch-Fest 19:20. Recruit maths/physics + front-end if short |
| Fri 19:55-21:00 | Heightmap-to-mesh script: spherical cap, k=3, 3 mm base. Slice a 60 mm test coupon | Load 80 m DEM, crop 150 km square, hand Hardware a 16-bit heightmap by 20:45 | Scaffold app, deploy empty page | Site list: 8 sites, coordinates, source link each. Start references log |
| Fri 21:00-23:30 | Coupon on printer A (~30 min), check under a torch at 5 deg. Full print on A by 23:00, copy on B by 23:30 | SPICE Sun/Earth in MOON_ME, site vector, az/el. **First Horizons comparison before midnight** | Polar map from DEM hillshade, site pins | One-page storyline; IM-2 and Chang'e 7 facts with sources |
| Fri 23:30-Sat 03:00 | Table: bearing, platter, degree ring, zero mark. Lamp stand with height scale. Hood. Sleep 03:00-07:30 | Horizon ray-march for 8 sites, masks as JSON. Ephemeris table as binary | Panorama and timeline on real masks and ephemeris | Sleep 00:30-05:30 |
| Sat 03:00-07:30 | Asleep | Validation: 3 sites, 30 days hourly vs Horizons. Check printers every 45 min. Sleep 07:30-11:00 | Metrics and two-site comparison. Sleep 05:30-09:30 | Up 05:30. Project page draft. Watch printers |
| Sat 07:30-11:00 | Print off bed. Light sand, matte primer outdoors (45 min dry). Assemble hand-turned rig | Asleep | 09:30: date slip slider, redeploy | 08:00 mentor breakfast: find space/astronomy/GIS people. Create project entry at 09:00 |
| Sat 11:00-14:00 | Lamp at 3 m. Align lunar 0 deg lon with table zero. First shadow test. **Shoot the 20 s insurance clip** | Solar disc fraction. 240 m far-field tier | "Table to X, lamp to Y" panel. Loading and empty states | A mentor red-teams the validity story. Slides v0 |
| Sat 14:00-18:00 | Firmware: line protocol, zero command, couple stepper. **Integration 16:00** | PSR overlay. Reproduce one published illumination result. Horizon function for custom coordinates | WebSerial connect button, slider bound to table. **Integration 16:00** | Skip bootcamps. First timed pitch 17:00 |
| Sat 18:00-18:30 | **MVP gate, all hands** | | | |
| Sat 18:30-21:00 | Shoot video on the rig with Story 19:00-20:30, hood on | Mast height. Uncertainty numbers 80 m vs 240 m masks | Software shadow map of the printed region. Screen captures | Directs the shoot from the shot list |
| Sat 21:00-23:30 | Webcam mount centred on table axis | Data attribution in app. Sleep 23:00-03:00 | Webcam canvas, de-rotated beside shadow map | 21:30 dry-run pitch to a mentor. Video edit v1. Sleep 23:30-04:00 |
| Sat 23:30-Sun 03:00 | Site LEDs only if every target is green, else re-shoot weak shots. Sleep 03:00-06:30 | Asleep until 03:00 | **Feature freeze 02:00.** Projector and phone layout check | Asleep until 04:00 |
| Sun 03:00-06:00 | Asleep | Re-run the whole validation on the final build. README, licence, AI disclosure | Bug fixes only. Sleep 04:00-07:30 | 04:00: final slides, video exported at 29 s with subtitles, project page text |
| Sun 06:00-08:00 | 06:30 rig check, pack on one carry board, 60 s setup drill twice | Q&A sheet: 10 hard questions, one-line answers | Asleep until 07:30 | **06:00 team confirmation** at support desk. Draft presentation in **before 07:00** |
| Sun 08:00-10:30 | **All: timed dry run with assigned mentor at 08:00.** Fix what they flag, two more timed runs. **Submit on spaceappschallenge.org by 10:00** | | | |
| Sun 10:30-11:30 | **All: brunch.** Laptop charged, video stored locally, app running offline, rig by the door. Assume you present first | | | |

## House rules
- Never fewer than two people awake.
- Everyone gets at least 3.5 h each night; the presenter gets the most on Saturday.
- Commit every hour. One main branch that always deploys.
- A mentor sees the validity story Saturday morning, not Sunday.
