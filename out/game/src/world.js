// The static world in one call: sky (dome, sun, clouds), the ground, every road, sidewalk,
// block, palm, lamp, pier, mast and container of Vice Sol, the beach and the sparkling sea.
// Returns the colliders the movement systems test against and the sky that follows the camera.

import { createSky } from './sky.js';
import { createCity } from './city.js';

export function buildWorld(scene, random) {
  const sky = createSky(random);
  scene.add(sky.group);
  const { group, colliders } = createCity(random);
  scene.add(group);
  return { colliders, sky, cityGroup: group };
}

/** True when a drop point is free of building colliders, used by the spawn helpers. */
export function pointIsClear(x, z, r, colliders) {
  for (let i = 0; i < colliders.length; i += 1) {
    const c = colliders[i];
    if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return false;
  }
  return true;
}
