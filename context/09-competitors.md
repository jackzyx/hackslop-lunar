# Competing public repos (Challenge 11, checked 13 Nov 2026)

Global judges compare project pages. These teams started early; several have polished
apps. **We will not out-feature them in 40 hours.** We win on: the slip comparison as
the core interaction, validation visible on screen, and the physical twin that reads in
the first 5 seconds of video. Read their validation sections: they set the bar.

| Repo | What it has | Threat to us |
|---|---|---|
| [rodneymora94965/lunar-site-navigator](https://github.com/rodneymora94965/lunar-site-navigator) | Single-file offline web tool. Up to 3 sites side by side, hourly 2026-11 to 2045-10. Window calendar (arrival day x mission length 1-28 d). Visible solar disc fraction, Earth margin. **Validated vs Horizons at 20 dates x 3 sites, max 0.00003 deg**; Sun visibility vs LROC WAC illumination map (r 0.985); Sun and Earth vs PGDA 69 maps. Bilingual explainer video (3:28) | Highest on Validity. Our V1 pass mark of 0.01 deg looks weak next to this: aim for < 0.001 deg and add a PGDA 69 / LROC WAC comparison |
| [ziyadell/Lunar-Landing-Site-Navigator](https://github.com/ziyadell/Lunar-Landing-Site-Navigator) (LunaNav, Team AFUQ, afuq.website) | React/TS/Vite. 3D Moon (Orbit), surface view from 2 m with LOLA terrain to 150 km and cast shadows (Surface), two-scenario Analysis (region, start date, 7 d-1 y), 9 Artemis regions, Horizons fixture tests, narrated mission guide (ElevenLabs), URL state, CSV export | Most polished UI. Presentation |
| [pythonhack000/lunar-navigator](https://github.com/pythonhack000/lunar-navigator) | 3D Moon with LRO mosaic, south pole terrain mesh from 80 m LOLA, ray-marched shadows with penumbra, relief 1x/3x/5x switch, Google-Earth navigation, site picker + custom coords, Sun/Earth readouts with disc fraction and countdowns, horizon panorama | Visual wow on screen |
| [RicardoArg23/MoonSet](https://github.com/RicardoArg23/MoonSet) | FastAPI + React. Explorer mode (public/teachers) and Planner mode (exact numbers). DE421 + LOLA. "What if the mission is delayed" | Same concept, two audience modes |
| [Angel-A-V/lunar-landing-site-navigator](https://github.com/Angel-A-V/lunar-landing-site-navigator) | Website comparing two spots **plus a tabletop model**: lamp on a stepper-driven ring as the Sun, SG90 servo arm as Earth, printed terrain horizon wall, Arduino UNO Q. Horizons fetch script, skyline from LOLA | **The only other physical twin found.** Theirs is the lamp-on-an-arm design our plan rejected (wrong shadows). Our answer: fixed lamp at 3 m, turntable, relief on its spherical cap, heights exaggerated with the light (physically correct shadows). Say this if asked |
| [M9nx/lunar-landing-site-navigator](https://github.com/M9nx/lunar-landing-site-navigator) | Research-stage workspace: Docker API, JupyterHub, research notes on Site04, far-field plan, GitHub Pages static prototype. Delay presets 0-90 days | Research depth |
| [dagimfkadie/MoonSight](https://github.com/dagimfkadie/MoonSight) | Python app, PGDA 78 5 m site DEMs (Site01-42), demo script, NASA data citation file | Low |
| [nitrimandylis/space-apps-mockup](https://github.com/nitrimandylis/space-apps-mockup) | Mockup: 3D Sun, Earth and Moon showing power and comms windows | Low |
| [Arairo/NASA_SpaceApps_Lunar_Landing](https://github.com/Arairo/NASA_SpaceApps_Lunar_Landing) | Could not be cloned (private or removed) | Unknown |

Also named in the original plan: Ridgeline, LunaMission (nested 5 m terrain, window
finders, Deep Space Network modes, a +/- 60 day slip slider). Search GitHub for
"lunar landing site navigator" on Friday for new ones.

## Implications for the build

1. **Validation bar.** Target < 0.001 deg vs Horizons (proper TDB, LT+S, MOON_ME, site
   vector subtracted should get there). Add one illumination comparison against
   PGDA 69 `AVGVISIB_85S_060M_201608.TIF` (and/or LROC WAC
   `WAC_POLE_ILL_PCT_SOUTH_100M`) at our sites. Put the numbers on screen.
2. **Do not compete on 3D.** Others have 3D globes and surface views. Our "3D view" is
   real plastic. Keep the screen fast and 2D: map, panorama, timeline, two columns.
3. **Own the slip.** The two-site slip comparison must be the first thing on screen,
   instantly responsive, with the headline numbers changing as the slider moves.
4. **Teaching kit angle.** Open STL + build guide ("print your own south pole") is
   unique. Put the STL in the repo and on the project page.
5. Do not copy code or text from these repos (originality, licences). Reading them for
   ideas is fine; cite any idea we adopt in `references.md` if it is distinctive.
