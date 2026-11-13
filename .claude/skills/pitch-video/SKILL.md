---
name: pitch-video
description: Produce the 29-second Space Apps demo video with burned-in English subtitles (ffmpeg), the 3-minute local pitch, the 7 slides and the Q&A sheet for the Long Shadow project; includes the shot list, timing, export settings and the 30 s Pitch-Fest line. Use for anything about the pitch, video, slides, subtitles, rehearsal or social clip.
---

# Pitch and video (Story)

Script, shot list, slides and Q&A: `context/07-pitch.md`. Practise answers against the
`judge` agent. Shoot **Sat 19:00-20:30** on the rig, hood on, lights off, tripod,
exposure and focus locked. Export **29.0 s**. Sound off must still make sense.

## ffmpeg recipes

Cut and speed up the table sweep (4x):
```bash
ffmpeg -i sweep.mp4 -filter:v "setpts=0.25*PTS" -an sweep_4x.mp4
```
Split screen (webcam left, shadow map right), same height:
```bash
ffmpeg -i webcam.mp4 -i shadowmap.mp4 -filter_complex "[0:v]scale=-2:720[a];[1:v]scale=-2:720[b];[a][b]hstack" -an split.mp4
```
Concatenate clips (same codec/size): list in `clips.txt` as `file 'x.mp4'` lines,
```bash
ffmpeg -f concat -safe 0 -i clips.txt -c copy joined.mp4
```
Burn subtitles from `subs.srt` and hard-cap at 29 s, 1080p H.264:
```bash
ffmpeg -i joined.mp4 -vf "scale=1920:-2,subtitles=subs.srt:force_style='FontName=DejaVu Sans,FontSize=28,Outline=2,MarginV=40'" -t 29 -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart -an long_shadow_29s.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 long_shadow_29s.mp4   # must print <= 29.0
```
Vertical 9:16 social clip (8-10 s):
```bash
ffmpeg -i sweep_4x.mp4 -vf "crop=ih*9/16:ih,scale=1080:1920" -t 10 -an social.mp4
```

SRT timing (from the shot list): 0-3, 3-8, 8-14, 14-21, 21-26, 26-29 s. Fill X with the
measured Horizons agreement only once V1 has a number.

## Rules

- No AI-generated imagery (or visibly watermarked). Music free to use and cited.
- Open on the light, not a logo. URL on screen at the end.
- Keep a local copy of the final video on two laptops for the live final.

## Rehearsal

- First timed pitch Sat 17:00; mentor dry run Sat 21:30; Sun 08:00 assigned-mentor
  run, then two more timed runs. Science owner takes technical questions.
- Stopwatch every run; cut words, not the demo.
