// The orchestrator: builds the world and every system, then runs them in a fixed order each
// step (input, player, vehicles, traffic, police, missions, effects, audio, HUD), draws the
// frame, handles respawn after a bust or death, and exposes the state both the HUD and the
// shot staging read.

import * as THREE from 'three';
import { SPEEDS, WANTED, HEALTH, HUD, MISSIONS } from './config.js';
import { createRandom } from './random.js';
import { ACTION_ENTER, ACTION_PAUSE, ACTION_WEAPON, keyAxis, takeActions } from './input.js';
import { buildWorld, pointIsClear } from './world.js';
import { createCameraRig } from './camera.js';
import { createPedestrians } from './pedestrians.js';
import { createTraffic } from './traffic.js';
import { createPlayer } from './player.js';
import { createVehicle, createVehicleMesh, stepVehiclePhysics, syncVehicleMesh } from './vehicles.js';
import { createCombat } from './combat.js';
import { createEffects } from './effects.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createAudio } from './audio.js';
import { createMenu } from './menu.js';
import { saveGame, loadGame } from './save.js';

export function createGame(rig, random) {
  const scene = rig.scene;
  const camera = createCameraRig(window.innerWidth / window.innerHeight);
  const world = buildWorld(scene, random);
  const colliders = world.colliders;
  const hud = createHud();
  const effects = createEffects(scene, camera, cameraRigKick);
  const combat = createCombat(scene, random, camera);
  const audio = createAudio();
  const menu = createMenu(hud, audio);
  menu.wireFirstGesture();

  const playerCtl = createPlayer(scene, colliders);
  const player = playerCtl.player;
  player.pos.set(-4, 0, 44);

  const traffic = createTraffic(scene, random, colliders);
  const peds = createPedestrians(scene, random, colliders);

  // The player's orange muscle car waits on the boulevard where the cover shot finds it.
  const playerCar = createVehicle('muscle', -8, 30, Math.PI * 0.5, 0xE8641B);
  playerCar.spec.max = 30;
  scene.add(playerCar.mesh);
  for (let i = 0; i < 8; i += 1) {
    const v = createVehicle(random.pick(['sedan', 'van', 'taxi']),
      -80 - (i % 4) * 30, -300 + (i % 3) * 90, random.range(0, Math.PI * 2));
    syncVehicleMesh(v);
    scene.add(v.mesh);
  }
  traffic.setPlayerCar(playerCar);

  const police = createPolice(scene, random, colliders, policeHooks());
  const missions = createMissions(missionHooks());
  const minimap = createMinimap(peds, traffic, police, missions);

  let started = false;
  let shotName = null;
  let timeSec = 0;
  let bustLoss = 0;
  let everWanted = false;
  const cacheV3 = new THREE.Vector3();

  function cameraRigKick(amount) { camera.kick(amount); }

  function policeHooks() {
    return {
      playerX: () => player.pos.x,
      playerZ: () => player.pos.z,
      makePerson: (shirt, pants, skin) => peds.spawnPed(player.pos.x, player.pos.z, 60, false)?.mesh ?? new THREE.Mesh(),
      notify: (text) => hud.notify(text),
      onBusted: () => doBust(),
      onStarsGained: (s) => {
        everWanted = true;
        hud.notify(`${'★'.repeat(s)} Wanted level ${s}`);
      },
      staging: () => shotName !== null,
    };
  }

  function missionHooks() {
    return {
      scene,
      random,
      showBanner: (t) => hud.showBanner(t),
      subtitles: (n, l) => hud.subtitles(n, l),
      notify: (t) => hud.notify(t),
      setObjectiveText: (t) => hud.setObjectiveText(t),
      payReward: (amount) => { player.money += amount; saveAnyway(); },
      spawnHostile: (x, z) => {
        const p = peds.spawnPed(x, z, 8, true);
        p.hostile = true;
        p.health = 60;
        p.panic = 0;
        return p;
      },
    };
  }

  function saveAnyway() {
    saveGame({
      money: player.money, health: player.health, armor: player.armor,
      weaponIndex: player.weaponIndex, ammo: playerCtl.ammoOf(),
      missionIndex: missionIndex(), jobsDone: missions.state().completed,
    });
  }

  function missionIndex() {
    return MISSIONS.indexOf(missions.currentJob());
  }

  function ammoOf() { return player.ammo; }

  // Cars the player may borrow: the muscle car, the parked ones and all ambient traffic.
  function enterableCars() {
    const list = [playerCar, ...traffic.cars];
    return list;
  }

  /** Try to enter the nearest enterable car within reach. */
  function tryEnterCar() {
    if (player.vehicle) { exitCar(); return; }
    let best = null, bestD = 4.2;
    for (const v of enterableCars()) {
      if (!v || !v.alive) continue;
      const d = (v.x - player.pos.x) ** 2 + (v.z - player.pos.z) ** 2;
      if (d < bestD) { bestD = d; best = v; }
    }
    if (best) {
      playerCtl.enterVehicle(best);
      traffic.setPlayerCar(best);
      hud.notify(best.kind === 'police' ? 'Stolen police cruiser!' : 'Vehicle acquired');
      if (best.driver === 'traffic') police.raiseWantedLevel(12); else if (best.kind === 'police') police.raiseWantedLevel(40);
    }
  }

  function exitCar() {
    const v = playerCtl.exitVehicle();
    traffic.setPlayerCar(playerCar);
    return v;
  }

  function fireWeapon(dt) {
    player.fireTimer -= dt;
    if (!inputHeld('fire') || player.fireTimer > 0) return;
    const weapon = playerCtl.currentWeapon();
    if (weapon.melee) {
      player.fireTimer = weapon.rate;
      meleeSwing();
      return;
    }
    if ((player.ammo[player.weaponIndex] ?? 0) <= 0) { hud.notify('Out of ammo'); return; }
    player.ammo[player.weaponIndex] -= 1;
    player.fireTimer = weapon.rate;
    const origin = { x: player.pos.x, y: 1.45, z: player.pos.z };
    const dirX = Math.sin(player.heading), dirZ = Math.cos(player.heading);
    const targets = [...peds.peds, ...police.cops, ...traffic.cars, playerCar, ...police.cruisers];
    combat.fireShot(origin, dirX, dirZ, weapon, targets, colliders, (hit, dmg, kind) => {
      applyHit(hit, dmg, kind);
    });
    audio.gunshot();
    hud.update(state());
    pedsMarkPanicked();
    police.raiseWantedLevel(kind === 'car' ? 6 : 14);
  }

  /** The crowd panics from wherever the shot landed. */
  function pedsMarkPanicked() {
    panickedAt = { x: player.pos.x, z: player.pos.z };
  }

  let panickedAt = null;

  function applyHit(hit, dmg, kind) {
    if (kind === 'ped') {
      hit.health -= dmg;
      effects.sparks(hit.x, 1.4, hit.z, 0xff9a7a);
      if (hit.health <= 0) {
        hit.alive = false;
        hit.mesh && scene.remove(hit.mesh);
        police.raiseWantedLevel(hit.hostile ? 25 : 45);
        missions.targetDown(hit);
        if (!hit.hostile) player.money += 5;
      } else if (!hit.hostile) {
        hit.panic = 4;
        hit.heading = Math.atan2(hit.x - player.pos.x, hit.z - player.pos.z);
      }
    } else if (kind === 'car') {
      hit.health -= dmg * 0.8;
      effects.sparks(hit.x, 1.2, hit.z, 0xffcf7a);
      if (hit.health <= 22) {
        effects.explosion(hit.x, 1, hit.z, 1.2);
        audio.explosion();
        hit.alive = false;
        police.raiseWantedLevel(60);
      }
    }
  }

  /** Melee: a short reach check in front of Rico. */
  function meleeSwing() {
    const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
    for (const t of [...peds.peds, ...police.cops]) {
      if (!t.alive) continue;
      const dx = t.x - player.pos.x, dz = t.z - player.pos.z;
      if (dx * fx + dz * fz > 0 && dx * dx + dz * dz < 6) {
        applyHit(t, 12, 'ped');
        break;
      }
    }
  }

  function doBust() {
    // Busted: cash fine, weapons gone, respawn at the precinct steps.
    bustLoss = Math.min(player.money, 250);
    player.money -= bustLoss;
    player.weaponIndex = 0;
    player.ammo = [Infinity, 24, 0];
    hud.notify(`Busted. Paid $${bustLoss} in fines.`);
    respawn(-560, 6);
  }

  function respawn(x, z) {
    if (player.vehicle) exitCar();
    player.pos.set(x, 0, z);
    playerCtl.heal();
    police.decayWanted(9999);
    saveAnyway();
  }

  function onPlayerDown() {
    hud.notify('Wasted. Waking up at the beach clinic...');
    player.money = Math.max(0, player.money - 150);
    respawn(20, 60);
  }

  function inputHeld(name) {
    return !!heldHolds && heldHolds.has(fireKeyOf(name));
  }

  function fireKeyOf(name) {
    return name === 'fire' ? 'Space' : name;
  }

  let heldInput = null;
  let heldHolds = null;
  const holds = new Set();

  /** One fixed step: systems run in a fixed order. */
  function step(input, dt) {
    heldInput = input;
    heldHolds = input ? input.held : holds;
    timeSec += dt;
    if (!started) return;
    const actions = input ? takeActions(input) : 0;
    if (menu.isPaused()) return;

    const moveX = input ? keyAxis(input, 'KeyD', 'ArrowRight', 'KeyA', 'ArrowLeft') : 0;
    const moveZ = input ? -(keyAxis(input, 'KeyW', 'ArrowUp', 'KeyS', 'ArrowDown')) : 0;
    const sprint = input ? input.held.has('ShiftLeft') || input.held.has('ShiftRight') : false;

    if (player.vehicle) {
      const v = player.vehicle;
      if (input) {
        v.steer = -moveX;
        v.throttle = -moveZ > 0 ? 1 : moveZ > 0 ? -0.6 : 0;
        v.brake = input.held.has('Space') ? 1 : 0;
        if (Math.abs(v.speed) > 18 && Math.abs(v.steer) > 0.6) { effects.tyreSmoke(v.x, v.z); }
      }
      stepVehiclePhysics(v, dt, colliders);
      player.pos.set(v.x, 0, v.z);
    } else {
      const aiming = input ? input.mouse.down : false;
      if (input && aiming) {
        playerCtl.aimAt(player.pos.x + input.mouse.aimX, player.pos.z + input.mouse.aimY);
      }
      playerCtl.moveOnFoot(dt, moveZ, moveX, sprint, camera.yaw, aiming);
      if (input && input.held.has('KeyW') && actions === 0 && input.held.has('Space') === false) {
        // jump handled below
      }
      if (input && jumpQueued(actions, input)) playerCtl.jump();
      if (input) fireWeapon(dt);
    }

    if (input) {
      if (takeEnter(actions)) tryEnterCar();
      if (actions & ACTION_WEAPON) hud.notify(`Weapon: ${playerCtl.switchWeapon().name}`);
      if (actions & ACTION_PAUSE) menu.setPaused(!menu.isPaused());
    }
    if (input && input.mouse.aimX !== 0) {
      player.aimHeading = Math.atan2(input.mouse.aimX, input.mouse.aimY);
    }

    // The systems that run whether or not the player acts.
    traffic.step(dt, player.pos.x, player.pos.z);
    peds.step(dt, player.pos.x, player.pos.z, panickedAt);
    panickedAt = null;
    police.step(dt, { x: player.pos.x, z: player.pos.z, inVehicle: !!player.vehicle, alive: player.alive, stars: police.stars });
    missions.advanceMissionObjective(dt, {
      x: player.pos.x, z: player.pos.z, inVehicle: !!player.vehicle,
      stars: police.stars, everWanted,
    });
    combat.step(dt);
    effects.step(dt);
    camera.step(dt);
    playerCtl.sync(dt);
    if (!player.alive) onPlayerDown();

    rig.renderer && focusShadowsOn(player.pos.x, player.pos.z);
    hud.tick(dt);
    audio.update(state());
  }

  function takeEnter(actions) { return actions & ACTION_ENTER ? 1 : 0; }
  function jumpQueued(actions, input) { return input.held.has('KeyJ') && player.onGround; }

  function focusShadowsOn(x, z) {
    rig.sun.position.set(x + DAYLIGHT_SUN[0] * 0.35, DAYLIGHT_SUN[1], z + DAYLIGHT_SUN[2] * 0.35);
    rig.sun.target.position.set(x, 0, z);
    rig.sun.target.updateMatrixWorld();
  }

  const DAYLIGHT_SUN = [360, 150, 260];

  /** Draw one frame: camera mode, sky follow, render, HUD, minimap. */
  function render() {
    const dt = 1 / 60;
    if (shotName) {
      // Cinematic framing is set by the staging code; nothing moves the camera.
    } else if (player.vehicle) {
      camera.followCar(player.vehicle, Math.abs(player.vehicle.speed), dt);
    } else {
      camera.followOnFoot({ pos: player.pos, heading: player.heading, aimHeading: player.aimHeading }, inputHeld('fire'), dt);
    }
    world.sky.update(camera.camera);
    rig.renderer.render(scene, camera.camera);
    hud.update(state());
    hud.setVisible(true);
    minimap.drawMinimapBlips(player.pos.x, player.pos.z, player.heading, camera.yaw, missionPoints());
  }

  function missionPoints() {
    const obj = missions.currentObjective();
    const pts = [];
    if (obj && obj.x !== undefined) pts.push({ x: obj.x, z: obj.z, visible: true });
    return pts;
  }

  /** Everything the HUD and the staging code read. */
  function state() {
    return {
      money: player.money, health: player.health, armor: player.armor,
      weapon: playerCtl.currentWeapon().name,
      ammo: player.ammo[player.weaponIndex],
      wanted: police.stars, vehicle: player.vehicle,
      alive: player.alive, position: player.pos,
      stars: police.stars, everWanted, timeSec,
      job: missions.state(),
    };
  }

  /** Begin play: intro job, HUD on, camera behind Rico. */
  function start(input) {
    started = true;
    hud.setVisible(true);
    if (!missions.state().active) missions.beginMission(0);
    const saved = loadGame();
    if (saved && saved.money > HUD.cashStart && saved.jobsDone === 0) {
      hud.notify('Save found: fresh start chosen.');
    }
  }

  /** Entry points the shot staging uses. */
  function prepare() {
    started = true;
  }

  const api = {
    camera, hud, missions, police, traffic, peds, player: playerCtl, effects, combat, audio, menu,
    scene, colliders, world,
    step, render, state, start, prepare,
    spawnCrowdAround,
    setShotName(name) { shotName = name; },
    get shotName() { return shotName; },
    get started() { return started; },
    playerCar,
    setEverWanted() { everWanted = true; },
  };

  function spawnCrowdAround(x, z, cars, pedsCount, radius) {
    traffic.spawnCrowdAround(x, z, cars, (cx, cz, r) => {
      peds.spawnCrowdAround(cx, cz, pedsCount, r);
    }, radius);
    peds.spawnCrowdAround(x, z, pedsCount, radius);
  }

  return api;
}

