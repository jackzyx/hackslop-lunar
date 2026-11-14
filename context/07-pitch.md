# Pitch, video, slides

Owner: Story. Skill: `pitch-video`. Practise against the `judge` agent.
Plan: a 3-minute pitch with 2 minutes of questions; the app on the
projector; submit the **video, not slides**, to global judging.

Confirm with the organisers on Friday: pitch and Q&A length, slides/live demo/both,
projector input, can lights be dimmed, presenting
order, how People's Choice is voted. (Finals: 270 min for all teams, so ~5-7 min each
including changeover.)

## Pitch-Fest, Friday 19:20 (30 seconds)

Take it even if the team is full: 200 voters hear "the Moon table" 40 hours before they vote.

> "At noon today the Sun over Athlone is 18 degrees up. At the Moon's south pole it
> never climbs above one and a half. We're building a tool that tells a mission where
> the sunlight and the Earth will be when the launch slips, and a 3D-printed south
> pole that turns under a lamp so you can watch it happen. We need [a front-end dev /
> someone who likes maths]. Come find the Moon table."

## Local pitch, 3 minutes

| Time | Say | Show |
|---|---|---|
| 0:00-0:20 | "At noon today the Sun over Athlone is about 18 deg up. At the Moon's south pole it never climbs above 1.6 deg. A 5 km mountain there throws a shadow 186 km long." | App on the projector: the shadow map at landing |
| 0:20-0:45 | IM-2 came down off target, on its side in a crater, and operated for about 13 hours. Chang'e 7 missed its 23-24 August 2026 launch opportunity. Every slip changes the lighting, and today's tools are built for experts | One slide, two photos |
| 0:45-1:45 | Pick two sites. Slide the date. Hours of Sun and Earth contact update. On the map a ridge shadow takes site A's pin; site A goes red, site B holds | App |
| 1:45-2:20 | "Our Sun and Earth angles match JPL Horizons within X deg. Terrain is NASA LOLA at 80 m. We do not model power or radio links." | Validation table |
| 2:20-2:45 | Planners get a first answer in seconds. It runs in any browser, offline, and the code is open | QR code to the repo |
| 2:45-3:00 | One line, then ask for the vote | Team and URL |

X is the number measured on Saturday. **Do not say it until you have it.**

Note on "1.5 vs 1.6 deg": NASA's public line is "about 1.5 degrees" (the Moon's axis is
tilted 1.54 deg to the ecliptic). Our kernels give a sub-solar latitude extreme of
1.59 deg over 2025-2030, and 1.557 deg this weekend. Either is defensible; say the one
your app shows and be ready to explain the difference.

## Q&A: one-line answers to prepare before Sunday

1. Why no physical model? (Software answers the challenge. A 1 mm = 1 km print resolves ~400 m, coarser than IM-2's 250 m miss.)
2. How accurate is it, and how do you know? (V1 number vs Horizons; V3 horizon RMS; V4 benchmark.)
3. Do the site numbers come from the shadow map? (No. The map is a 500 m picture of the landing instant; the numbers come from the 80 m horizon masks.)
4. Did you account for the Moon's curvature and the size of the Sun's disc? (Curvature drop s^2/2R and a per-pixel Sun elevation; Sun as a 0.53 deg disc.)
5. What about Earth communication beyond line of sight? (Not modelled; line of sight only, stated on screen.)
6. What did you build this weekend and what did you reuse? (Libraries + NASA data; all code this weekend; references list.)
7. Where did AI tools help? (Honest list from the AI log.)
8. Who would open this on Monday morning? (A CLPS mission analyst re-checking a shortlist after a slip; a teacher.)
9. Why MOON_ME and not IAU_MOON? (LOLA DEMs are in MOON_ME; PA vs ME is 0.029 deg, ~875 m.)
10. What does a 0.1 deg horizon error do? (Moves a sunset by hours, sometimes days: that is why we show uncertainty.)

## 30-second video (global judges see this and the project page)

| Seconds | Shot | Burned-in subtitle |
|---|---|---|
| 0-3 | Black frame. The shadow map fades up: a low Sun lights only the crater rims. Close-up | "At the Moon's south pole the Sun never climbs above 1.6 deg." |
| 3-8 | Whole region. Date dragged through one lunar month, sped up. Shadows sweep the craters. Date in the corner | "One lunar day on real NASA LOLA terrain." |
| 8-14 | Close-up on the two sites. The slip slider moves; a ridge shadow crosses site A's pin | "The launch slips. A ridge shadow takes site A." |
| 14-21 | The two site cards. Site A's sunlight number collapses, site B holds | "Site A loses the Sun. Site B does not." |
| 21-26 | Validation card | "Sun and Earth angles within X deg of JPL Horizons." |
| 26-29 | URL on screen over the map | "Open source. Runs in any browser, offline." |

Capture notes: screen capture at native resolution; only on real data (no MOCK DATA
badge in shot); drag slowly and speed it up in the edit; must work with the sound off,
all meaning in English subtitles; open on the light, not a logo; **export at 29 s**;
no AI-generated imagery (or visibly watermarked); any music free to use and cited.
Capture Saturday 19:00-20:30. A Sunday morning capture will not happen.

## Seven slides (local pitch, and global fallback)

1. Title, one-line pitch, the shadow map.
2. Problem: IM-2, Chang'e 7, and why existing tools are slow for comparison.
3. The tool: the slip comparison screenshot.
4. The shadow map: real LOLA terrain at the landing instant, Sun per pixel, curvature included.
5. Validity: Horizons table, LOLA products, limits.
6. Impact: who uses it, open code, runs offline from a USB stick.
7. Data, tools, AI disclosure, team, links.

## People's Choice (EUR 500)

- Use the Friday Pitch-Fest slot even if the team is full.
- Keep the app open on a laptop at our table all Saturday and let people drag the slip. Every visitor is a voter.
- In the final, let someone in the audience choose the slip.
- One memorable line, said twice.

## Most Viral Post (EUR 50)

Cap effort at 30 minutes. Post an 8-10 s vertical screen clip of the shadow sweep on the
map on Saturday. Tag Instagram @spaceappsathlone, X @hack_athlone,
TikTok @spaceapps.athlone and #SpaceApps. Ask how "viral" is measured. The real
return is awareness for People's Choice.

## Prize targets (realistic)

Best Storytelling and Creativity, People's Choice, outside chance at Best Use of Open
Data. Podium ~25 %, at least one EUR 500 prize ~45 %, global nomination 15-20 % (base
rate 10 %). Halve all three if the MVP is not done by Sat 18:00. (Judgement, not data.)
