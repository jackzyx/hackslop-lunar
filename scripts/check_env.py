#!/usr/bin/env python3
"""Toolchain smoke test: packages import, SPICE kernels load and cover 2025-2030,
the MOON_ME frame resolves, DEMs open with the expected projection.
Run: python scripts/check_env.py   (exit code 1 if anything required fails)."""
import importlib
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
ok = True


def report(status, what, detail=""):
    global ok
    if status == "FAIL":
        ok = False
    print(f"[{status:4}] {what}" + (f"  {detail}" if detail else ""))


for mod in ["spiceypy", "numpy", "scipy", "rasterio", "pyproj", "shapely",
            "geopandas", "trimesh", "matplotlib", "PIL", "astroquery", "requests"]:
    try:
        m = importlib.import_module(mod)
        report("OK", f"import {mod}", getattr(m, "__version__", ""))
    except Exception as e:  # noqa: BLE001
        report("FAIL", f"import {mod}", str(e))

# SPICE
mk = os.path.join(DATA, "kernels", "lunar.tm")
if os.path.exists(mk):
    try:
        import spiceypy as sp
        sp.kclear()
        sp.furnsh(mk)
        for t in ("2025-01-01T00:00:00", "2030-12-31T23:00:00"):
            sp.spkpos("SUN", sp.str2et(t), "MOON_ME", "LT+S", "MOON")
            sp.spkpos("EARTH", sp.str2et(t), "MOON_ME", "LT+S", "MOON")
        report("OK", "SPICE kernels load; SUN/EARTH in MOON_ME cover 2025-2030")
        sp.kclear()
    except Exception as e:  # noqa: BLE001
        report("FAIL", "SPICE", str(e))
else:
    report("FAIL", "SPICE meta-kernel missing", "run python scripts/fetch_data.py kernels")

# DEMs
expect = {
    "dem/LDEM_80S_80MPP_ADJ.TIF": (7600, 80.0),
    "dem/LDEM_60S_240MPP_ADJ.TIF": (None, 240.0),
    "dem/LDEM_80S_80MPP_ADJ_ERR.TIF": (7600, 80.0),
    "dem/LDEM_80S_80MPP_ADJ_HILL.TIF": (7600, 80.0),
}
try:
    import rasterio
    for rel, (w, res) in expect.items():
        p = os.path.join(DATA, rel)
        if not os.path.exists(p):
            report("FAIL", rel, "missing: run python scripts/fetch_data.py core")
            continue
        try:
            with rasterio.open(p) as s:
                proj = s.crs.to_proj4() if s.crs else ""
                good = "+proj=stere" in proj and "+lat_0=-90" in proj and abs(s.res[0] - res) < 1e-6
                if w:
                    good = good and s.width == w
                s.read(1, window=((s.height // 2, s.height // 2 + 4), (s.width // 2, s.width // 2 + 4)))
                report("OK" if good else "FAIL", rel, f"{s.width}x{s.height} {s.res[0]:.0f} m/px")
        except Exception as e:  # noqa: BLE001
            report("FAIL", rel, f"unreadable (partial download?): {e}")
except ImportError:
    pass

psr = os.path.join(DATA, "psr", "LPSR_80S_20MPP_ADJ_1km2.SHP")
report("OK" if os.path.exists(psr) else "WARN", "PSR shapefile", "" if os.path.exists(psr) else "missing (core tier)")
for rel in ("illum/AVGVISIB_85S_060M_201608.TIF", "nac/M139356343LE_20MPP.TIF"):
    report("OK" if os.path.exists(os.path.join(DATA, rel)) else "WARN", rel,
           "" if os.path.exists(os.path.join(DATA, rel)) else "optional: python scripts/fetch_data.py extra")

print("\nALL REQUIRED CHECKS PASSED" if ok else "\nSOME REQUIRED CHECKS FAILED")
sys.exit(0 if ok else 1)
