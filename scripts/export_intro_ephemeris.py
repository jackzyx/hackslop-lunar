"""Export hourly Moon-centred apparent Sun/Earth vectors for the realtime intro.

Run with: py scripts/export_intro_ephemeris.py
Uses the same MOON_ME / LT+S convention as the planner. Units: kilometres.
"""
import json
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import spiceypy as sp

ROOT = Path(__file__).resolve().parents[1]
START, STOP = datetime(2025, 1, 1), datetime(2031, 1, 1)


def export():
    sp.furnsh(str(ROOT / "data/kernels/lunar.tm"))
    count = (STOP - START) // timedelta(hours=1) + 1
    utc = [(START + timedelta(hours=i)).isoformat() for i in range(count)]
    epochs = sp.str2et(utc)
    vectors = np.concatenate([
        sp.spkpos(body, epochs, "MOON_ME", "LT+S", "MOON")[0]
        for body in ("SUN", "EARTH")
    ], axis=1)
    # Check interpolation, including fractional hours, against direct SPICE.
    worst = 0.0
    for i in range(0, count - 1, 719):
        et = sp.str2et((START + timedelta(hours=i, minutes=30)).isoformat())
        for body, offset in (("SUN", 0), ("EARTH", 3)):
            exact = np.array(sp.spkpos(body, et, "MOON_ME", "LT+S", "MOON")[0])
            interpolated = (vectors[i, offset:offset + 3] + vectors[i + 1, offset:offset + 3]) / 2
            angle = np.degrees(np.arctan2(np.linalg.norm(np.cross(exact, interpolated)), np.dot(exact, interpolated)))
            worst = max(worst, float(angle))
    if worst >= 0.001:
        raise ValueError(f"Intro interpolation error {worst} deg exceeds 0.001 deg")
    output = ROOT / "web/public/intro-positions.bin"
    vectors.astype('<f8').tofile(output)
    metadata = {
        "startUtc": START.isoformat() + 'Z', "stepMs": 3600000, "count": count,
        "frame": "MOON_ME", "correction": "LT+S", "units": "km",
        "layout": "little-endian float64: sun xyz, earth xyz, per UTC hour",
    }
    (ROOT / "web/src/data/intro-ephemeris.json").write_text(json.dumps(metadata, indent=2) + '\n')
    print(f"Exported {count} samples ({output.stat().st_size} bytes); max midpoint error {worst:.9f} deg")
    sp.kclear()


if __name__ == '__main__':
    export()
