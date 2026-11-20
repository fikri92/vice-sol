// The eight story jobs: giver dialogue over the subtitle, one objective active at a time, a
// glowing cylinder marker at the target, pickup stashes and hostile crews spawned on demand,
// and rewards paid through the HUD. advanceMissionObjective() is the whole state machine.

import * as THREE from 'three';
import { MISSIONS, HUD } from './config.js';

const GIVERS = {
  mira: { name: 'MIRA SOLANO', color: 0xf2b134 },
  broker: { name: 'THE BROKER', color: 0x8d5bd6 },
  hale: { name: 'DETECTIVE HALE', color: 0x3e8ed0 },
};

export function createMissions(hooks) {
  const markerGeo = new THREE.CylinderGeometry(2.4, 2.4, 5.2, 18, 1, true);
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  const markers = [];
  for (let i = 0; i < 3; i += 1) {
    const m = new THREE.Mesh(markerGeo, markerMat.clone());
    m.visible = false;
    hooks.scene.add(m);
    markers.push(m);
  }
  const pickupGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
  const pickupMat = new THREE.MeshLambertMaterial({ color: 0x59d977, emissive: 0x1c5e2c });

  let index = 0;             // which job (0-based into MISSIONS)
  let objectiveIndex = 0;     // which objective inside the job
  let active = false;
  let targets = [];          // hostile peds to eliminate
  let pickups = [];          // stash boxes to collect
  let completedCount = 0;

  function currentJob() {
    return MISSIONS[index];
  }

  function currentObjective() {
    return currentJob().objectives[objectiveIndex];
  }

  /** Show the marker mesh at the objective point (or hide it for 'escape'). */
  function placeMarkers() {
    markers.forEach((m) => { m.visible = false; });
    const obj = currentObjective();
    if (!obj || obj.kind === 'escape') return;
    const m = markers[0];
    m.position.set(obj.x, 2.6, obj.z);
    m.visible = true;
  }

  /** Start dialogue with the giver: banner, subtitle, HUD calls. */
  function beginMission(jobIndex) {
    index = jobIndex;
    objectiveIndex = 0;
    active = true;
    targets = [];
    pickups = [];
    const job = currentJob();
    const giver = GIVERS[job.giver];
    hooks.showBanner(`Job ${job.id} — ${job.title}`);
    hooks.subtitles(giver.name, job.brief);
    hooks.notify(`New job: ${job.title} ($${job.reward})`);
    spawnObjectiveProps();
    placeMarkers();
  }

  /** Spawn the actors or pickups the current objective needs. */
  function spawnObjectiveProps() {
    const obj = currentObjective();
    if (!obj) return;
    if (obj.kind === 'eliminate') {
      targets = [];
      for (let i = 0; i < obj.n; i += 1) {
        const t = hooks.spawnHostile(obj.x + hooks.random.range(-obj.r, obj.r), obj.z + hooks.random.range(-obj.r, obj.r));
        targets.push(t);
      }
    } else if (obj.kind === 'collect') {
      pickups = [];
      for (let i = 0; i < obj.n; i += 1) {
        const mesh = new THREE.Mesh(pickupGeo, pickupMat);
        const a = (i / obj.n) * Math.PI * 2;
        mesh.position.set(obj.x + Math.cos(a) * obj.r * 0.6, 0.6, obj.z + Math.sin(a) * obj.r * 0.6);
        hooks.scene.add(mesh);
        pickups.push({ mesh, x: mesh.position.x, z: mesh.position.z, alive: true });
      }
    }
  }

  /** Check the live objective against the player state each step; run the completion chain. */
  function advanceMissionObjective(dt, playerState) {
    if (!active) return;
    const obj = currentObjective();
    if (!obj) return;
    let done = false;
    const px = playerState.x, pz = playerState.z;
    const inRange = obj.x !== undefined && (px - obj.x) ** 2 + (pz - obj.z) ** 2 < (obj.r ?? 8) ** 2;

    if (obj.kind === 'goto' && inRange) done = true;
    if (obj.kind === 'drive' && inRange && playerState.inVehicle) done = true;
    if (obj.kind === 'collect') {
      for (const p of pickups) {
        if (p.alive && (px - p.x) ** 2 + (pz - p.z) ** 2 < 9) {
          p.alive = false;
          hooks.scene.remove(p.mesh);
          hooks.notify('Stash collected');
        }
      }
      if (pickups.every((p) => !p.alive)) done = true;
    }
    if (obj.kind === 'eliminate') {
      targets = targets.filter((t) => t.alive);
      hooks.setObjectiveText(`${obj.text} (${obj.n - targets.length}/${obj.n})`);
      if (targets.length === 0) done = true;
    }
    if (obj.kind === 'escape') {
      hooks.setObjectiveText(obj.text);
      if (playerState.stars === 0 && playerState.everWanted) done = true;
    } else {
      hooks.setObjectiveText(obj.text);
    }

    if (done) {
      objectiveIndex += 1;
      if (objectiveIndex >= currentJob().objectives.length) {
        finishMission();
      } else {
        hooks.notify('Objective complete');
        const next = currentObjective();
        if (next.kind !== 'escape') hooks.subtitles('', next.text);
        spawnObjectiveProps();
        placeMarkers();
      }
    }
  }

  function finishMission() {
    const job = currentJob();
    hooks.payReward(job.reward);
    hooks.showBanner('');
    hooks.subtitles(GIVERS[job.giver].name, `Good work, Rico. $${job.reward} is yours.`);
    hooks.notify(`Job complete: +$${job.reward}`);
    active = false;
    objectiveIndex = 0;
    index = Math.min(index + 1, MISSIONS.length - 1);
    completedCount += 1;
    placeMarkers();
  }

  /** Report a hostile down, from combat. */
  function targetDown(entity) {
    if (targets.includes(entity)) hooks.notify('Target down');
  }

  function state() {
    return {
      active, jobId: currentJob().id, title: currentJob().title,
      objective: currentObjective()?.text ?? '',
      completed: completedCount,
    };
  }

  return { beginMission, advanceMissionObjective, targetDown, state, currentJob, currentObjective };
}
