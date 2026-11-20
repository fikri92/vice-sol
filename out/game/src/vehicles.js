// Cars and other driveable vehicles: one merged vertex-coloured mesh per body kind (sedan,
// muscle, taxi, van, police cruiser with a light bar), a simple arcade physics step, wheels
// baked into the mesh, headlight sprites and the enter/exit bookkeeping the player and police
// share. Nothing here draws UI.

import * as THREE from 'three';
import { SPEEDS, PALETTE } from './config.js';
import { mergeGeometries } from './city.js';
import { getTextures } from './textures.js';

const KIND = {
  sedan: { w: 2.1, h: 1.35, l: 4.4, cabin: 0.62, max: SPEEDS.carMax, color: null },
  muscle: { w: 2.25, h: 1.3, l: 4.9, cabin: 0.55, max: 30, color: 0xE8641B },
  taxi: { w: 2.15, h: 1.4, l: 4.5, cabin: 0.66, max: 24, color: PALETTE.taxi },
  van: { w: 2.4, h: 2.0, l: 5.4, cabin: 0.85, max: 20, color: 0xdde3e8 },
  police: { w: 2.2, h: 1.42, l: 4.8, cabin: 0.62, max: SPEEDS.policeMax, color: PALETTE.policeBody },
};

/** A coloured box part for merging: geometry with a uniform vertex colour. */
function coloredBox(x, y, z, w, h, d, color, boxes) {
  const geo = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  const count = geo.attributes.position.count;
  const array = new Float32Array(count * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < array.length; i += 3) {
    array[i] = c.r; array[i + 1] = c.g; array[i + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(array, 3));
  geo.translate(x, y + h / 2, z);
  boxes.push(geo);
  return geo;
}

/** Build the merged one-mesh body for a kind of car, with its radiator, windows and wheels. */
function buildCarGeo(spec, color, siren) {
  const parts = [];
  const { w, h, l, cabin } = spec;
  const wheelR = h * 0.38;
  const bodyY = wheelR * 0.7;
  coloredBox(0, bodyY, 0, w, h * 0.62, l, color, parts);
  coloredBox(0, bodyY + h * 0.6, 0, w * 0.88, h * 0.42 * cabin, l * 0.5, color, parts);
  // Windshield band and side glass.
  const glass = 0x9fd2e8;
  coloredBox(0, bodyY + h * 0.62, l * 0.25 - 0.05, w * 0.8, h * 0.34, l * 0.07, glass, parts);
  coloredBox(0, bodyY + h * 0.64, -l * 0.05, w * 0.9, h * 0.3, l * 0.32, glass, parts);
  // Four dark wheels.
  const dark = 0x23262b;
  for (const sx of [-1, 1]) {
    for (const sz of [l * 0.32, -l * 0.32]) {
      coloredBox(sx * (w / 2 - 0.12), wheelR * 0.1, sz, 0.34, wheelR * 1.7, 0.9, dark, parts);
    }
  }
  // Chrome bumper strips.
  coloredBox(0, bodyY + 0.08, l / 2 - 0.1, w * 0.9, 0.16, 0.22, 0xd8dce0, parts);
  coloredBox(0, bodyY + 0.08, -l / 2 + 0.1, w * 0.9, 0.16, 0.22, 0xd8dce0, parts);
  if (siren === 'taxi') coloredBox(0, bodyY + h * 0.6 + h * 0.42 * cabin, l * 0.28, 0.9, 0.3, 0.34, 0x2b2b2b, parts);
  if (siren === 'police') {
    coloredBox(0, bodyY + h * 0.6 + h * 0.42 * cabin, l * 0.28, w * 0.75, 0.22, 0.3, 0x201d24, parts);
    coloredBox(-w * 0.22, bodyY + h * 0.6 + h * 0.42 * cabin + 0.22, l * 0.28, 0.42, 0.26, 0.3, 0xff4033, parts);
    coloredBox(w * 0.22, bodyY + h * 0.6 + h * 0.42 * cabin + 0.22, l * 0.28, 0.42, 0.26, 0.3, 0x3b6cff, parts);
    // Two-tone door band.
    coloredBox(0, bodyY + 0.12, 0, w * 1.005, 0.34, l * 0.72, PALETTE.policeStripe, parts);
  }
  return mergeGeometries(parts);
}

const geoCache = new Map();

export function createVehicleMesh(kind, colorOverride) {
  const spec = KIND[kind];
  const color = colorOverride ?? spec.color ?? 0xb0b4c0;
  const siren = kind === 'police' ? 'police' : kind === 'taxi' ? 'taxi' : null;
  const key = `${kind}|${color}`;
  let geo = geoCache.get(key);
  if (!geo) {
    geo = buildCarGeo(spec, color, siren);
    geoCache.set(key, geo);
  }
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.castShadow = true;
  return mesh;
}

/** A live vehicle actor: mesh, transform state and the arcade physics fields. */
export function createVehicle(kind, x, z, heading, color) {
  const mesh = createVehicleMesh(kind, color);
  const spec = KIND[kind];
  const vehicle = {
    kind, mesh, spec,
    x, z, heading, speed: 0,
    steer: 0, throttle: 0, brake: 0,
    health: 100, alive: true,
    driver: null,        // 'player' | 'traffic' | 'police' | null (parked)
    siren: false,
    sirenPhase: 0,
  };
  return vehicle;
}

/** Push the mesh to match the physics state (called once per rendered frame). */
export function syncVehicleMesh(v) {
  v.mesh.position.set(v.x, 0, v.z);
  v.mesh.rotation.y = v.heading;
}

/**
 * One arcade physics step: throttle and brake feed the speed, the steering turns the heading
 * in proportion to it, and building colliders push the car back out with a speed penalty.
 */
export function stepVehiclePhysics(v, dt, colliders) {
  const max = v.spec.max;
  const accel = v.throttle > 0 ? SPEEDS.carAccel : v.throttle < 0 ? SPEEDS.carBrake * 0.6 : 0;
  v.speed += (v.throttle * accel) * dt;
  if (v.brake > 0) v.speed -= Math.sign(v.speed) * SPEEDS.carBrake * v.brake * dt;
  if (v.throttle === 0 && v.brake === 0) v.speed -= Math.sign(v.speed) * 3.2 * dt;
  v.speed = Math.max(-max * 0.35, Math.min(max, v.speed));
  if (Math.abs(v.speed) < 0.02) v.speed = 0;

  // Steering authority falls off at a standstill and at the artificial top speed.
  const authority = Math.min(Math.abs(v.speed) / 8, 1) * (1 - Math.abs(v.speed) / (max * 2.1));
  v.heading += v.steer * SPEEDS.carTurn * authority * dt * Math.sign(v.speed || 1);

  const nx = v.x + Math.sin(v.heading) * v.speed * dt;
  const nz = v.z + Math.cos(v.heading) * v.speed * dt;
  const hit = hitColliders(nx, nz, 1.4, colliders);
  if (hit) {
    v.speed *= 0.35;
    if (v.health < 100 && Math.abs(v.speed) > 4) v.health -= 1;
  } else {
    v.x = nx;
    v.z = nz;
  }
  syncVehicleMesh(v);
}

/** The first collider that a circle of radius r at (x, z) overlaps, or null. */
export function hitColliders(x, z, r, colliders) {
  for (let i = 0; i < colliders.length; i += 1) {
    const c = colliders[i];
    if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return c;
  }
  return null;
}

/** Keep an actor inside the world bounds, nipping them back to the shore side. */
export function clampToWorld(v) {
  v.x = Math.max(-640, Math.min(240, v.x));
  v.z = Math.max(-640, Math.min(640, v.z));
}

/** True when a vehicle's body circle overlaps another actor's circle. */
export function vehiclesOverlap(a, b, padding = 0.6) {
  const dx = a.x - b.x, dz = a.z - b.z;
  const r = 2.4 + padding;
  return dx * dx + dz * dz < r * r;
}

/** Burn a car out: dark smoke, health zero, driver thrown out of the state. */
export function wreckVehicle(v) {
  v.alive = false;
  v.health = 0;
  v.mesh.material = new THREE.MeshLambertMaterial({ color: 0x1c1c1e });
}

/** Headlight sprites on while the sun is low (the mission scenes use them off). */
export function setHeadlights(v, on) {
  if (on === v.lightsOn) return;
  v.lightsOn = on;
}
