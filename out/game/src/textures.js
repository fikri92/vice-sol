// Procedural canvas textures: light asphalt with white lane paint, cream sidewalks, three
// pastel facades with windows and awnings, a palm frond, the sea sparkle, a soft glow and the
// small HUD icons. Everything is drawn once at boot into offscreen canvases.

import * as THREE from 'three';
import { DAYLIGHT, PALETTE } from './config.js';

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d') };
}

function finish(canvas, repeatX = 1, repeatY = 1) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  return texture;
}

/** Light mid-grey asphalt with pale aggregate and a dashed white centre line. */
function drawAsphalt() {
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#a2a3aa';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i += 1) {
    const shade = 150 + Math.floor(Math.random() * 60);
    ctx.fillStyle = `rgba(${shade},${shade},${shade + 6},0.5)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  ctx.strokeStyle = 'rgba(120,60,60,0.16)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * 256, Math.random() * 256);
    ctx.lineTo(Math.random() * 256, Math.random() * 256);
    ctx.stroke();
  }
  return canvas;
}

function drawLaneTex() {
  const { canvas, ctx } = makeCanvas(128, 256);
  ctx.fillStyle = '#a6a7ae';
  ctx.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 900; i += 1) {
    const shade = 152 + Math.floor(Math.random() * 55);
    ctx.fillStyle = `rgba(${shade},${shade},${shade + 5},0.45)`;
    ctx.fillRect(Math.random() * 128, Math.random() * 256, 2, 2);
  }
  // Dashed white centre line down the middle of the tile.
  ctx.fillStyle = '#ffffff';
  for (let y = 0; y < 256; y += 64) ctx.fillRect(61, y, 6, 38);
  // Pale edge lines.
  ctx.fillStyle = '#f3f3f3';
  ctx.fillRect(4, 0, 4, 256);
  ctx.fillRect(120, 0, 4, 256);
  return canvas;
}

/** Warm cream paving slabs for every sidewalk. */
function drawSidewalk() {
  const { canvas, ctx } = makeCanvas(128, 128);
  ctx.fillStyle = '#e9dfc6';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(180,165,135,0.6)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 128; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke();
  }
  for (let i = 0; i < 350; i += 1) {
    ctx.fillStyle = `rgba(240,235,220,${0.2 + Math.random() * 0.25})`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 1);
  }
  return canvas;
}

/** Water-touched sand: pale gold with a ripple of shells. */
function drawSand() {
  const { canvas, ctx } = makeCanvas(256, 256);
  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, '#f3e3b6');
  grad.addColorStop(1, '#f8ecc9');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 700; i += 1) {
    ctx.fillStyle = `rgba(214,196,150,${0.25 + Math.random() * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 8, 1.5, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

/** Open-sea tile: turquoise with sun-sparkle streaks and a gentle swell. */
function drawSea() {
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#2ec4c9';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 4) {
    const shade = 46 + Math.floor(24 * Math.sin(y * 0.09));
    ctx.fillStyle = `rgba(${shade - 8},${170 + Math.sin(y * 0.2) * 20 | 0},${shade + 150},0.28)`;
    ctx.fillRect(0, y, 256, 2);
  }
  for (let i = 0; i < 130; i += 1) {
    ctx.fillStyle = `rgba(255,255,255,${0.14 + Math.random() * 0.3})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 14, 2);
  }
  return canvas;
}

/**
 * One pastel facade: stucco base colour, a deco parapet band, neat window grid and a striped
 * awning over the ground floor. `tone` picks the wall colour, `style` the window shape.
 */
function drawFacade(tone, style) {
  const { canvas, ctx } = makeCanvas(256, 256);
  const color = '#' + tone.toString(16).padStart(6, '0');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  // Soft stucco grain.
  for (let i = 0; i < 420; i += 1) {
    ctx.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.12})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  // Art-deco parapet band at the top.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(0, 6, 256, 10);
  ctx.fillStyle = 'rgba(90,70,60,0.18)';
  ctx.fillRect(0, 20, 256, 4);
  for (let i = 0; i < 8; i += 1) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(16 + i * 30, 26, 10, 6);
  }
  // Window grid below the band.
  const rows = 5;
  const cols = 5;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = 18 + c * 46, y = 52 + r * 40;
      ctx.fillStyle = 'rgba(40,60,80,0.85)';
      if (style === 0) { ctx.fillRect(x, y, 26, 22); ctx.fillStyle = 'rgba(170,215,235,0.9)'; ctx.fillRect(x + 2, y + 2, 22, 18); }
      else if (style === 1) {
        ctx.fillRect(x, y, 26, 22);
        ctx.fillStyle = 'rgba(200,230,245,0.85)';
        ctx.beginPath(); ctx.arc(x + 13, y + 11, 9, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillRect(x - 2, y - 3, 30, 26);
        ctx.fillStyle = 'rgba(190,225,240,0.9)';
        ctx.beginPath(); ctx.moveTo(x, y + 24); ctx.lineTo(x + 7, y); ctx.lineTo(x + 21, y); ctx.lineTo(x + 28, y + 24); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,246,220,0.9)';
      ctx.fillRect(x - 3, y + 24, 34, 3);
    }
  }
  // Ground floor: dark storefront and a striped awning.
  ctx.fillStyle = 'rgba(30,40,55,0.9)';
  ctx.fillRect(0, 228, 256, 28);
  const awning = PALETTE.awnings[(tone + style) % PALETTE.awnings.length];
  ctx.fillStyle = '#' + awning.toString(16).padStart(6, '0');
  for (let i = 0; i < 16; i += 1) ctx.fillRect(i * 16, 224, 8, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 16; i += 1) ctx.fillRect(i * 16 + 8, 224, 8, 12);
  return canvas;
}

/** A deep-green palm frond with a pale midrib, drawn to alpha for the billboard texture. */
function drawFrond() {
  const { canvas, ctx } = makeCanvas(128, 64);
  ctx.clearRect(0, 0, 128, 64);
  for (let side = 0; side < 2; side += 1) {
    ctx.fillStyle = 'rgba(46,125,79,0.95)';
    ctx.beginPath();
    ctx.moveTo(64, 30);
    ctx.quadraticCurveTo(side === 0 ? 8 : 120, 4, side === 0 ? 2 : 126, 26);
    ctx.quadraticCurveTo(64, 34, 64, 30);
    ctx.fill();
    for (let i = 0; i < 7; i += 1) {
      ctx.fillStyle = 'rgba(60,150,95,0.9)';
      ctx.beginPath();
      ctx.ellipse(64, 30, 8, 2.4, (side === 0 ? -i * 0.12 : Math.PI + i * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = 'rgba(210,190,150,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(4, 30); ctx.lineTo(124, 30); ctx.stroke();
  return canvas;
}

/** A soft warm glow sprite for headlights, explosions and pickups. */
function drawGlow(hex) {
  const { canvas, ctx } = makeCanvas(64, 64);
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, hex);
  grad.addColorStop(0.45, hex.replace('1)', '0.55)'));
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return canvas;
}

const cache = {};
/** Build (once) and return every texture the city needs, keyed by name. */
export function getTextures() {
  if (cache.ready) return cache;
  cache.asphalt = finish(drawAsphalt(), 1, 1);
  cache.lane = finish(drawLaneTex(), 1, 1);
  cache.sidewalk = finish(drawSidewalk(), 1, 1);
  cache.sand = finish(drawSand(), 4, 6);
  cache.sea = finish(drawSea(), 12, 12);
  cache.facade0 = finish(drawFacade(PALETTE.facades[0], 0));
  cache.facade1 = finish(drawFacade(PALETTE.facades[1], 1));
  cache.facade2 = finish(drawFacade(PALETTE.facades[2], 2));
  cache.frond = finish(drawFrond());
  cache.glow = finish(drawGlow('rgba(255,214,140,1)'));
  cache.glowRed = finish(drawGlow('rgba(255,90,60,1)'));
  cache.glowBlue = finish(drawGlow('rgba(90,160,255,1)'));
  cache.ready = true;
  return cache;
}
