// The four screenshot scenes behind ?shot=cover|foot|mission|city. Each one drives the real
// simulation forward from the seeded world for about four seconds, places the actors and the
// crowd exactly where the frame needs them, sets the HUD the way the story has it at that
// moment, and leaves the camera in cinematic mode. The cover shows Rico's orange muscle car on
// the sunlit boulevard under three stars of heat; foot puts Rico armed on a downtown sidewalk;
// mission frames a marina handoff dialogue with Mira; city is a high aerial of Vice Sol.

import { HUD } from './config.js';
import * as THREE from 'three';
import { getTextures } from './textures.js';

const STEP = 1 / 60;
const WARM_SECONDS = 4;

/** A soft additive-looking glow sprite at (x, y, z) used for lit police lights. */
function attachGlow(scene, mapName, x, y, z) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getTextures()[mapName], transparent: true, opacity: 0.95, depthWrite: false,
  }));
  sprite.scale.setScalar(1.1);
  sprite.position.set(x, y, z);
  scene.add(sprite);
  return sprite;
}

export function stageShot(game, name, rig) {
  const overlay = document.getElementById('startBtn').parentElement;
  overlay.hidden = true;
  game.prepare();
  game.hud.setVisible(true);
  game.setShotName(name);
  const player = game.player.player;
  const cams = game.camera;

  // Everything common: a crowd near the camera so no frame looks abandoned.
  function warmSteps() {
    for (let i = 0; i < WARM_SECONDS / STEP; i += 1) game.step(null, STEP);
  }

  if (name === 'cover') {
    stageCover();
  } else if (name === 'foot') {
    stageFoot();
  } else if (name === 'mission') {
    stageMission();
  } else {
    stageCity();
  }
  warmSteps();
  // Re-pin the staged props that the four warm seconds would have moved.
  if (name === 'cover') {
    const cruisers = game.police.cruisers;
    for (let i = 0; i < cruisers.length && i < 2; i += 1) {
      const c = cruisers[i];
      c.x = -13 + i * 12; c.z = 52 + i * 4; c.speed = 0; c.throttle = 0; c.brake = 1;
      c.heading = Math.PI / 2;
      c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = c.heading;
      if (c.glowA) c.glowA.position.set(c.x - 1, 1.85, c.z);
      if (c.glowB) c.glowB.position.set(c.x + 1, 1.85, c.z);
    }
    const car = game.playerCar;
    car.speed = 21;
  }

  function stageCover() {
    // The player's muscle car basks on the boulevard asphalt, mid-drive at 120.
    const car = game.playerCar;
    car.x = -4; car.z = 104; car.heading = -Math.PI / 2;
    car.speed = 21; car.throttle = 1;
    player.pos.set(car.x, 0, car.z);
    // Rico is at the wheel for this shot: the HUD speedometer reads his run down the strip.
    game.player.enterVehicle(car);
    game.police.raiseWantedLevel(260);
    // Two cruisers with lit lightbars across the middle distance of the boulevard.
    const cruisers = game.police.cruisers;
    for (let i = 0; i < cruisers.length && i < 2; i += 1) {
      cruisers[i].x = -16 + i * 12;
      cruisers[i].z = 66;
      cruisers[i].heading = Math.PI / 2;
      cruisers[i].siren = true;
      cruisers[i].sirenPhase = i * 0.5;
    }
    game.missions.beginMission(3);
    game.spawnCrowdAround(-4, 86, 34, 46, 90);
    // Traffic rolling up the boulevard toward and away from the camera.
    const boulevardCars = game.traffic.cars.slice(0, 10);
    boulevardCars.forEach((c, i) => {
      c.x = -5 + (i % 2) * 9.4;
      c.z = 26 + i * 9;
      c.heading = Math.PI * (i % 2 === 0 ? 0.5 : -0.5);
      c.speed = 8 + (i % 3) * 2;
      c.mesh.visible = true;
    });
    // Lit red/blue light glows over the two roadblock cruisers, visible in daylight.
    for (let i = 0; i < cruisers.length && i < 2; i += 1) {
      const c = cruisers[i];
      c.glowA = attachGlow(game.scene, 'glowRed', c.x - 1, 1.9, c.z);
      c.glowB = attachGlow(game.scene, 'glowBlue', c.x + 1, 1.9, c.z);
    }
    // Low and close: asphalt and car in the lower two thirds, hotels down the right side,
    // palms on the median, sea horizon with sun glint top-left behind.
    cams.setCinematic(7, 1.6, 118, -4, -6, 92, 57);
  }

  function stageFoot() {
    // Rico armed on a downtown sidewalk, taxi rolling past, shoppers around him.
    player.pos.set(-311, 0, -192);
    player.heading = Math.PI * 0.85;
    player.weaponIndex = 2; // SMG out
    game.missions.beginMission(4);
    game.hud.subtitles('MIRA SOLANO', 'The lieutenants work the glass towers, two blocks west.');
    game.spawnCrowdAround(-306, -196, 22, 34, 45);
    // A taxi close by in the street for scale and colour.
    const taxi = game.traffic.cars.find((c) => c.kind === 'taxi');
    if (taxi) {
      taxi.x = -292; taxi.z = -206; taxi.heading = 0.4; taxi.speed = 8;
    }
    // Camera on the far sidewalk, level with Rico's shoulders, tilted to keep the towers in.
    cams.setCinematic(-290, 2.7, -182, -312, -5, -198, 60);
  }

  function stageMission() {
    // The marina handoff: Mira and Rico in profile against the boats and masts.
    player.pos.set(64, 0, -318);
    player.heading = Math.PI * 0.25;
    game.missions.beginMission(5);
    game.hud.subtitles('MIRA SOLANO', 'Pick up the Broker\'s briefcase at the marina. Do not open it.');
    game.hud.showBanner('Job 6 — The Marina Handoff');
    game.spawnCrowdAround(58, -310, 12, 18, 70);
    // Mira herself: a figure in gold, held still in profile beside Rico.
    const mira = game.peds.spawnPed(60, -316, 2, false, [0xf2b134, 0x8c5a2b, 0xd99a6c]);
    mira.freeze = true;
    mira.heading = Math.atan2(player.pos.x - mira.x, player.pos.z - mira.z);
    // Both in profile in warm side light, masts and piers filling the right of frame.
    cams.setCinematic(48, 2.2, -296, 66, -1, -322, 55);
  }

  function stageCity() {
    // A high aerial in clear air: grid, beach, marina, docks, ocean, traffic as dots.
    game.missions.beginMission(0);
    game.spawnCrowdAround(-120, 40, 52, 60, 170);
    // Down-and-across framing: horizon in the top quarter, the whole grid below it.
    game.scene.fog.near = 420;
    game.scene.fog.far = 2200;
    cams.setCinematic(50, 250, 310, -200, 0, -70, 58);
  }

  return { shot: name };
}
