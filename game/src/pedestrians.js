// Pedestrians: about 160 walkers on the sidewalk lines (and across the beach promenade), with
// a bobbing walk cycle in the mesh, panic that scatters them when shots are fired nearby, and
// the crowd spawner the screenshot scenes use. Each walker is one merged vertex-coloured mesh.

import * as THREE from 'three';
import { WORLD, PALETTE, SPEEDS } from './config.js';
import { avenueX, crossZ } from './roads.js';
import { mergeGeometries } from './city.js';
import { hitColliders } from './vehicles.js';

const PED_TARGET = 160;

function personGeometry(shirt, pants, skin) {
  const parts = [];
  const add = (x, y, z, w, h, d, color) => {
    const geo = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    const count = geo.attributes.position.count;
    const array = new Float32Array(count * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < array.length; i += 3) {
      array[i] = c.r; array[i + 1] = c.g; array[i + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(array, 3));
    geo.translate(x, y + h / 2, z);
    parts.push(geo);
  };
  add(0, 0.3, 0, 0.36, 0.85, 0.3, pants);       // legs block
  add(0, 1.1, 0, 0.52, 0.7, 0.32, shirt);        // torso
  add(0, 1.82, 0, 0.34, 0.34, 0.32, skin);       // head
  add(0, 1.55, -0.18, 0.54, 0.14, 0.1, 0x3b3b3b); // sun hat brim behind
  return mergeGeometries(parts);
}

export function createPedestrians(scene, random, colliders) {
  const peds = [];
  const geoCache = new Map();

  function geoFor(shirt, pants, skin) {
    const key = `${shirt}|${pants}|${skin}`;
    let geo = geoCache.get(key);
    if (!geo) {
      geo = personGeometry(shirt, pants, skin);
      geoCache.set(key, geo);
    }
    return geo;
  }

  /** Spawn one walker on a sidewalk line near (cx, cz), or anywhere in the grid. */
  function spawnPed(cx, cz, radius, hostile, colors) {
    const shirt = colors ? colors[0] : hostile ? 0x4a3b63 : random.pick(PALETTE.pedShirt);
    const pants = colors ? colors[1] : hostile ? 0x241f2e : random.pick(PALETTE.pedPants);
    const skin = colors ? colors[2] : random.pick([0xe8b48c, 0xc98d63, 0x8a5a38, 0xf2c9a4, 0x6e452a]);
    const geo = geoFor(shirt, pants, skin);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.castShadow = true;
    let x, z;
    if (cx !== undefined) {
      x = cx + random.range(-radius, radius);
      z = cz + random.range(-radius, radius);
    } else {
      const col = random.int(0, WORLD.cols - 1);
      const west = random.chance(2);
      x = avenueX(col) + (west ? -9.4 : 9.4);
      z = random.range(WORLD.gridMinZ, WORLD.gridMaxZ);
    }
    const ped = {
      mesh, x, z,
      heading: random.range(0, Math.PI * 2),
      speed: SPEEDS.pedWalk * random.range(0.8, 1.3),
      phase: random.range(0, Math.PI * 2),
      panic: 0, hostile: !!hostile, health: hostile ? 60 : 40,
      alive: true, isPed: true,
    };
    if (hitColliders(ped.x, ped.z, 0.5, colliders)) {
      if (cx === undefined) return spawnPed();
      ped.x = cx; ped.z = cz;
    }
    scene.add(mesh);
    peds.push(ped);
    return ped;
  }

  for (let i = 0; i < PED_TARGET; i += 1) spawnPed();

  /** Walkers follow the sidewalk, turning at corners and away from buildings. */
  function step(dt, focusX, focusZ, shotsFiredAt) {
    for (let i = 0; i < peds.length; i += 1) {
      const p = peds[i];
      if (!p.alive) continue;
      if (p.freeze) { sync(p, dt); continue; }
      p.phase += dt * (p.panic > 0 ? 14 : 7);
      if (shotsFiredAt) {
        const dx = p.x - shotsFiredAt.x, dz = p.z - shotsFiredAt.z;
        if (dx * dx + dz * dz < 55 * 55 && !p.hostile) {
          p.panic = 4;
          p.heading = Math.atan2(dx, dz);
        }
      }
      if (p.panic > 0) p.panic -= dt;
      const stepSpeed = p.panic > 0 ? SPEEDS.run * 0.7 : p.speed;
      const nx = p.x + Math.sin(p.heading) * stepSpeed * dt;
      const nz = p.z + Math.cos(p.heading) * stepSpeed * dt;
      if (hitColliders(nx, nz, 0.4, colliders)) {
        p.heading += random.range(1.2, 2.4);
      } else {
        p.x = nx; p.z = nz;
      }
      if (p.panic <= 0 && random.chance(160)) p.heading += random.range(-0.8, 0.8);
      p.x = Math.max(-635, Math.min(235, p.x));
      p.z = Math.max(-635, Math.min(635, p.z));
      sync(p, dt);
    }
  }

  /** Place the mesh and play the walk cycle: a bounce and a lean into the stride. */
  function sync(p, dt) {
    p.mesh.position.set(p.x, Math.abs(Math.sin(p.phase)) * 0.06, p.z);
    p.mesh.rotation.y = p.heading;
    p.mesh.rotation.z = Math.sin(p.phase) * 0.05;
  }

  function removePed(p) {
    p.alive = false;
    scene.remove(p.mesh);
  }

  /** Drop `count` walkers inside `radius` of (x, z), right where a camera is looking. */
  function spawnCrowdAround(x, z, count, radius) {
    let placed = 0;
    for (let i = 0; i < count; i += 1) {
      const p = spawnPed(x, z, radius);
      placed += 1;
    }
    return placed;
  }

  return { peds, step, spawnCrowdAround, spawnPed, removePed };
}
