// The circular minimap: 168 px of 2D canvas bottom-left, scaled around the player, showing the
// avenue and cross-street grid, the ocean east, the beach strip, blips for traffic, police,
// mission markers and pickups, the north ring marker and the player's heading arrow.

import { WORLD, HUD } from './config.js';
import { avenueX, crossZ } from './roads.js';

export function createMinimap(pedestrians, traffic, police, missions) {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const size = HUD.minimapSize;
  const half = size / 2;
  let heading = 0;

  /** Draw one whole frame of the map, rotated so the player's heading points up. */
  function drawMinimapBlips(px, pz, playerHeading, yaw, missionPoints) {
    heading = yaw;
    ctx.clearRect(0, 0, size, size);
    // The map itself is north-up with an arrow marker: rotating HUDs get confusing at speed.
    const range = HUD.minimapRange;
    const scale = half / range;
    const toMap = (x, z) => [half + (x - px) * scale, half + (z - pz) * scale];

    ctx.save();
    ctx.beginPath();
    ctx.arc(half, half, half - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#cbe6c9';
    ctx.fillRect(0, 0, size, size);
    // Ocean east of the boulevard.
    ctx.fillStyle = '#63c9d8';
    const [seaX] = toMap(WORLD.waterX, pz);
    ctx.fillRect(seaX, 0, size, size);
    const [sandX] = toMap(WORLD.beachStartX, pz);
    ctx.fillStyle = '#eddfad';
    ctx.fillRect(sandX, 0, seaX - sandX, size);
    // Grid roads.
    ctx.strokeStyle = '#f7f5f2';
    ctx.lineWidth = 3;
    for (let col = 0; col < WORLD.cols; col += 1) {
      const x = avenueX(col);
      if (Math.abs(x - px) > range + 20) continue;
      const [mx] = toMap(x, pz);
      ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, size); ctx.stroke();
    }
    for (let row = 0; row < WORLD.rows; row += 1) {
      const z = crossZ(row);
      if (Math.abs(z - pz) > range + 20) continue;
      const [, mz] = toMap(px, z);
      ctx.beginPath(); ctx.moveTo(0, mz); ctx.lineTo(size, mz); ctx.stroke();
    }
    // Traffic as pale dots.
    ctx.fillStyle = '#5b6470';
    for (const v of traffic.cars) {
      if (!v.alive) continue;
      if (Math.abs(v.x - px) > range || Math.abs(v.z - pz) > range) continue;
      const [mx, mz] = toMap(v.x, v.z);
      ctx.fillRect(mx - 1.5, mz - 1.5, 3, 3);
    }
    // Pedestrians as pinpricks.
    ctx.fillStyle = '#88909c';
    for (const p of pedestrians.peds) {
      if (!p.alive) continue;
      if (Math.abs(p.x - px) > range * 0.6 || Math.abs(p.z - pz) > range * 0.6) continue;
      const [mx, mz] = toMap(p.x, p.z);
      ctx.fillRect(mx - 1, mz - 1, 2, 2);
    }
    // Police cruisers and foot cops in blue with red flash.
    for (const v of police.cruisers) {
      const [mx, mz] = toMap(v.x, v.z);
      ctx.fillStyle = Math.floor(Date.now() / 300) % 2 === 0 ? '#e33' : '#36f';
      ctx.fillRect(mx - 2.5, mz - 2.5, 5, 4.5);
    }
    for (const c of police.cops) {
      if (!c.alive) continue;
      const [mx, mz] = toMap(c.x, c.z);
      ctx.fillStyle = '#36f';
      ctx.beginPath(); ctx.arc(mx, mz, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    // Mission markers in gold.
    for (const m of missionPoints) {
      if (!m.visible) continue;
      const [mx, mz] = toMap(m.x, m.z);
      ctx.fillStyle = '#ffd75e';
      ctx.beginPath(); ctx.arc(mx, mz, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7a5b12';
      ctx.stroke();
    }
    ctx.restore();

    // The fixed ring, the N marker, then the player arrow at centre.
    ctx.strokeStyle = 'rgba(16,28,44,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(half, half, half - 2, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText('N', half, 11);
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(heading);
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(0, 3); ctx.lineTo(-4, 5); ctx.closePath();
    ctx.fill();
    ctx.restore();
    heading = playerHeading;
  }

  return { drawMinimapBlips };
}
