// The camera rig: a springy third-person orbit on foot, a chase camera glued behind a moving
// car, an over-shoulder aim zoom, and the fixed cinematic presets the screenshot scenes use.

import * as THREE from 'three';
import { SPEEDS } from './config.js';

export function createCameraRig(aspect) {
  const camera = new THREE.PerspectiveCamera(58, aspect, 0.5, 2400);
  const smoothPos = new THREE.Vector3(0, 5, 12);
  const smoothLook = new THREE.Vector3();
  let mode = 'orbit';      // orbit | chase | cinematic
  let yaw = Math.PI;
  let pitch = 0.22;
  let shake = 0;
  const tmp = new THREE.Vector3();
  const lookTmp = new THREE.Vector3();

  camera.position.copy(smoothPos);

  function applySpring(target, look, dt, stiffness) {
    const k = 1 - Math.exp(-stiffness * dt);
    smoothPos.lerp(target, k);
    smoothLook.lerp(look, k);
    camera.position.copy(smoothPos);
    if (shake > 0) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
    }
    camera.lookAt(smoothLook);
  }

  /** Third-person orbit above and behind a walker at (x, z) facing `heading`. */
  function followOnFoot(player, aiming, dt) {
    const dist = aiming ? 2.6 : 6.2;
    const height = aiming ? 1.9 : 2.9;
    // When aiming, swing behind the crosshair direction instead of the body heading.
    const dir = aiming && player.aimHeading !== null ? player.aimHeading : headingOf(player, yaw);
    const target = tmp.set(
      player.pos.x - Math.sin(dir) * dist,
      height,
      player.pos.z - Math.cos(dir) * dist,
    );
    const look = lookTmp.set(player.pos.x, 1.6, player.pos.z);
    applySpring(target, look, dt, 12);
  }

  function headingOf(player, fallback) {
    return player.heading !== undefined ? player.heading : fallback;
  }

  /** Chase view behind a car: lifted, behind and looking ahead down the road. */
  function followCar(car, speed, dt) {
    const back = 7.4 + Math.min(speed / SPEEDS.carMax, 1) * 2.4;
    const target = tmp.set(
      car.x - Math.sin(car.heading) * back,
      3.1,
      car.z - Math.cos(car.heading) * back,
    );
    const look = lookTmp.set(
      car.x + Math.sin(car.heading) * 6,
      1.5,
      car.z + Math.cos(car.heading) * 6,
    );
    applySpring(target, look, dt, 8);
  }

  /** A fixed cinematic framing for the screenshot scenes. */
  function setCinematic(x, y, z, lookX, lookY, lookZ, fov) {
    mode = 'cinematic';
    camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.position.set(x, y, z);
    camera.lookAt(lookX, lookY, lookZ);
    smoothPos.copy(camera.position);
    smoothLook.set(lookX, lookY, lookZ);
  }

  function kick(amount) {
    shake = Math.min(shake + amount, 0.8);
  }

  /** Decay the screen shake each step so a crash settles out again. */
  function step(dt) {
    shake = Math.max(0, shake - dt * 1.6);
  }

  /** The ground point under the crosshair, for the aim direction. */
  function groundPoint(clientX, clientY) {
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1,
    );
    ray.setFromCamera(ndc, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(plane, hit) ? hit : null;
  }

  function fit(aspect) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  return {
    camera, followOnFoot, followCar, setCinematic, kick, step, groundPoint, fit,
    get yaw() { return yaw; },
    set yaw(value) { yaw = value; },
    get pitch() { return pitch; },
    set pitch(value) { pitch = value; },
    get mode() { return mode; },
    addYaw(delta) { yaw += delta; },
  };
}
