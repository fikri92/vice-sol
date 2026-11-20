// Rico Vance, the player: walk, run, jump, aim and fire on foot; enter and exit parked or
// stopped cars; health and armour; the two weapons (pistol, SMG) and their ammo. The mesh is a
// slightly larger, dressed version of a pedestrian with a cap, and the gun shows when aiming.

import * as THREE from 'three';
import { SPEEDS, COMBAT, HEALTH, PALETTE } from './config.js';
import { mergeGeometries } from './city.js';
import { hitColliders } from './vehicles.js';

const WEAPONS = [
  { name: 'FISTS', melee: true, damage: 12, rate: 0.5, ammo: Infinity },
  { name: 'PISTOL', damage: COMBAT.pistolDamage, rate: COMBAT.pistolRate, ammo: 60 },
  { name: 'SMG', damage: COMBAT.smgDamage, rate: COMBAT.smgRate, ammo: 150 },
];

function playerMesh() {
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
  add(0, 0.3, 0, 0.38, 0.9, 0.32, 0x2f3a52);      // legs
  add(0, 1.15, 0, 0.6, 0.75, 0.36, 0xe2725b);     // coral shirt
  add(0, 1.9, 0, 0.36, 0.36, 0.34, 0xd99a6c);     // head
  add(0, 2.16, 0, 0.42, 0.12, 0.44, 0xcf3f34);    // cap
  const left = new THREE.Object3D();
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.14, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x23262b }),
  );
  gun.position.set(0.28, 1.35, 0.3);
  gun.visible = false;
  return { mesh: new THREE.Mesh(mergeGeometries(parts), new THREE.MeshLambertMaterial({ vertexColors: true })), gun, armPivot: left };
}

export function createPlayer(scene, colliders) {
  const { mesh, gun } = playerMesh();
  mesh.castShadow = true;
  mesh.add(gun);
  scene.add(mesh);
  const player = {
    mesh, gun,
    pos: new THREE.Vector3(-4, 0, 44),
    heading: Math.PI,
    speed: 0,
    vy: 0, onGround: true,
    health: HEALTH.max, armor: 0,
    weaponIndex: 1,
    ammo: WEAPONS.map((w) => w.ammo),
    fireTimer: 0,
    vehicle: null,
    money: 250,
    alive: true,
    isPed: true,
    weapons: WEAPONS,
    aimHeading: null,
    phase: 0,
  };

  /** On-foot movement: walk or sprint, jump, steer with WASD relative to the camera. */
  function moveOnFoot(dt, moveX, moveZ, sprint, cameraYaw, aiming) {
    const run = sprint && !aiming;
    const rate = run ? SPEEDS.run : SPEEDS.walk;
    if (moveX !== 0 || moveZ !== 0) {
      // Re-map input over the camera's yaw so "forward" is away from the camera.
      const cx = Math.sin(cameraYaw), cz = Math.cos(cameraYaw);
      const panX = moveX * cz - moveZ * cx;
      const panZ = -moveX * cx - moveZ * cz;
      const len = Math.hypot(panX, panZ) || 1;
      const nx = player.pos.x + panX / len * rate * dt;
      const nz = player.pos.z + panZ / len * rate * dt;
      if (!hitColliders(nx, player.pos.z, 0.42, colliders)) player.pos.x = nx;
      if (!hitColliders(player.pos.x, nz, 0.42, colliders)) player.pos.z = nz;
      if (!aiming) {
        player.heading = Math.atan2(panX, panZ);
        player.aimHeading = null;
      }
      player.speed = rate;
      player.phase += dt * (run ? 13 : 8);
    } else {
      player.speed = 0;
    }
    // Jump: a short hop with flat arcade gravity.
    if (player.vy !== 0 || !player.onGround) {
      player.vy -= SPEEDS.gravity * dt;
      player.pos.y += player.vy * dt;
      if (player.pos.y <= 0) { player.pos.y = 0; player.vy = 0; player.onGround = true; }
    }
  }

  function jump() {
    if (player.onGround) {
      player.vy = 8.2;
      player.onGround = false;
    }
  }

  /** Cycle FISTS -> PISTOL -> SMG and back. */
  function switchWeapon() {
    player.weaponIndex = (player.weaponIndex + 1) % WEAPONS.length;
    return currentWeapon();
  }

  function currentWeapon() {
    return WEAPONS[player.weaponIndex];
  }

  /** Sit a player into a car, hiding the walking mesh. */
  function enterVehicle(v) {
    player.vehicle = v;
    v.driver = 'player';
    mesh.visible = false;
  }

  /** Step out beside the car and take the heading of the door. */
  function exitVehicle() {
    const v = player.vehicle;
    if (!v) return null;
    player.vehicle = null;
    v.driver = null;
    v.throttle = 0; v.brake = 1;
    player.pos.set(v.x - Math.cos(v.heading) * 2.2, 0, v.z + Math.sin(v.heading) * 2.2);
    player.heading = v.heading;
    mesh.visible = true;
    return v;
  }

  function aimAt(aimX, aimZ) {
    const dx = aimX - player.pos.x, dz = aimZ - player.pos.z;
    player.aimHeading = Math.atan2(dx, dz);
    player.heading = player.aimHeading;
  }

  function damage(amount) {
    const toArmor = Math.min(player.armor, amount * 0.6);
    player.armor -= toArmor;
    player.health -= amount - toArmor;
    if (player.health <= 0) {
      player.health = 0;
      player.alive = false;
    }
  }

  function heal() {
    player.health = HEALTH.max;
    player.armor = HEALTH.armorMax;
    player.alive = true;
  }

  function sync(dt) {
    mesh.position.set(player.pos.x, player.pos.y + Math.abs(Math.sin(player.phase)) * 0.07, player.pos.z);
    mesh.rotation.y = player.heading;
    gun.visible = player.weaponIndex > 0 && !player.vehicle;
  }

  function state() {
    return {
      pos: player.pos, heading: player.heading, health: player.health,
      armor: player.armor, money: player.money, weapon: currentWeapon().name,
      ammo: player.ammo[player.weaponIndex], vehicle: player.vehicle, alive: player.alive,
    };
  }

  return { player, moveOnFoot, jump, switchWeapon, currentWeapon, enterVehicle, exitVehicle, aimAt, damage, heal, sync, state, WEAPONS };
}
