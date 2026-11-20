// The sky: a gradient-blue dome, a bright sun disc with halo, a drift of white cumulus
// billboards and a light haze band at the horizon. Built once, fixed at 15:24 local time.

import * as THREE from 'three';
import { DAYLIGHT } from './config.js';

function makeSkyDome() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#5aa9e6');
  grad.addColorStop(0.5, '#8ecdf0');
  grad.addColorStop(0.78, '#c4e5f5');
  grad.addColorStop(1, '#f4e9cf');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const skyGeo = new THREE.SphereGeometry(1300, 24, 14);
  const skyMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false });
  const dome = new THREE.Mesh(skyGeo, skyMat);
  dome.renderOrder = -10;
  return dome;
}

function makeSun() {
  const group = new THREE.Group();
  const sunDirection = new THREE.Vector3(...DAYLIGHT.sunFrom).normalize();
  // The bright disc and three halo rings of the late sun.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff6e0, fog: false }),
  );
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(72, 26),
    new THREE.MeshBasicMaterial({ color: 0xffe9b8, transparent: true, opacity: 0.5, fog: false }),
  );
  const halo2 = new THREE.Mesh(
    new THREE.CircleGeometry(150, 26),
    new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.2, fog: false }),
  );
  disc.position.copy(sunDirection).multiplyScalar(1210);
  halo.position.copy(sunDirection).multiplyScalar(1205);
  halo2.position.copy(sunDirection).multiplyScalar(1200);
  halo.lookAt(0, 0, 0);
  halo2.lookAt(0, 0, 0);
  disc.lookAt(0, 0, 0);
  group.add(disc, halo, halo2);
  return group;
}

function makePuffTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 14; i += 1) {
    const x = 40 + Math.random() * 176;
    const y = 70 + Math.random() * 30;
    const r = 18 + Math.random() * 26;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A scatter of cumulus billboards around the sky, lower and denser toward the horizon. */
function makeClouds(random) {
  const tex = makePuffTexture();
  const group = new THREE.Group();
  for (let i = 0; i < 36; i += 1) {
    const angle = random.range(0, Math.PI * 2);
    const lowBand = i % 3 === 0;
    const height = lowBand ? random.range(60, 180) : random.range(120, 460);
    const radius = lowBand ? random.range(420, 800) : random.range(500, 1000);
    const puff = new THREE.Mesh(
      new THREE.PlaneGeometry(random.range(220, 460), random.range(90, 190)),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: random.range(0.6, 0.95), depthWrite: false, fog: false }),
    );
    puff.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
    puff.lookAt(0, height, 0);
    group.add(puff);
  }
  group.renderOrder = -9;
  return group;
}

/**
 * Build and return the sky as a function of the camera: call update(camera) once a frame and
 * the dome, sun and clouds all follow the camera so their infinite distance never shows.
 */
export function createSky(random) {
  const group = new THREE.Group();
  const dome = makeSkyDome();
  const sun = makeSun();
  const clouds = makeClouds(random);
  group.add(dome, sun, clouds);
  return {
    group,
    update(camera) {
      const p = camera.position;
      group.position.set(p.x, 0, p.z);
      clouds.rotation.y += 0.00003;
    },
  };
}
