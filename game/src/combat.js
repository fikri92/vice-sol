// Combat: hitscan shooting with tracer lines, muzzle flashes, spark impacts and damage to
// pedestrians, hostiles and vehicles. Every shot reports through the wanted hooks so the
// police system hears it, and panic spreads through the crowd.

import * as THREE from 'three';
import { COMBAT } from './config.js';
import { getTextures } from './textures.js';

export function createCombat(scene, random, cameraRig) {
  const tex = getTextures();
  const tracers = [];
  const flashes = [];
  const sparks = [];
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1),
  ]);
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.9 });

  function borrowTracer() {
    for (let i = 0; i < tracers.length; i += 1) if (!tracers[i].visible) return tracers[i];
    const line = new THREE.Line(tracerGeo, tracerMat);
    line.visible = false;
    scene.add(line);
    tracers.push(line);
    return line;
  }

  function borrowFlash() {
    for (let i = 0; i < flashes.length; i += 1) if (!flashes[i].visible) return flashes[i];
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, transparent: true, depthWrite: false }));
    spr.scale.setScalar(1.4);
    spr.visible = false;
    scene.add(spr);
    flashes.push(spr);
    return spr;
  }

  function spawnSparks(x, y, z, color) {
    for (let i = 0; i < sparks.length; i += 1) {
      if (sparks[i].life > 0) continue;
      const spr = sparks[i].sprite;
      spr.position.set(x, y, z);
      sparks[i].life = 0.25;
      return;
    }
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: color === 0 ? tex.glowRed : tex.glow, transparent: true, depthWrite: false }));
    spr.scale.setScalar(0.7);
    spr.position.set(x, y, z);
    scene.add(spr);
    sparks.push({ sprite: spr, life: 0.25 });
    return;
  }

  /**
   * One hitscan shot from origin toward (dirX, dirZ): tests peds, hittable cars and the world
   * colliders, draws a tracer and sparks at the hit point, and reports the damage dealt.
   */
  function fireShot(origin, dirX, dirZ, weapon, targets, colliders, onHit) {
    const len = Math.hypot(dirX, dirZ) || 1;
    const dx = dirX / len, dz = dirZ / len;
    let bestT = COMBAT.range;
    let best = null, bestKind = null;
    for (let i = 0; i < targets.length; i += 1) {
      const t = targets[i];
      if (!t.alive) continue;
      const px = (t.x !== undefined ? t.x : t.pos.x) - origin.x;
      const pz = (t.z !== undefined ? t.z : t.pos.z) - origin.z;
      const along = px * dx + pz * dz;
      if (along <= 0 || along > bestT) continue;
      const side = Math.abs(px * dz - pz * dx);
      const radius = t.mesh && t.isPed ? 0.6 : 1.6;
      if (side > radius) continue;
      bestT = along - 0.3;
      best = t;
      bestKind = t.isPed ? 'ped' : 'car';
    }
    // World colliders stop the bullet too (buildings and containers).
    for (let ci = 0; ci < colliders.length; ci += 1) {
      const c = colliders[ci];
      const t = rayVsBox(origin, dx, dz, c);
      if (t !== null && t < bestT) { bestT = t; best = null; bestKind = 'wall'; }
    }
    const hx = origin.x + dx * bestT;
    const hz = origin.z + dz * bestT;
    const line = borrowTracer();
    line.visible = true;
    line.position.set(origin.x, origin.y, origin.z);
    line.lookAt(hx, origin.y, hz);
    line.scale.z = bestT;
    const flash = borrowFlash();
    flash.position.set(origin.x + dx * 0.8, origin.y + 0.15, origin.z + dz * 0.8);
    flash.visible = true;
    spawnSparks(hx, 1.2, hz, bestKind === 'ped' ? 0 : 1);
    cameraRig.kick(0.06);
    if (best && bestKind !== 'wall') onHit(best, weapon.damage, bestKind);
    return { hit: best, kind: bestKind, x: hx, z: hz };
  }

  function rayVsBox(origin, dx, dz, c) {
    // 2D slab test of the ray against the collider footprint.
    let tmin = 0, tmax = COMBAT.range;
    for (const [o, d, lo, hi] of [[origin.x, dx, c.x0, c.x1], [origin.z, dz, c.z0, c.z1]]) {
      if (Math.abs(d) < 1e-6) {
        if (o < lo || o > hi) return null;
      } else {
        let t1 = (lo - o) / d, t2 = (hi - o) / d;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return null;
      }
    }
    return tmin;
  }

  /** Fade the tracers, flashes and sparks out each step. */
  function step(dt) {
    for (let i = 0; i < tracers.length; i += 1) if (tracers[i].visible) tracers[i].visible = false;
    for (let i = 0; i < flashes.length; i += 1) if (flashes[i].visible) flashes[i].visible = false;
    for (let i = 0; i < sparks.length; i += 1) {
      if (sparks[i].life > 0) {
        sparks[i].life -= dt;
        sparks[i].sprite.material.opacity = Math.max(0, sparks[i].life * 4);
        if (sparks[i].life <= 0) sparks[i].sprite.visible = false;
      }
    }
  }

  return { fireShot, step, spawnSparks };
}
