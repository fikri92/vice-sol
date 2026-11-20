// The renderer and the daylight rig: one WebGL canvas, sRGB output, ACES tone mapping and
// warm late-afternoon lighting locked to 15:24. The scene, fog, sun and hemisphere lights are
// created here once and never change with the clock.

import * as THREE from 'three';
import { DAYLIGHT } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = DAYLIGHT.exposure;
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(DAYLIGHT.sky);
  scene.fog = new THREE.Fog(DAYLIGHT.fog, DAYLIGHT.fogNear, DAYLIGHT.fogFar);
  scene.backgroundBlurriness = 0.4;

  // Warm sun well up in the south-east, tight shadow camera over the action.
  const sun = new THREE.DirectionalLight(DAYLIGHT.sunColor, DAYLIGHT.sunPower);
  sun.position.set(...DAYLIGHT.sunFrom);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const shadowSpan = 240;
  sun.shadow.camera.left = -shadowSpan;
  sun.shadow.camera.right = shadowSpan;
  sun.shadow.camera.top = shadowSpan;
  sun.shadow.camera.bottom = -shadowSpan;
  sun.shadow.camera.near = 40;
  sun.shadow.camera.far = 1000;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(DAYLIGHT.hemiSky, DAYLIGHT.hemiGround, DAYLIGHT.hemiPower);
  scene.add(hemi);

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);
  return { renderer, scene, sun, hemi, resize };
}

/** A MeshLambertMaterial shortcut; most of the city is Lambert (cheap and sunlit). */
export function lambert(color, options = {}) {
  return new THREE.MeshLambertMaterial({ color, ...options });
}

/** Re-centre the sun's shadow frustum on (x, z) so distant streets still get shadows. */
export function focusShadows(renderer, x, z) {
  const sun = renderer.sun;
  sun.position.set(x + DAYLIGHT.sunFrom[0] * 0.35, DAYLIGHT.sunFrom[1], z + DAYLIGHT.sunFrom[2] * 0.35);
  sun.target.position.set(x, 0, z);
  sun.target.updateMatrixWorld();
}
