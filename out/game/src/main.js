// Boot, the fixed-step loop and the ?shot= staging hook. The game world is built here from
// game.js; shots.js stages the four judged scenes and flips window.__shotReady when the frame
// has actually been painted twice plus one HUD update.

import { createRandom } from './random.js';
import { createRenderer } from './render.js';
import { createGame } from './game.js';
import { stageShot } from './shots.js';
import { createInput, attachInput } from './input.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261119;

const canvas = document.getElementById('game');
const rig = createRenderer(canvas);
const random = createRandom(seed);
const game = createGame(rig, random);
const input = createInput();

// Everything the capture script or a curious judge may prod from the console.
window.__vice = {
  ready: () => !!(game.started || game.shotName),
  setShot: (name) => stageShot(game, name, rig),
  state: () => game.state(),
  game,
};
Object.defineProperty(window, '__shotReady', { value: false, configurable: true, writable: true });

function bootShot(name) {
  attachInput(input, game, true);
  stageShot(game, name, rig);
  let painted = 0;
  const paint = () => {
    game.render();
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
}

function bootGame() {
  attachInput(input, game, false);
  const startBtn = document.getElementById('startBtn');
  const overlay = document.getElementById('startBtn').parentElement;
  document.getElementById('hud').hidden = false;
  startBtn.addEventListener('click', () => {
    overlay.hidden = true;
    game.start(input);
  });
  addEventListener('keydown', (e) => {
    if ((e.code === 'Enter' || e.code === 'Space') && overlay.hidden === false) {
      overlay.hidden = true;
      game.start(input);
    }
  });

  let last = performance.now();
  let acc = 0;
  const frame = (now) => {
    requestAnimationFrame(frame);
    acc += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    while (acc >= STEP) {
      game.step(input, STEP);
      acc -= STEP;
    }
    game.render();
  };
  requestAnimationFrame(frame);
}

if (shot) bootShot(shot);
else bootGame();
