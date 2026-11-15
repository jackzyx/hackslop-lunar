# Sun Shade: pitch script (3:00 talk and demo, 2:00 Q&A)

Read aloud at about 150 words a minute. **Bold** = do this. Times are cumulative.
The deck is [sun-shade-pitch-v3.pptx](sun-shade-pitch-v3.pptx) (Morph transitions, builds play
on their own; advance manually). On slide 1 the Moon rises and the Sun catches its limb (about 3 s) while you open. The app stays open on the second screen the whole time.
Every number below comes from the app or `web/src/data/validation.json`. Do not add others.

Roles: **Speaker** talks and runs the deck. **Driver** runs the app on the second screen.

---

## Slide 1 · The problem (0:00 to 0:25)

> At the Moon's south pole the Sun never climbs more than about one and a half degrees
> above the horizon. A ridge a few kilometres away can hide it completely, or hide the Earth,
> which is your radio link home.
>
> So when a launch slips by a few days, the site you picked might now land in shadow.
> Sun Shade helps you find the light when plans change.

**Advance.**

## Slide 2 · Who it is for (0:25 to 0:50)

> Our user is a lunar mission planner. Their question is simple: where do we land, and when?
> The moment they need us is the moment a launch slips, and they have to re-check a shortlist fast.
> We put sunlight and line of sight to Earth for any south-pole site into one view, in any browser.

**Advance.**

## Slide 3 · Live demo (0:50 to 1:55)

> The launch slips. Let's find the next viable option.

**Driver, on the app:**

1. *(0:55)* Two sites are already selected. **Point at the sunlight and Earth-contact totals.**
   > Here are two candidate sites, with hours of Sun and Earth contact for the landing window.
2. *(1:05)* **Drag the day slider, then the hour slider.** Say only what you see change.
   > Slip the date and watch the numbers. On the map the shadows move with the Sun.
3. *(1:20)* **Point at the Sun and Earth timelines and the skyline.**
   > This is the real skyline from NASA's LOLA terrain. When the Sun drops behind that ridge, the site goes dark.
4. *(1:35)* **Click the eye on a site to open the astronaut view.** Let the descent play, then drag to look around.
   > And this is what you'd see standing there: the same terrain, with the Sun and Earth where they really are.
5. *(1:48)* **Open Best Landing Days and press LAND on a recommended date.**
   > And this gives a recommended date and hour.

> Complex lunar data, turned into a clear comparison.

If the demo stalls: type **6** then **Enter** to jump to the hidden backup slide (slip, on-time and astronaut-view captures), narrate it, then type **4** **Enter** to continue at 1:55. If even that fails, say the three steps on the slide (respond, compare, decide).

**Advance.**

## Slide 4 · Value and evidence (1:55 to 2:35)

> Can you trust it? Okay, but what do these names actually mean?
>
> LOLA is a laser on a NASA spacecraft that measured the height of the whole Moon. That's our terrain.
> SPICE is NASA's toolkit for where the Sun, Earth and Moon are, and DE440 is JPL's standard table of their positions.
> To check ourselves, we compared with JPL Horizons, NASA's public "where is it in the sky" service:
> three sites, every hour for 30 days, matching to better than a thousandth of a degree.
>
> The limits: sunlight isn't power, and seeing the Earth isn't a guaranteed radio link.
> It's a fast first answer, not certified mission software.

**Advance.**

## Slide 5 · Takeaway (2:35 to 2:55)

> Sun Shade shows how a change of landing date changes your options. Find the light,
> compare the trade-offs, make the next decision. It's open source at the link on screen.
> Thank you. We're happy to take questions.

**Stop by 3:00.** 5 s of buffer. Leave this slide up; keep the app on the second screen.

---

## Q&A (2:00): short answers

Answer in one or two sentences, then stop. If an answer needs the app, the Driver shows it.

| Question | Answer |
|---|---|
| How accurate is it? | Sun and Earth angles match JPL Horizons to under 0.001° (largest difference 0.000027°) at three sites, 721 hourly samples each. Terrain resolution is the bigger uncertainty, and we show it. |
| Did you reproduce a published result? | We tried Mazarico et al. 2011 for Shackleton and did **not** fully reproduce it: our longest sunlit span at their SP-04 point is 177 days against their roughly 240. We say so in the app. Against NASA's average-illumination map we're within 4.2 points at 7 of 8 sites. |
| What does pass? | Shackleton's floor shows 0 of 8,760 hours of direct sunlight in 2026, inside NASA's permanently shadowed outline. A flat-terrain test gives the expected −0.087° horizon dip. |
| Do the site numbers come from the shadow map? | No. The map is a 500 m picture of one instant. The numbers come from 80 m horizon masks at 720 azimuths. |
| Curvature and the Sun's size? | Both modelled: curvature drop along every ray, and the Sun as a disc, not a point. |
| Is the astronaut view real terrain? | Yes, LOLA elevation around the site. The lighting and surface texture are simulated, and it says so on screen. |
| Earth contact means comms? | Line of sight only. No antenna, link budget or relay modelled. |
| What's not modelled? | Power, thermal survival, radio link budget, slope and landing hazards. |
| Why MOON_ME frame? | It's the frame NASA's LOLA terrain is in. The other common frame is offset by about 875 m. |
| Who'd use it Monday? | A mission analyst re-checking a shortlist after a slip, or a teacher showing why the pole is hard. |
| What did you build vs reuse? | NASA data and open libraries; all app and science code was written this weekend. Everything is cited in the repo. |
| Did you use AI? | Yes, as a coding assistant. It's disclosed in the repo's references. |
| Next steps? | Higher-resolution terrain near each site and testing with real mission planners. |
