#!/usr/bin/env python3
"""Fetch every public dataset the project needs into data/ (gitignored).
Standard library only, so it runs the same on Windows, macOS and Linux.
Resumable (keeps a .part file), skips files that are already complete,
downloads up to 4 files at once.

  python scripts/fetch_data.py            # kernels + core DEM tier (~0.75 GB)
  python scripts/fetch_data.py kernels    # SPICE kernels only (~45 MB)
  python scripts/fetch_data.py core       # 80 m + 240 m DEMs, 80 m error + hillshade, PSR shapefile
  python scripts/fetch_data.py extra      # LOLA polar illumination (PGDA 69) + LRO NAC pair (stretch)
  python scripts/fetch_data.py big        # 20 m COG (2.6 GB) -- normally read over HTTP instead

Windows: .venv\\Scripts\\python scripts\\fetch_data.py core   (the venv has certifi)
Sources: NAIF generic kernels (naif.jpl.nasa.gov), PGDA product 90
(Barker et al. 2023, doi:10.60903/gsfcpgda-lola-spole), PGDA 69 (Mazarico et al. 2011).
"""
import shutil
import ssl
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

try:  # Windows Python trusts only roots already in the Windows store, and NAIF's root
    import certifi  # (Sectigo R46) is often missing there. certifi comes with requests.
    TLS = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    TLS = ssl.create_default_context()

DATA = Path(__file__).resolve().parent.parent / "data"
NAIF = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels"
PGDA = "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp"
ILLUM = "https://pgda.gsfc.nasa.gov/data/MoonIllumination"

TIERS = {
    "kernels": [
        (f"{NAIF}/lsk/naif0012.tls", "kernels"),
        (f"{NAIF}/pck/pck00011.tpc", "kernels"),
        (f"{NAIF}/spk/planets/de440s.bsp", "kernels"),
        (f"{NAIF}/pck/moon_pa_de440_200625.bpc", "kernels"),
        (f"{NAIF}/fk/satellites/moon_de440_250416.tf", "kernels"),
        (f"{NAIF}/pck/earth_latest_high_prec.bpc", "kernels"),
    ],
    "core": [
        (f"{PGDA}/LDEM_80S_80MPP_ADJ.TIF", "dem"),
        (f"{PGDA}/LDEM_60S_240MPP_ADJ.TIF", "dem"),
        (f"{PGDA}/LDEM_80S_80MPP_ADJ_ERR.TIF", "dem"),
        (f"{PGDA}/LDEM_80S_80MPP_ADJ_HILL.TIF", "dem"),
    ] + [(f"{PGDA}/LPSR_80S_20MPP_ADJ_1km2.{ext}", "psr") for ext in ("SHP", "SHX", "DBF", "PRJ", "CSV")],
    "extra": [
        # Average Sun and Earth visibility, 85-90 S at 60 m/px: benchmark for V4.
        # (The *_COG.TIF links on the PGDA 69 page return "Not Found"; use the plain TIFs.)
        (f"{ILLUM}/AVGVISIB_85S_060M_201608.TIF", "illum"),
        (f"{ILLUM}/AVGVISIB_85S_060M_201608_EARTH.TIF", "illum"),
        # LRO NAC real vs. LOLA-simulated pair (stretch: photo vs software vs table)
        (f"{PGDA}/M139356343LE_20MPP.TIF", "nac"),
        (f"{PGDA}/M139356343_20MPP_MODEL.TIF", "nac"),
    ],
    "big": [(f"{PGDA}/LDEM_80S_20MPP_ADJ.TIF", "dem")],
}
OPTIONAL = {"earth_latest_high_prec.bpc"}  # not in the meta-kernel; a failure is only a warning


def remote_size(url):
    with urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=30, context=TLS) as r:
        return int(r.headers.get("Content-Length") or 0)


def get(url, sub):
    dest = DATA / sub / url.rsplit("/", 1)[1]
    dest.parent.mkdir(parents=True, exist_ok=True)
    want = remote_size(url)
    if dest.exists() and dest.stat().st_size == want:
        print(f"ok    {dest.name}", flush=True)
        return
    part = dest.with_name(dest.name + ".part")
    print(f"get   {dest.name}  ({want >> 20} MB)", flush=True)
    for attempt in range(1, 7):
        have = part.stat().st_size if part.exists() else 0
        if want and have == want:
            break
        if want and have > want:
            part.unlink()
            have = 0
        headers = {"Range": f"bytes={have}-"} if have else {}
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60, context=TLS) as r:
                with open(part, "ab" if r.status == 206 else "wb") as f:
                    shutil.copyfileobj(r, f, 1 << 20)
            if not want:
                break
        except OSError as e:  # URLError, HTTPError, timeouts, resets
            print(f"retry {dest.name} ({attempt}/6): {e}", flush=True)
            time.sleep(3 * attempt)
    got = part.stat().st_size if part.exists() else 0
    if want and got != want:
        raise RuntimeError(f"{dest.name}: got {got} of {want} bytes, run again to resume")
    part.replace(dest)
    print(f"done  {dest.name}", flush=True)


def write_meta_kernel():
    # SPICE string values are limited to 80 chars: split the path with '+' continuations
    # so long Windows paths (OneDrive, long user names) still load. Forward slashes work on Windows.
    k = (DATA / "kernels").as_posix()
    path = "+'\n                    '".join(k[i:i + 60] for i in range(0, len(k), 60))
    (DATA / "kernels" / "lunar.tm").write_text(
        "KPL/MK\n"
        "   Meta-kernel for the lunar south pole project. Absolute paths,\n"
        "   regenerated by scripts/fetch_data.py on each machine.\n"
        "\\begindata\n"
        f"   PATH_VALUES  = ( '{path}' )\n"
        "   PATH_SYMBOLS = ( 'K' )\n"
        "   KERNELS_TO_LOAD = ( '$K/naif0012.tls'\n"
        "                       '$K/pck00011.tpc'\n"
        "                       '$K/de440s.bsp'\n"
        "                       '$K/moon_pa_de440_200625.bpc'\n"
        "                       '$K/moon_de440_250416.tf' )\n"
        "\\begintext\n"
    )


def main(tier="all"):
    names = ["kernels", "core"] if tier == "all" else [tier]
    if any(n not in TIERS for n in names):
        sys.exit("usage: python scripts/fetch_data.py [all|kernels|core|extra|big]")
    jobs = [job for n in names for job in TIERS[n]]
    failed = []

    def run(job):
        try:
            get(*job)
        except Exception as e:  # noqa: BLE001
            name = job[0].rsplit("/", 1)[1]
            print(f"{'warn' if name in OPTIONAL else 'FAIL'}  {name}: {e}", flush=True)
            if name not in OPTIONAL:
                failed.append(name)

    with ThreadPoolExecutor(4) as pool:
        list(pool.map(run, jobs))
    if "kernels" in names:
        write_meta_kernel()
    if failed:
        sys.exit(f"\n{len(failed)} file(s) failed: {', '.join(failed)}. Run the same command again to resume.")
    print(f"done -> {DATA}")


if __name__ == "__main__":
    main(*sys.argv[1:2])
