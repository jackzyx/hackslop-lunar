// Custom landing sites, computed in the browser from the shipped data only (no SPICE here).
// Horizon: the same great-circle ray march as science/horizon_mask.py (720 azimuths, 2 m mast,
// 80 m first step growing 2 %, exact 3-D elevation), but over the 500 m terrain grid the map uses,
// so rays stop at its edge (250 km from the pole) instead of 300 km.
// Sun and Earth: rebuilt hour by hour from the nearest shipped site's SPICE angles (MOON_ME, LT+S).
// The Sun is the same direction across the region (parallax < 0.0001 deg). For the Earth we
// rebuild its position as site vector + distance x direction, then subtract the custom site vector.
// Both checked against the shipped sites in custom-site.test.js and on the Validation tab.
import { R_KM, toMap, heightAt } from "../terrain/shadow.js";

const RAD = Math.PI / 180, N_AZ = 720, MAX_KM = 300, MAST_KM = 0.002;
// shortcut: fixed mean Earth distance; with a reference site under 160 km away the direction error
// is below 0.002 deg (validated); triangulate with Apollo 11 if points move farther out.
const EARTH_KM = 384400;
export const MAX_POLE_KM = 160; // custom sites only where the shipped sites validate the method

const steps = (() => { const s = []; for (let d = 0.08, tot = 0; (tot += d) < MAX_KM; d *= 1.02) s.push(tot / R_KM); return s; })();

export function fromMap(x, y) {
  return { lat: 2 * Math.atan(Math.hypot(x, y) / (2 * R_KM)) / RAD - 90, lon: ((Math.atan2(x, y) / RAD) + 360) % 360 };
}
export const poleKm = (lat, lon) => Math.hypot(...toMap(lat, lon));

function frame(lat, lon) {
  const la = lat * RAD, lo = lon * RAD;
  const up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  const east = [-Math.sin(lo), Math.cos(lo), 0];
  const north = [up[1] * east[2] - up[2] * east[1], up[2] * east[0] - up[0] * east[2], up[0] * east[1] - up[1] * east[0]]; // up x east
  return { up, east, north };
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Terrain height (km) at a lat/lon, from the map grid.
export const groundKm = (t, lat, lon) => heightAt(t, ...toMap(lat, lon));

// 720 skyline elevations (deg), azimuth clockwise from north in 0.5 deg steps.
export function horizonMask(t, lat, lon) {
  const { up, east, north } = frame(lat, lon), h0 = groundKm(t, lat, lon);
  if (Number.isNaN(h0)) throw new Error("outside the terrain map");
  const rs = R_KM + h0 + MAST_KM, mask = new Float32Array(N_AZ);
  for (let k = 0; k < N_AZ; k++) {
    const az = k * 0.5 * RAD, ca = Math.cos(az), sa = Math.sin(az);
    const tv = [ca * north[0] + sa * east[0], ca * north[1] + sa * east[1], ca * north[2] + sa * east[2]];
    let best = -90;
    for (const D of steps) {
      const c = Math.cos(D), s = Math.sin(D);
      const p = [c * up[0] + s * tv[0], c * up[1] + s * tv[1], c * up[2] + s * tv[2]];
      const den = 1 - p[2], x = 2 * R_KM * p[1] / den, y = 2 * R_KM * p[0] / den;
      const hs = heightAt(t, x, y);
      if (Number.isNaN(hs)) break; // left the map
      const q = R_KM + hs, v = [q * p[0] - rs * up[0], q * p[1] - rs * up[1], q * p[2] - rs * up[2]];
      const vu = dot(v, up), vh = Math.hypot(v[0] - vu * up[0], v[1] - vu * up[1], v[2] - vu * up[2]);
      const el = Math.atan2(vu, vh) / RAD;
      if (el > best) best = el;
    }
    mask[k] = best;
  }
  return { mask, groundKm: h0 };
}

// Direction (unit, MOON_ME) from a site's az/el in its local frame.
function dirOf(f, azDeg, elDeg) {
  const a = azDeg * RAD, e = elDeg * RAD, ce = Math.cos(e);
  const E = ce * Math.sin(a), N = ce * Math.cos(a), U = Math.sin(e);
  return [0, 1, 2].map((i) => E * f.east[i] + N * f.north[i] + U * f.up[i]);
}
function azEl(f, v) {
  const e = dot(v, f.east), n = dot(v, f.north), u = dot(v, f.up);
  return [((Math.atan2(e, n) / RAD) + 360) % 360, Math.atan2(u, Math.hypot(e, n)) / RAD];
}

// Hourly Sun and Earth az/el at (lat, lon), from reference site `ref` ({lat, lon, groundKm, table}).
export function bodyTables(ref, lat, lon, altKm) {
  const fr = frame(ref.lat, ref.lon), fc = frame(lat, lon), n = ref.table.sun_az.length;
  const sr = fr.up.map((u) => u * (R_KM + ref.groundKm + MAST_KM)), sc = fc.up.map((u) => u * (R_KM + altKm + MAST_KM));
  const out = { sun_az: new Float32Array(n), sun_el: new Float32Array(n), earth_az: new Float32Array(n), earth_el: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    [out.sun_az[i], out.sun_el[i]] = azEl(fc, dirOf(fr, ref.table.sun_az[i], ref.table.sun_el[i]));
    const e = dirOf(fr, ref.table.earth_az[i], ref.table.earth_el[i]);
    [out.earth_az[i], out.earth_el[i]] = azEl(fc, [0, 1, 2].map((k) => sr[k] + EARTH_KM * e[k] - sc[k]));
  }
  return out;
}

// Everything the app needs for a new site. `shipped` = [{id, lat, lon, table}] south-pole sites.
export function buildCustomSite(t, shipped, { id, name, lat, lon }) {
  if (!(poleKm(lat, lon) <= MAX_POLE_KM)) throw new Error(`custom sites must be within ${MAX_POLE_KM} km of the pole`);
  const { mask, groundKm: h0 } = horizonMask(t, lat, lon);
  const [x, y] = toMap(lat, lon);
  const ref = shipped.map((s) => ({ ...s, d: Math.hypot(...toMap(s.lat, s.lon).map((v, k) => v - [x, y][k])) })).sort((a, b) => a.d - b.d)[0];
  const table = bodyTables({ ...ref, groundKm: groundKm(t, ref.lat, ref.lon) }, lat, lon, h0);
  return {
    site: { id, name, kind: "custom site", mission: `Custom · horizon from 500 m terrain in the browser · angles from ${ref.name}`, lat, lon, mast_m: 2, az_step_deg: 0.5, custom: true, ground_m: Math.round(h0 * 1000), horizon: Array.from(mask) },
    table,
  };
}

// Method check shown on the Validation tab: rebuild each shipped site from its coordinates alone
// (angles from the nearest other site) and compare with the shipped SPICE + 80 m-terrain numbers.
export function methodCheck(t, shipped, visibility, windowMetrics, windowH) {
  return shipped.map((s) => {
    const { site, table } = buildCustomSite(t, shipped.filter((x) => x.id !== s.id), { id: "check", name: s.name, lat: s.lat, lon: s.lon });
    let rms = 0, ang = 0, maxD = 0, sumD = 0, n = 0;
    for (let k = 0; k < N_AZ; k++) rms += (site.horizon[k] - s.horizon[k]) ** 2;
    for (let i = 0; i < table.sun_az.length; i += 13) {
      const d = (a, b, el) => Math.abs(((a - b + 540) % 360) - 180) * Math.cos(el * RAD);
      ang = Math.max(ang, Math.abs(table.sun_el[i] - s.table.sun_el[i]), d(table.sun_az[i], s.table.sun_az[i], s.table.sun_el[i]),
        Math.abs(table.earth_el[i] - s.table.earth_el[i]), d(table.earth_az[i], s.table.earth_az[i], s.table.earth_el[i]));
    }
    const a = visibility(s.horizon, s.table), b = visibility(site.horizon, table);
    for (let i0 = 0; i0 + windowH <= table.sun_az.length; i0 += 7 * 24, n++) {
      const diff = windowMetrics(b, i0).sunlit - windowMetrics(a, i0).sunlit;
      maxD = Math.max(maxD, Math.abs(diff)); sumD += diff;
    }
    return { id: s.id, name: s.name, km: poleKm(s.lat, s.lon), maskRms: Math.sqrt(rms / N_AZ), angleMax: ang, sunlitMax: maxD, sunlitMean: sumD / n };
  });
}
