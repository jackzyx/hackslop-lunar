# Risks, fallback, red team

The two risks most likely to sink us are the print queue and hardware eating the team.
Neither is technical.

## Risk register

| # | Risk | Likelihood | Impact | Mitigation | Fallback |
|---|---|---|---|---|---|
| 1 | Print fails, or 50 teams queue for the printers | High | High | Coupon first. Two printers in parallel from 23:00 Fri. 150 mm, not 200. Ask organisers about printer count and booking | Two halves -> 120 mm -> CNC foam if it exists -> paper hillshade on the table |
| 2 | Hardware eats the team, software stays thin | High | High | One owner. 1/3 of hours. Hand-turned MVP. The 18:00 gate | Freeze hardware at hand-turned; move Hardware owner to the app |
| 3 | Frame or sign error in the ephemeris survives to Sunday | Medium | Critical | Horizons comparison by Fri midnight. Automated re-run before the freeze | Ship Horizons tables for the 8 curated sites; drop custom coordinates |
| 4 | Pitch room defeats the table: bright lights, no setup time, judges 6 m away | Medium | High | Hood. Webcam view on the projector. 60 s setup drill. Ask organisers | Play the Saturday clip and hand the spare print to the judges |
| 5 | Software looks thin next to teams who built for weeks | High | High global, medium local | Compete on the slip comparison, visible validation and the twin, not features | Treat global nomination as a bonus; optimise for the room |
| 6 | Wi-Fi collapses during downloads or the demo | Medium | Medium | Data on two laptops and a USB stick. App works fully offline | Phone tether |
| 7 | Tired pitch runs over, or presenter can't answer a science question | Medium | High | Sleep plan. Three timed runs. Mentor dry run 08:00. Science owner takes technical questions | Cut the live demo, show the video |
| 8 | Rule breach: undisclosed AI, missing references, video over 30 s, disallowed pre-event work | Low-medium | Critical (ineligible) | Ask organisers. References log from hour one. Export video at 29 s. Licence file | None. Prevent it |
| 9 | Registration not confirmed (waitlist/cancelled) for a team member | Check now | Critical for that person | Check Space Apps profile before travelling; email organisers | Join a confirmed member's team on the portal |

## Software-only fallback demo

If the hardware is not presentable on Sunday, the demo is still complete:
1. The web app with 8 sites, the two-site slip comparison and the validation table.
2. The "virtual table": a top-down shadow map of the same region rendered in the browser
   by marching each pixel toward the Sun across the heightmap. 300 x 300 grid x ~200
   steps per pixel = ~18 M samples a frame, fast enough for a slider (skill `shadow-map`).
3. The 20 s clip from Saturday midday when the hand-turned table first worked.
4. The printed relief in the judges' hands, lit with a phone torch.

The virtual table is not wasted if the hardware survives: it is the right-hand panel
the webcam view is compared against.

## Red team: five reasons this loses

1. **The software is thin.** Public repos already ship nested 5 m terrain, window finders,
   Deep Space Network modes, a +/- 60 day slip slider (see `09-competitors.md`). Our only
   real differentiators are the twin and validation visible on screen.
2. **The room beats the table.** Bright room, 5 minutes, judges at the back. Without the
   webcam on the projector most voters see a grey disc.
3. **No local angle.** 2025 winner mapped Shannon flooding. Lunar lighting has a small
   user base, so Impact is the weakest criterion and Local Application is out of reach.
   The Athlone Sun line is a hook, not an application.
4. **One hard question.** Curvature, Sun's disc, mast height, reference frames. If the
   presenter stumbles, Validity collapses and the table becomes a prop.
5. **Team and time.** Four parallel workstreams, two short nights, teammates first met
   on Friday. The 16:00 integration slips to Sunday and the video never gets shot.

Softer sixth: a judge decides the table is decoration because the software doesn't need
it. Answer: it does two things a screen cannot: an independent physical cross-check, and
a teaching kit any school can print.

## What the Athlone winner probably builds (prediction)

An Earth-observation tool with a midlands story and a named local user, from a team with
a postgrad or two. Most likely Challenge 5 (NISAR, sequel to last year's Sentinel-1
winner, pointed at Shannon flooding or bog subsidence); next Challenge 6 (Field Shift,
Irish farms). A clean map app with a strong narrative takes Local Application and
competes on Impact. We beat it on Creativity and Presentation, and on Validity only if
our checks are on screen.
