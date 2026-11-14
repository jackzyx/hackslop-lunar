# Risks, fallback, red team

Hardware was dropped Sat 14 Nov 10:15. That removed the two risks most likely to sink us
(the print queue and hardware eating the team).

## Risk register

| # | Risk | Likelihood | Impact | Mitigation | Fallback |
|---|---|---|---|---|---|
| 1 | Print fails, or 50 teams queue for the printers | Gone: hardware dropped Sat 14 Nov | | | |
| 2 | Hardware eats the team | Gone: hardware dropped Sat 14 Nov | | | |
| 3 | Frame or sign error in the ephemeris survives to Sunday | Medium | Critical | Horizons comparison by Fri midnight. Automated re-run before the freeze | Ship Horizons tables for the 8 curated sites; drop custom coordinates |
| 4 | Pitch room defeats the screen: bright lights, no setup time, judges 6 m away | Medium | High | Dark theme, large numbers. 60 s setup drill (laptop, projector, app offline). Ask organisers | Play the video |
| 5 | Software looks thin next to teams who built for weeks | High | High global, medium local | Compete on the slip comparison, visible validation and the shadow map, not features | Treat global nomination as a bonus; optimise for the room |
| 6 | Wi-Fi collapses during downloads or the demo | Medium | Medium | Data on two laptops and a USB stick. App works fully offline | Phone tether |
| 7 | Tired pitch runs over, or presenter can't answer a science question | Medium | High | Sleep plan. Three timed runs. Mentor dry run 08:00. Science owner takes technical questions | Cut the live demo, show the video |
| 8 | Rule breach: undisclosed AI, missing references, video over 30 s, disallowed pre-event work | Low-medium | Critical (ineligible) | Ask organisers. References log from hour one. Export video at 29 s. Licence file | None. Prevent it |
| 9 | Registration not confirmed (waitlist/cancelled) for a team member | Check now | Critical for that person | Check Space Apps profile before travelling; email organisers | Join a confirmed member's team on the portal |

## The demo (software only)

1. The web app with 8 sites, the two-site slip comparison and the validation table.
2. The shadow map: real LOLA terrain (500 m, +/- 250 km) lit for the landing instant,
   each pixel marched toward the Sun with the curvature drop (`web/src/shadow.js`,
   ~90 ms a frame). The slip slider moves the shadows.
3. If the laptop or projector fails: the 29 s video.

## Red team: five reasons this loses

1. **The software is thin.** Public repos already ship nested 5 m terrain, window finders,
   Deep Space Network modes, a +/- 60 day slip slider (see `09-competitors.md`). With the twin
   gone, our differentiators are validation visible on screen and the slip comparison.
   pythonhack000 also ray-marches shadows on LOLA terrain, so the map alone is not one.
2. **The room beats the screen.** Bright room, 5 minutes, judges at the back. Small text
   and thin lines vanish on a projector.
3. **No local angle.** 2025 winner mapped Shannon flooding. Lunar lighting has a small
   user base, so Impact is the weakest criterion and Local Application is out of reach.
   The Athlone Sun line is a hook, not an application.
4. **One hard question.** Curvature, Sun's disc, mast height, reference frames. If the
   presenter stumbles, Validity collapses.
5. **Team and time.** Three people, two short nights, teammates first met on Friday.
   Real data lands late and the video never gets shot.

## What the Athlone winner probably builds (prediction)

An Earth-observation tool with a midlands story and a named local user, from a team with
a postgrad or two. Most likely Challenge 5 (NISAR, sequel to last year's Sentinel-1
winner, pointed at Shannon flooding or bog subsidence); next Challenge 6 (Field Shift,
Irish farms). A clean map app with a strong narrative takes Local Application and
competes on Impact. We beat it on Creativity and Presentation, and on Validity only if
our checks are on screen.
