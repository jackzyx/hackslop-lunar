import { terrainFrom } from './shadow.js';
let terrain;
export function initialTerrain() {
  return terrain ??= fetch(new URL('terrain_500m.bin', document.baseURI))
    .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.arrayBuffer(); })
    .then(terrainFrom);
}
