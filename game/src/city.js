// The static city: ground, the road network as textured planes, cream sidewalks, blocks of
// merged-geometry buildings (pastel low-rise pastel facades near the beach, glass towers
// downtown), instanced palms on the boulevard median and beach line, street lamps, the sand
// strip, the sun-sparkling ocean, a marina full of masts and the container docks. All static
// geometry is merged per material, so the whole city is a few dozen draw calls, and the
// colliders (axis-aligned boxes) come back in a list for the vehicles and the player.

import * as THREE from 'three';
import { WORLD, DAYLIGHT, PALETTE } from './config.js';
import { avenueX, crossZ } from './roads.js';
import { getTextures } from './textures.js';

/** Merge transformed non-indexed geometries into one BufferGeometry, keeping whichever
 * attributes every part shares (position, normal, uv, plus vertex color when present). */
export function mergeGeometries(parts) {
  const base = ['position', 'normal', 'uv'];
  const attributes = base.concat(parts[0].attributes.color ? ['color'] : []);
  const totals = Object.fromEntries(attributes.map((n) => [n, 0]));
  for (const part of parts) {
    for (const name of attributes) totals[name] += part.attributes[name].count;
  }
  const out = new THREE.BufferGeometry();
  for (const name of attributes) {
    const item = parts[0].attributes[name].itemSize;
    const array = new Float32Array(totals[name] * item);
    let at = 0;
    for (const part of parts) {
      array.set(part.attributes[name].array, at);
      at += part.attributes[name].array.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(array, item));
  }
  out.boundingBox = null;
  out.computeBoundingSphere();
  return out;
}

/** A transformed box ready for merging, at (x, y, z) sized (w, h, d). */
function boxPart(x, y, z, w, h, d, boxCache) {
  const key = `${w}|${h}|${d}`;
  let base = boxCache.get(key);
  if (!base) {
    base = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    boxCache.set(key, base);
  }
  const cloned = base.clone();
  cloned.translate(x, y + h / 2, z);
  return cloned;
}

export function createCity(random) {
  const tex = getTextures();
  const group = new THREE.Group();
  const boxCache = new Map();
  const colliders = [];
  const sidewalks = [], facades = [[], [], []], roofs = [], glass = [], white = [];

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000),
    new THREE.MeshLambertMaterial({ color: 0xb9c29a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  group.add(ground);

  // --- Roads -------------------------------------------------------------
  const buildRoad = (x, z, w, d) => {
    const mat = new THREE.MeshLambertMaterial({
      map: (w > d ? tex.lane : tex.asphalt).clone(),
    });
    mat.map.repeat.set(1, 1);
    if (w > d) {
      mat.map.rotation = Math.PI / 2;
      mat.map.repeat.set(d / 8, w / 8);
      mat.map.center.set(0.5, 0.5);
    } else {
      mat.map.repeat.set(w / 8, d / 8);
    }
    const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.02, z);
    road.receiveShadow = true;
    group.add(road);
  };
  for (let col = 0; col < WORLD.cols; col += 1) {
    const x = avenueX(col);
    buildRoad(x, 0, WORLD.roadHalf * 2, WORLD.gridMaxZ - WORLD.gridMinZ + 60);
  }
  for (let row = 0; row < WORLD.rows; row += 1) {
    const z = crossZ(row);
    // Cross streets stop at the sand: the boulevard to the west edge only.
    buildRoad(avenueX(0) / 2 + avenueX(WORLD.cols - 1) / 2, z,
      avenueX(0) - avenueX(WORLD.cols - 1) + WORLD.roadHalf * 2, WORLD.roadHalf * 2);
  }
  const boulevardMat = new THREE.MeshLambertMaterial({ map: tex.lane.clone() });
  boulevardMat.map.repeat.set(1, (WORLD.gridMaxZ - WORLD.gridMinZ + 60) / 8);
  const boulevard = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.roadHalf * 2 + 6, WORLD.gridMaxZ - WORLD.gridMinZ + 60),
    boulevardMat,
  );
  boulevard.rotation.x = -Math.PI / 2;
  boulevard.position.set(avenueX(0) - 3, 0.03, 0);
  boulevard.receiveShadow = true;
  group.add(boulevard);

  // --- Sidewalks and blocks ----------------------------------------------
  const setUpFlat = (list, x, z, w, d, y) => {
    const g = new THREE.BoxGeometry(w, y, d).toNonIndexed();
    g.translate(x, 0, z);
    list.push(g);
  };
  for (let row = 0; row < WORLD.rows - 1; row += 1) {
    for (let col = 0; col < WORLD.cols - 1; col += 1) {
      const x0 = avenueX(col) - WORLD.roadHalf, x1 = avenueX(col + 1) + WORLD.roadHalf;
      const z0 = crossZ(row) + WORLD.roadHalf, z1 = crossZ(row + 1) - WORLD.roadHalf;
      const xa = col === 0 ? WORLD.beachStartX - WORLD.sidewalk : x0; // wide walk by the beach
      setUpFlat(sidewalks, (xa + x1) / 2, (z0 + z1) / 2, x1 - xa + 0.6, z1 - z0 + 0.8, 0.14);
      buildBlockBuildings(random, col, row, x0, x1, z0, z1, facades, roofs, glass, white, colliders, boxCache);
    }
  }
  return { group, colliders };

  /** Fill one 46x46 m block wall-to-wall: an arcade of pastel low-rises, a midtown block of
   *  brick, or a glass tower plus podium downtown, with a courtyard cut in some of them. */
  function buildBlockBuildings(random, col, row, x0, x1, z0, z1, facades, roofs, glass, white, colliders, boxCache) {
    const downtown = col >= 5 && col <= 8 && row >= 7 && row <= 13;
    const midtown = col >= 3 && row >= 5 && row <= 15;
    const floorH = 3.4;
    /** One building box at (cx, cz) with its collider and, for towers, crown slabs. */
    const place = (cx, cz, w, d, floors, kind) => {
      const h = floors * floorH;
      if (kind === 'glass') {
        glass.push(boxPart(cx, 0, cz, w, h, d, boxCache));
        white.push(boxPart(cx, h, cz, w + 1.4, 1.2, d + 1.4, boxCache));
        for (let s = 1; s <= floors - 2; s += random.int(3, 6)) {
          white.push(boxPart(cx, s * floorH, cz, w + 0.8, 0.35, d + 0.8, boxCache));
        }
      } else {
        const slot = random.int(0, 2);
        facades[slot].push(boxPart(cx, 0, cz, w, h, d, boxCache));
        roofs.push(boxPart(cx, h, cz, w + 0.9, 0.7, d + 0.9, boxCache));
      }
      colliders.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
    };
    if (downtown) {
      // One full-block glass tower plus a low podium along the avenue edge.
      const w = random.range(32, 42), d = random.range(32, 42);
      place((x0 + x1) / 2, (z0 + z1) / 2, w, d, random.int(14, 30), 'glass');
      if (random.chance(2)) {
        const pw = random.range(16, 22);
        place(x0 + pw / 2 + 1, z0 + 12, pw, random.range(14, 20), random.int(2, 4), 'facade');
      }
      return;
    }
    // Everywhere else: a tight four-corners fill, sometimes with a courtyard slot.
    const halfX = (x1 - x0) / 2;
    const halfZ = (z1 - z0) / 2;
    const courtyard = !midtown && random.chance(3);
    let floors = random.int(2, 5);
    if (midtown) floors = random.int(4, 9);
    if (courtyard) {
      // Three corner buildings around an open courtyard edge-on to the street.
      const w = halfX, d = halfZ;
      place(x0 + halfX / 2, z0 + halfZ / 2, w, d, floors + random.int(0, 1), 'facade');
      place(x1 - halfX / 2, z0 + halfZ / 2, w, d, floors + random.int(0, 2), 'facade');
      place(random.chance(2) ? x0 + halfX / 2 : x1 - halfX / 2, z1 - halfZ / 2, w, d, floors + random.int(0, 3), 'facade');
      return;
    }
    const pad = 1.5;
    place(x0 + halfX / 2, z0 + halfZ / 2, halfX + pad, halfZ + pad, floors + random.int(0, 1), 'facade');
    place(x1 - halfX / 2, z0 + halfZ / 2, halfX + pad, halfZ + pad, floors + random.int(0, 2), 'facade');
    place(x0 + halfX / 2, z1 - halfZ / 2, halfX + pad, halfZ + pad, floors + random.int(0, 2), 'facade');
    place(x1 - halfX / 2, z1 - halfZ / 2, halfX + pad, halfZ + pad, floors + random.int(0, 3), 'facade');
  }

  // --- Merged meshes and the shore -----------------------------------------
  addMerged(sidewalks, new THREE.MeshLambertMaterial({ map: tex.sidewalk }));
  const facadeMats = [tex.facade0, tex.facade1, tex.facade2].map(
    (map) => new THREE.MeshLambertMaterial({ map }),
  );
  facades.forEach((parts, i) => addMerged(parts, facadeMats[i % 3], true));
  addMerged(roofs, new THREE.MeshLambertMaterial({ color: PALETTE.roofs }));
  addMerged(glass, new THREE.MeshLambertMaterial({ color: PALETTE.towers[0] }), true);
  addMerged(white, new THREE.MeshLambertMaterial({ color: 0xf6f4ee }));

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(235, 1500),
    new THREE.MeshLambertMaterial({ map: tex.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(122.5, 0.05, 0);
  sand.receiveShadow = true;
  group.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(1800, 1500),
    new THREE.MeshLambertMaterial({ map: tex.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(WORLD.waterX - 10 + 900, -0.12, 0);
  group.add(sea);

  createShoreExtras(boxCache);
  return { group, colliders };

  /** Push one merged geometry as a shadow-receiving mesh. */
  function addMerged(parts, material, cast) {
    if (parts.length === 0) return;
    const mesh = new THREE.Mesh(mergeGeometries(parts), material);
    mesh.castShadow = !!cast;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  /** Palms, lamps, marina masts and container stacks, one instanced or merged job each. */
  function createShoreExtras(cache) {
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 7, 6);
    const frondGeo = new THREE.PlaneGeometry(7, 3.4);
    const positions = [];
    // Palms down the boulevard median and along the sand line.
    for (let z = WORLD.gridMinZ + 6; z < WORLD.gridMaxZ; z += 15) {
      positions.push({ x: avenueX(0) - 10.5, z, s: 0.9 + random.next() * 0.4, lean: random.range(-0.1, 0.1) });
      positions.push({ x: WORLD.beachStartX + random.range(2, 14), z: z + random.range(-5, 5), s: 1 + random.next() * 0.5, lean: random.range(-0.14, 0.14) });
    }
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: DAYLIGHT.palmTrunk }), positions.length);
    const fronds = new THREE.InstancedMesh(frondGeo, new THREE.MeshLambertMaterial({ map: tex.frond, side: THREE.DoubleSide }), positions.length);
    trunks.castShadow = fronds.castShadow = true;
    const dummy = new THREE.Object3D();
    positions.forEach((p, i) => {
      dummy.position.set(p.x, 3.5 * p.s, p.z);
      dummy.rotation.set(p.lean, 0, p.lean);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 7 * p.s + 0.8;
      dummy.rotation.set(-Math.PI / 2 + 0.18, random.range(0, Math.PI * 2), 0);
      dummy.updateMatrix();
      fronds.setMatrixAt(i, dummy.matrix);
    });
    group.add(trunks, fronds);

    // Street lamps along the boulevard (unlit in daylight, still street furniture).
    const lampParts = [];
    for (let z = WORLD.gridMinZ + 26; z < WORLD.gridMaxZ; z += 52) {
      lampParts.push(boxPart(avenueX(0) - 9.4, 0.14, z, 0.5, 6.5, 0.5, cache));
      lampParts.push(boxPart(avenueX(0) - 9.4, 6.4, z, 2.2, 0.35, 0.5, cache));
    }
    addMerged2(lampParts, new THREE.MeshLambertMaterial({ color: 0x7d8896 }), true);

    // Marina piers with masts, and the container docks south along the shore road.
    const pierParts = [], mastParts = [];
    for (let i = 0; i < 6; i += 1) {
      const px = 60 + i * 9, pz = -340 + (i % 3) * 8;
      pierParts.push(boxPart(px, 0.1, pz, 8, 0.5, 6, cache));
      for (let b = 0; b < 3; b += 1) {
        mastParts.push(boxPart(px + b * 2.5 - 2.5, 0.5, pz + 1.4, 0.35, random.range(9, 15), 0.35, cache));
      }
    }
    addMerged2(pierParts, new THREE.MeshLambertMaterial({ map: tex.sidewalk }), true);
    addMerged2(mastParts, new THREE.MeshLambertMaterial({ color: 0xe8e4dc }), true);

    const containerParts = [];
    const containerColors = [0xd94f3d, 0x3e8ed0, 0x49b675, 0xf2b134, 0xe8e4da];
    for (let i = 0; i < 34; i += 1) {
      const cx = random.range(60, 190), cz = random.range(250, 380);
      const stackUp = random.int(1, 3);
      for (let s = 0; s < stackUp; s += 1) {
        containerParts.push(boxPart(cx, s * 2.6, cz, 6, 2.6, 2.5, cache));
      }
      colliders.push({ x0: cx - 3.2, x1: cx + 3.2, z0: cz - 1.4, z1: cz + 1.4, color: containerColors[i % 5] });
    }
    addMerged2(containerParts, new THREE.MeshLambertMaterial({ color: 0xd94f3d }), true);

    // A simple front for the merge helper used above.
    function addMerged2(parts, mat, cast) {
      if (parts.length === 0) return;
      const mesh = new THREE.Mesh(mergeGeometries(parts), mat);
      mesh.castShadow = !!cast;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
}
