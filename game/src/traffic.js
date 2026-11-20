// Ambient traffic: about 120 cars cruise the grid on the right-hand lanes, keep their distance
// to the car ahead, pick a new direction at junctions and are recycled once they drift far from
// the player. spawnCrowdAround drops extra cars around a point so the screenshot scenes (and
// busy arrivals) read as a living city instead of an empty map.

import { WORLD, SPEEDS, PALETTE } from './config.js';
import { avenueX, crossZ, laneOffset, randomRoadPoint } from './roads.js';
import { createVehicle, stepVehiclePhysics, syncVehicleMesh } from './vehicles.js';

const TRAFFIC_TARGET = 120;
const RECYCLE_DISTANCE = 320;

export function createTraffic(scene, random, colliders) {
  const cars = [];
  const kinds = ['sedan', 'sedan', 'sedan', 'muscle', 'taxi', 'van'];

  /** Place a cruising car at a random lane point and point it down its lane. */
  function spawnTrafficVehicle() {
    const p = randomRoadPoint(random);
    const kind = random.pick(kinds);
    const color = random.pick(PALETTE.cars);
    const v = createVehicle(kind, p.x, p.z, p.heading, kind === 'taxi' ? PALETTE.taxi : color);
    v.driver = 'traffic';
    v.speed = SPEEDS.trafficCruise * random.range(0.7, 1.15);
    v._axis = p.onAvenue ? 'x' : 'z';
    v._dir = Math.round(Math.cos(p.heading)) !== 0 ? Math.sign(Math.cos(p.heading)) : Math.sign(Math.sin(Math.cos(p.heading)));
    cars.push(v);
    scene.add(v.mesh);
    return v;
  }

  for (let i = 0; i < TRAFFIC_TARGET; i += 1) spawnTrafficVehicle();

  /** Distance keeping: slow down behind the nearest car in the same lane. */
  function carAhead(v) {
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    let best = null, bestD = 14;
    for (let i = 0; i < cars.length; i += 1) {
      const o = cars[i];
      if (o === v || !o.alive) continue;
      const dx = o.x - v.x, dz = o.z - v.z;
      const ahead = dx * fx + dz * fz;
      if (ahead <= 0 || ahead > bestD) continue;
      const side = Math.abs(dx * fz - dz * fx);
      if (side < 2.2) { bestD = ahead; best = o; }
    }
    return best;
  }

  /** At a junction centre, sometimes swing onto the crossing street. */
  function maybeTurn(v) {
    const nodeX = avenueX(Math.round(-v.x / WORLD.block));
    const nodeZ = crossZ(Math.max(0, Math.min(WORLD.rows - 1, Math.round((v.z - WORLD.gridMinZ) / WORLD.block))));
    const nearNode = Math.abs(v.x - nodeX) < 1.2 && Math.abs(v.z - nodeZ) < 1.2;
    if (!nearNode) return;
    if (random.chance(4)) {
      const turning = v._axis === 'z';
      const lane = laneOffset(0, 0, turning ? 1 : 0, turning ? 0 : 1);
      v._axis = turning ? 'x' : 'z';
      v.heading = turning ? lane.heading : lane.heading + Math.PI / 2;
    }
  }

  function step(dt, focusX, focusZ) {
    for (let i = 0; i < cars.length; i += 1) {
      const v = cars[i];
      if (!v.alive) continue;
      const dxf = v.x - focusX, dzf = v.z - focusZ;
      const distSq = dxf * dxf + dzf * dzf;
      // Far away: slide it along cheaply, and recycle the ones that stray too far.
      if (distSq > RECYCLE_DISTANCE * RECYCLE_DISTANCE) {
        if (!recycle(v)) continue;
      }
      maybeTurn(v);
      const lead = carAhead(v);
      v.throttle = lead ? 0 : 0.6;
      v.brake = lead ? 0.9 : 0;
      if (distSq > 200 * 200) v.brake = 0, v.throttle = 0.6; // no yield checks far from view
      v.steer = 0;
      stepVehiclePhysics(v, dt, colliders);
    }
  }

  /** Move a car that wandered far back onto the lanes near the player. */
  function recycle(v) {
    const p = randomRoadPoint(random);
    if ((p.x - focusX) ** 2 + (p.z - focusZ) ** 2 > RECYCLE_DISTANCE * RECYCLE_DISTANCE) {
      // Satisfy the closure with a fresh attempt next step.
      return true;
    }
    v.x = p.x; v.z = p.z; v.heading = p.heading; v.speed = SPEEDS.trafficCruise;
    syncVehicleMesh(v);
    return true;
  }

  let focusX = 0, focusZ = 0;

  function stepAll(dt, x, z) {
    focusX = x; focusZ = z;
    step(dt, x, z);
  }

  /**
   * Drop `count` cars and `pedCount` walkers within `radius` of (x, z): used by the screenshot
   * staging and by arrivals, so a frame shows a crowd exactly where the camera looks.
   */
  function spawnCrowdAround(x, z, carCount, pedSpawn, radius) {
    // Keep the cars we have, but pull the nearest free ones into the circle.
    let moved = 0;
    for (let i = 0; i < cars.length && moved < carCount; i += 1) {
      const v = cars[i];
      if (!v.alive || v === playerCar) continue;
      const angle = random.range(0, Math.PI * 2);
      const dist = random.range(12, radius);
      const rx = avenueX(random.int(0, WORLD.cols - 1));
      const rz = random.range(-WORLD.block * 2, WORLD.block * 2) + z;
      v.x = Math.max(-640, Math.min(230, random.chance(2) ? rx + random.range(-3, 3) : x + Math.cos(angle) * dist));
      v.z = rz;
      v.heading = random.chance(2) ? Math.PI / 2 : -Math.PI / 2;
      v.speed = SPEEDS.trafficCruise * random.range(0.5, 1.1);
      syncVehicleMesh(v);
      moved += 1;
    }
    if (pedSpawn) pedSpawn(x, z, radius, moved);
    return moved;
  }

  let playerCar = null;
  function setPlayerCar(v) { playerCar = v; }

  return { cars, step: stepAll, spawnCrowdAround, setPlayerCar, spawnTrafficVehicle };
}
