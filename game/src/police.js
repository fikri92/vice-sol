// The police: a wanted level 0-5 fed by heat, decaying while out of sight, cruisers and foot
// cops pursuing when it rises, a roadblock at four stars and a bust that costs cash and weapons
// when they close in. Detective Hale's dispatch lines go through the HUD notify hook.

import { WANTED, PALETTE } from './config.js';
import { createVehicle, stepVehiclePhysics } from './vehicles.js';
import { routeBetweenNodes, nearestRoadPoint } from './roads.js';

export function createPolice(scene, random, colliders, hooks) {
  const cops = [];       // foot officers
  const cruisers = [];   // patrol cars
  let heat = 0;
  let stars = 0;
  let blockades = [];
  let bustTimer = 0;

  function raiseWantedLevel(amount) {
    heat = Math.min(WANTED.levels[5] + 40, heat + amount);
    syncStars();
    if (stars > 0) ensureUnits();
  }

  function decayWanted(dt) {
    heat = Math.max(0, heat - WANTED.decayPerSec * dt);
    syncStars();
    if (stars === 0) recallUnits();
  }

  function syncStars() {
    let s = 0;
    for (let i = 5; i >= 1; i -= 1) {
      if (heat >= WANTED.levels[i]) { s = i; break; }
    }
    if (s > stars) hooks.onStarsGained?.(s);
    stars = s;
  }

  /** Spawn enough cruisers and cops to match the wanted level within a few seconds. */
  function ensureUnits() {
    const wantCops = WANTED.copsByStar[stars];
    const wantCruisers = WANTED.cruisersByStar[stars];
    while (cruisers.length < wantCruisers) {
      const c = spawnCruiser();
      cruisers.push(c);
    }
    while (cops.length < wantCops) cops.push(spawnFootCop());
    if (stars >= 4 && blockades.length === 0) buildRoadblock();
  }

  function recallUnits() {
    for (const c of cruisers) scene.remove(c.mesh);
    for (const c of cops) scene.remove(c.mesh);
    cruisers.length = 0;
    cops.length = 0;
    clearBlockades();
  }

  /** A cruiser rolls in from the nearest avenue heading toward the player. */
  function spawnCruiser() {
    const near = nearestRoadPoint(hooks.playerX(), hooks.playerZ());
    const ang = random.range(0, Math.PI * 2);
    const dist = random.range(120, 190);
    const v = createVehicle('police', hooks.playerX() + Math.cos(ang) * dist, Math.min(620, Math.max(-620, hooks.playerZ() + Math.sin(ang) * dist)), 0, PALETTE.policeBody);
    v.driver = 'police';
    v.siren = true;
    v.route = routeBetweenNodes(near.row, near.col, near.row, near.col);
    scene.add(v.mesh);
    return v;
  }

  /** Foot officers spawn nearer, sprinting at the player. */
  function spawnFootCop() {
    const ang = random.range(0, Math.PI * 2);
    const dist = random.range(50, 110);
    const mesh = hooks.makePerson(0x1d3f8f, 0x0f2544, 0xe8b48c);
    mesh.position.set(hooks.playerX() + Math.cos(ang) * dist, 0, hooks.playerZ() + Math.sin(ang) * dist);
    scene.add(mesh);
    const cop = {
      mesh, isPed: true,
      x: mesh.position.x, z: mesh.position.z,
      heading: 0, health: 60, alive: true, hostile: true,
      speed: 5.6, phase: 0,
    };
    return cop;
  }

  /** Two cruisers parked across the road ahead of the player at four stars and above. */
  function buildRoadblock() {
    const near = nearestRoadPoint(hooks.playerX(), hooks.playerZ());
    const aheadZ = hooks.playerZ() + (hooks.playerZ() > near.z ? 70 : -70);
    for (let i = 0; i < 2; i += 1) {
      const v = createVehicle('police', near.x - 5 + i * 5, aheadZ, Math.PI / 2, PALETTE.policeBody);
      v.driver = 'police';
      v.siren = true;
      v.speed = 0;
      v.brake = 1;
      blockades.push(v);
      scene.add(v.mesh);
    }
    hooks.notify?.('Police roadblock ahead!');
  }

  function clearBlockades() {
    for (const v of blockades) scene.remove(v.mesh);
    blockades = [];
  }

  /** One step of pursuit: cruisers steer at the player, cops sprint, the bust counts up. */
  function step(dt, playerState) {
    decayWanted(dt);
    let closest = Infinity;
    for (let i = 0; i < cruisers.length; i += 1) {
      const v = cruisers[i];
      const dx = playerState.x - v.x, dz = playerState.z - v.z;
      const dist = Math.hypot(dx, dz);
      closest = Math.min(closest, dist);
      v.sirenPhase = (v.sirenPhase + dt * 6) % 1;
      // Ram-toward pursuit: full throttle, steer to face the player.
      const want = Math.atan2(dx, dz);
      let diff = want - v.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      v.steer = Math.max(-1, Math.min(1, diff * 1.4));
      v.throttle = dist > 8 ? 1 : -0.2;
      v.brake = 0;
      stepVehiclePhysics(v, dt, colliders);
    }
    for (let i = 0; i < cops.length; i += 1) {
      const c = cops[i];
      const dx = playerState.x - c.x, dz = playerState.z - c.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 60) {
        c.heading = Math.atan2(dx, dz);
        c.x += Math.sin(c.heading) * c.speed * dt;
        c.z += Math.cos(c.heading) * c.speed * dt;
        c.phase += dt * 10;
        c.mesh.position.set(c.x, Math.abs(Math.sin(c.phase)) * 0.06, c.z);
        c.mesh.rotation.y = c.heading;
        closest = Math.min(closest, dist);
      }
    }
    // Bust: half a second inside arm's reach on foot (never during a staged screenshot).
    const staging = hooks.staging ? hooks.staging() : false;
    if (!staging && stars > 0 && closest < WANTED.bustDistance && !playerState.inVehicle && playerState.alive) {
      bustTimer += dt;
      if (bustTimer > 0.6) {
        bustTimer = 0;
        hooks.onBusted?.();
        heat = 0;
        syncStars();
        recallUnits();
      }
    } else {
      bustTimer = 0;
    }
  }

  function officerDown(entity) {
    entity.alive = false;
    if (entity.mesh) scene.remove(entity.mesh);
    raiseWantedLevel(70);
  }

  return {
    raiseWantedLevel, decayWanted, step, officerDown, ensureUnits,
    get stars() { return stars; },
    get heat() { return heat; },
    cops, cruisers,
  };
}
