// Visual effects: tyre smoke, chimney and wreck smoke, a fireball explosion with an expanding
// ring, sparks and the camera shake that ties it together. Every particle is a pooled sprite,
// so an explosion allocates nothing after boot.

import * as THREE from 'three';
import { getTextures } from './textures.js';

export function createEffects(scene, cameraRig) {
  const tex = getTextures();
  const sprites = [];

  function borrow(map, scale, fade) {
    let s = sprites.find((p) => p.life <= 0);
    if (!s) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }));
      scene.add(spr);
      s = { sprite: spr, life: 0, fade, grow: 0, vy: 0 };
      sprites.push(s);
    }
    s.sprite.material.map = map;
    s.fade = fade;
    s.grow = 0;
    s.sprite.scale.setScalar(scale);
    s.sprite.material.opacity = 0.9;
    s.sprite.visible = true;
    return s;
  }

  /** A soft puff of smoke from (x, y, z), drifting upward. */
  function smoke(x, y, z, scale = 2.2, rise = 1.6) {
    const s = borrow(tex.glow, scale, 0.5);
    s.sprite.position.set(x, y, z);
    s.life = 1.4;
    s.vy = rise;
    s.sprite.material.color.set(0x9a9a9a);
    s.grow = 1.6;
  }

  /** Tyre-smoke behind a hard launch. */
  function tyreSmoke(x, z) {
    const s = borrow(tex.glow, 1.6, 0.9);
    s.sprite.position.set(x, 0.3, z);
    s.life = 0.5;
    s.vy = 0.6;
    s.sprite.material.color.set(0xdddddd);
    s.grow = 2.2;
  }

  /** Sparks kicked off a wall or a car. */
  function sparks(x, y, z, color = 0xffcf7a) {
    const s = borrow(tex.glow, 0.55, 3);
    s.sprite.position.set(x, y, z);
    s.life = 0.22;
    s.vy = 1;
    s.sprite.material.color.set(color);
  }

  /** The full explosion: fireball, ring of smoke, sparks and a camera kick. */
  function explosion(x, y, z, power = 1) {
    const fire = borrow(tex.glowRed, 4 * power, 1.6);
    fire.sprite.position.set(x, y, z);
    fire.life = 0.55;
    fire.vy = 2;
    fire.grow = 8 * power;
    fire.sprite.material.color.set(0xff8c3a);
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      smoke(x + Math.cos(a) * 1.6, y + 0.4, z + Math.sin(a) * 1.6, 2.6 * power, 2.2);
    }
    for (let i = 0; i < 8; i += 1) sparks(x + random(-1, 1), y + random(0, 1.5), z + random(-1, 1), 0xffd28a);
    cameraRig.kick(0.5 * power);
  }

  function random(lo, hi) {
    return lo + Math.random() * (hi - lo);
  }

  /** Age every live sprite one step. */
  function step(dt) {
    for (let i = 0; i < sprites.length; i += 1) {
      const s = sprites[i];
      if (s.life <= 0) continue;
      s.life -= dt;
      s.sprite.position.y += s.vy * dt;
      s.sprite.material.opacity = Math.max(0, s.life * s.fade * 0.7);
      if (s.grow > 0) s.sprite.scale.addScalar(s.grow * dt);
      if (s.life <= 0) s.sprite.visible = false;
    }
  }

  return { smoke, tyreSmoke, sparks, explosion, step };
}
