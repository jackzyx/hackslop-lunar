# Pitch, video, slides

Owner: Story. Skill: `pitch-video`. Practise against the `judge` agent.
Plan: a 3-minute pitch with 2 minutes of questions; webcam view of the table on the
projector; submit the **video, not slides**, to global judging.

Confirm with the organisers on Friday: pitch and Q&A length, slides/live demo/both,
projector input, can the rig be pre-set in the room, can lights be dimmed, presenting
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
| 0:00-0:20 | "At noon today the Sun over Athlone is about 18 deg up. At the Moon's south pole it never climbs above 1.6 deg. A 5 km mountain there throws a shadow 186 km long." | Lamp on. Webcam view of the relief on the projector |
| 0:20-0:45 | IM-2 came down 250 m off target, in a crater, and was dead in 13 hours. Chang'e 7 missed its August window. Every slip changes the lighting, and today's tools are built for experts | One slide, two photos |
| 0:45-1:45 | Pick two sites. Slide the date. Hours of Sun and Earth contact update. The table turns, the shadow takes the pin, site A goes red, site B holds | App and table together |
| 1:45-2:20 | "Our Sun and Earth angles match JPL Horizons within X deg. Terrain is NASA LOLA at 80 m. Plastic and software agree within Y deg. We do not model power or radio links." | Validation table |
| 2:20-2:45 | Planners get a first answer in seconds. Any school with a 3D printer and a torch can build the table, because the files are open | QR code to the repo |
| 2:45-3:00 | One line, then ask for the vote | Team and URL |

X and Y are the numbers measured on Saturday. **Do not say them until you have them.**

Note on "1.5 vs 1.6 deg": NASA's public line is "about 1.5 degrees" (the Moon's axis is
tilted 1.54 deg to the ecliptic). Our kernels give a sub-solar latitude extreme of
1.59 deg over 2025-2030, and 1.557 deg this weekend. Either is defensible; say the one
your app shows and be ready to explain the difference.

## Q&A: one-line answers to prepare before Sunday

1. Why build hardware at all? (Independent physical cross-check, and a teaching kit any school can print.)
2. How accurate is it, and how do you know? (V1 number vs Horizons; V3 horizon RMS; V4 benchmark.)
3. Why exaggerate height by 3, and does that break the shadows? (Stretch light by the same k: e' = arctan(k tan e). Exact for parallel light.)
4. Did you account for the Moon's curvature and the size of the Sun's disc? (Cap in the mesh; 0.53 deg disc fraction.)
5. What about Earth communication beyond line of sight? (Not modelled; line of sight only, stated on screen.)
6. What did you build this weekend and what did you reuse? (Libraries + NASA data; all code this weekend; references list.)
7. Where did AI tools help? (Honest list from the AI log.)
8. Who would open this on Monday morning? (A CLPS mission analyst re-checking a shortlist after a slip; a teacher.)
9. Why MOON_ME and not IAU_MOON? (LOLA DEMs are in MOON_ME; PA vs ME is 0.029 deg, ~875 m.)
10. What does a 0.1 deg horizon error do? (Moves a sunset by hours, sometimes days: that is why we show uncertainty.)

## 30-second video (global judges see this and the project page)

| Seconds | Shot | Burned-in subtitle |
|---|---|---|
| 0-3 | Black frame. Lamp clicks on, grazing light rakes across the relief. Low angle, close | "At the Moon's south pole the Sun never climbs above 1.6 deg." |
| 3-8 | Top-down. One full turn of the table, sped up. Shadows sweep the craters. Date counter in the corner | "One lunar day on real NASA LOLA terrain. 1 mm = 1 km." |
| 8-14 | Split screen: de-rotated webcam left, software shadow map right, in step | "Left: plastic. Right: our model. Same Sun." |
| 14-21 | Screen capture. Two sites side by side, date dragged forward. Site A's sunlight bar collapses, site B holds | "The launch slips. Site A loses the Sun. Site B does not." |
| 21-26 | Validation card | "Sun and Earth angles within X deg of JPL Horizons." |
| 26-29 | A hand lifts the relief off the table. URL on screen | "Open source. Print your own south pole." |

Shooting notes: lock exposure and focus; tripod for every shot; hood on, room lights
off; shoot the sweep slowly and speed it up in the edit; must work with the sound off,
all meaning in English subtitles; open on the light, not a logo; **export at 29 s**;
no AI-generated imagery (or visibly watermarked); any music free to use and cited.
Shoot Saturday 19:00-20:30. A Sunday morning shoot will not happen.

## Seven slides (local pitch, and global fallback)

1. Title, one-line pitch, photo of the rig.
2. Problem: IM-2, Chang'e 7, and why existing tools are slow for comparison.
3. The tool: the slip comparison screenshot.
4. The twin: one photo and the two-number geometry.
5. Validity: Horizons table, LOLA products, limits.
6. Impact: who uses it, open files, print your own.
7. Data, tools, AI disclosure, team, links.

## People's Choice (EUR 500)

- Use the Friday Pitch-Fest slot even if the team is full.
- Keep the working rig on the table all Saturday and let people turn it. Every visitor is a voter.
- In the final, put the webcam on the projector and let someone in the audience choose the slip.
- Pass the spare print around the room.
- One memorable line, said twice.

## Most Viral Post (EUR 50)

Cap effort at 30 minutes. Post an 8-10 s vertical clip of the shadow sweep on Saturday
midday when the rig first works. Tag Instagram @spaceappsathlone, X @hack_athlone,
TikTok @spaceapps.athlone and #SpaceApps. Ask how "viral" is measured. The real
return is awareness for People's Choice.

## Prize targets (realistic)

Best Storytelling and Creativity, People's Choice, outside chance at Best Use of Open
Data. Podium ~25 %, at least one EUR 500 prize ~45 %, global nomination 15-20 % (base
rate 10 %). Halve all three if the MVP is not done by Sat 18:00. (Judgement, not data.)
