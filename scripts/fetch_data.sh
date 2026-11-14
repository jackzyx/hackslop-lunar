#!/usr/bin/env bash
# Fetch every public dataset the project needs into data/ (gitignored).
# Resumable (curl -C -), skips files that are already complete.
#
#   scripts/fetch_data.sh            # kernels + core DEM tier (~0.75 GB)
#   scripts/fetch_data.sh kernels    # SPICE kernels only (~45 MB)
#   scripts/fetch_data.sh core       # 80 m + 240 m DEMs, 80 m error + hillshade, PSR shapefile
#   scripts/fetch_data.sh extra      # LOLA polar illumination (PGDA 69) + LRO NAC pair (stretch)
#   scripts/fetch_data.sh big        # 20 m COG (2.6 GB) -- normally read over HTTP instead
#
# Sources: NAIF generic kernels (naif.jpl.nasa.gov), PGDA product 90
# (Barker et al. 2023, doi:10.60903/gsfcpgda-lola-spole).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$ROOT/data"
NAIF=https://naif.jpl.nasa.gov/pub/naif/generic_kernels
PGDA=https://pgda.gsfc.nasa.gov/data/LOLA_20mpp

get() { # url dest
  local url="$1" dest="$2"
  mkdir -p "$(dirname "$dest")"
  local want; want=$(curl -sIL --max-time 30 "$url" | tr -d '\r' | awk 'tolower($1)=="content-length:"{n=$2} END{print n}')
  if [[ -f "$dest" && -n "$want" && "$(stat -c%s "$dest" 2>/dev/null || stat -f%z "$dest")" == "$want" ]]; then
    echo "ok    $(basename "$dest")"; return; fi
  echo "get   $(basename "$dest")  ($(( ${want:-0} / 1048576 )) MB)"
  curl -fsSL --retry 5 --retry-delay 3 -C - -o "$dest" "$url"
}

kernels() {
  local K="$DATA/kernels"
  get $NAIF/lsk/naif0012.tls                       "$K/naif0012.tls"
  get $NAIF/pck/pck00011.tpc                       "$K/pck00011.tpc"
  get $NAIF/spk/planets/de440s.bsp                 "$K/de440s.bsp"
  get $NAIF/pck/moon_pa_de440_200625.bpc           "$K/moon_pa_de440_200625.bpc"
  get $NAIF/fk/satellites/moon_de440_250416.tf     "$K/moon_de440_250416.tf"
  get $NAIF/pck/earth_latest_high_prec.bpc         "$K/earth_latest_high_prec.bpc" || true
  cat > "$K/lunar.tm" <<TM
KPL/MK
   Meta-kernel for the lunar south pole project. Paths are relative to
   this file's directory (run from data/kernels or use furnsh with cwd set).
\begindata
   PATH_VALUES  = ( '$K' )
   PATH_SYMBOLS = ( 'K' )
   KERNELS_TO_LOAD = ( '\$K/naif0012.tls'
                       '\$K/pck00011.tpc'
                       '\$K/de440s.bsp'
                       '\$K/moon_pa_de440_200625.bpc'
                       '\$K/moon_de440_250416.tf' )
\begintext
TM
}

core() {
  local D="$DATA/dem"
  get $PGDA/LDEM_80S_80MPP_ADJ.TIF       "$D/LDEM_80S_80MPP_ADJ.TIF"
  get $PGDA/LDEM_60S_240MPP_ADJ.TIF      "$D/LDEM_60S_240MPP_ADJ.TIF"
  get $PGDA/LDEM_80S_80MPP_ADJ_ERR.TIF   "$D/LDEM_80S_80MPP_ADJ_ERR.TIF"
  get $PGDA/LDEM_80S_80MPP_ADJ_HILL.TIF  "$D/LDEM_80S_80MPP_ADJ_HILL.TIF"
  for ext in SHP SHX DBF PRJ CSV; do
    get $PGDA/LPSR_80S_20MPP_ADJ_1km2.$ext "$DATA/psr/LPSR_80S_20MPP_ADJ_1km2.$ext"
  done
}

extra() {
  # PGDA 69 (Mazarico et al. 2011, updated 2016): average Sun and Earth visibility,
  # 85-90 S at 60 m/px, hourly over an 18.6-year nutation cycle. Benchmark for V4.
  # (The *_COG.TIF links on the PGDA 69 page return "Not Found"; use the plain TIFs.)
  local M=https://pgda.gsfc.nasa.gov/data/MoonIllumination
  get $M/AVGVISIB_85S_060M_201608.TIF        "$DATA/illum/AVGVISIB_85S_060M_201608.TIF"
  get $M/AVGVISIB_85S_060M_201608_EARTH.TIF  "$DATA/illum/AVGVISIB_85S_060M_201608_EARTH.TIF"
  # LRO NAC real vs. LOLA-simulated pair from PGDA 90 (stretch: photo vs software vs table)
  get $PGDA/M139356343LE_20MPP.TIF       "$DATA/nac/M139356343LE_20MPP.TIF"
  get $PGDA/M139356343_20MPP_MODEL.TIF   "$DATA/nac/M139356343_20MPP_MODEL.TIF"
}

big() { get $PGDA/LDEM_80S_20MPP_ADJ.TIF "$DATA/dem/LDEM_80S_20MPP_ADJ.TIF"; }

case "${1:-all}" in
  kernels) kernels ;;
  core)    core ;;
  extra)   extra ;;
  big)     big ;;
  all)     kernels; core ;;
  *) echo "usage: $0 [all|kernels|core|extra|big]"; exit 2 ;;
esac
echo "done -> $DATA"
