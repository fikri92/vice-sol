// Keyboard and pointer input. Held keys are polled each step; one-shot presses (enter car,
// switch weapon, pause) are queued as flags and consumed once so a press between frames is
// never lost. Mouse steering feeds the aim direction, mouse buttons fire.

export const ACTION_ENTER = 1;
export const ACTION_WEAPON = 2;
export const ACTION_PAUSE = 4;
export const ACTION_HORN = 8;

export function createInput() {
  const held = new Set();
  const queue = [];
  const mouse = { x: 0, y: 0, down: false, aimX: 1, aimY: 0 };
  return { held, queue, mouse };
}

/** Wire the input to the page: keyup/keydown, pointer aim and click-to-fire. */
export function attachInput(input, game, shotMode) {
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const code = event.code;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space'].includes(code)) {
      input.held.add(code);
      event.preventDefault();
    }
    if (!event.repeat) {
      if (code === 'KeyF' || code === 'KeyE') input.queue.push(ACTION_ENTER);
      if (code === 'KeyQ') input.queue.push(ACTION_WEAPON);
      if (code === 'KeyP' || code === 'Escape') input.queue.push(ACTION_PAUSE);
      if (code === 'KeyH') input.queue.push(ACTION_HORN);
    }
  });
  window.addEventListener('keyup', (event) => input.held.delete(event.code));
  window.addEventListener('blur', () => input.held.clear());

  const canvas = document.getElementById('game');
  const updateAim = (event) => {
    const ray = game.camera.groundPoint(event.clientX, event.clientY);
    const pos = game.player.player.pos;
    if (ray) {
      input.mouse.aimX = ray.x - pos.x;
      input.mouse.aimY = ray.z - pos.z;
    }
  };
  window.addEventListener('pointermove', updateAim);
  canvas.addEventListener('pointerdown', (event) => {
    input.mouse.down = true;
    if (shotMode) return;
    updateAim(event);
  });
  window.addEventListener('pointerup', () => { input.mouse.down = false; });
}

/** Signed axis: 1 when any positive key is held, -1 for negative, 0 for neither or both. */
export function axis(input, positive, negative) {
  return (input.held.has(positive) ? 1 : 0) - (input.held.has(negative) ? 1 : 0);
}

/** Signed axis from either the WASD or arrow pair for one direction. */
export function keyAxis(input, wasd, arrow, wasdNeg, arrowNeg) {
  const p = input.held.has(wasd) || input.held.has(arrow);
  const n = input.held.has(wasdNeg) || input.held.has(arrowNeg);
  return (p ? 1 : 0) - (n ? 1 : 0);
}

/** Consume and return the queued one-shot actions since the last call. */
export function takeActions(input) {
  let flags = 0;
  while (input.queue.length > 0) flags |= input.queue.shift();
  return flags;
}
