// The start screen wiring, the pause menu and the settings cards. The start overlay lives in
// index.html; this file drives it and builds the pause card on demand: resume, controls list,
// sound on/off and restart-the-mission hints. State stays in one small object.

import { clearSave } from './save.js';

export function createMenu(hud, audio) {
  const settings = { sound: true };
  let paused = false;
  let pauseCard = null;

  /** Build the pause card once, hidden, and attach it to the HUD layer. */
  function ensurePauseCard() {
    if (pauseCard) return;
    pauseCard = document.createElement('div');
    pauseCard.style.cssText = [
      'position:fixed', 'inset:0', 'background:rgba(10,18,32,0.55)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font:600 17px/1.6 "Trebuchet MS",Verdana,sans-serif', 'color:#fff', 'z-index:40',
    ].join(';');
    const card = document.createElement('div');
    card.style.cssText = 'background:rgba(16,28,44,0.9);border-radius:16px;padding:26px 34px;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.4)';
    card.innerHTML = [
      '<div style="font-size:26px;letter-spacing:4px;color:#ff7b54">PAUSED</div>',
      '<p style="margin:14px 0">WASD move / drive · F enter or exit car · Space fire / jump</p>',
      '<p style="margin:6px 0">Mouse aim · Q switch weapon · Shift sprint · P pause</p>',
      '<p style="margin:6px 0">Missions start at the gold markers on the minimap.</p>',
      '<button id="resumeBtn" style="font:700 18px Trebuchet MS;border:0;border-radius:10px;padding:10px 26px;background:#ff7b54;color:#fff;cursor:pointer">RESUME</button> ',
      '<button id="soundBtn" style="font:700 18px Trebuchet MS;border:0;border-radius:10px;padding:10px 22px;background:#3e8ed0;color:#fff;cursor:pointer">SOUND: ON</button> ',
      '<button id="newBtn" style="font:700 18px Trebuchet MS;border:0;border-radius:10px;padding:10px 22px;background:#49b675;color:#fff;cursor:pointer">NEW GAME</button>',
    ].join('');
    pauseCard.appendChild(card);
    pauseCard.hidden = true;
    document.body.appendChild(pauseCard);
    card.querySelector('#resumeBtn').addEventListener('click', () => setPaused(false));
    card.querySelector('#soundBtn').addEventListener('click', () => {
      settings.sound = !settings.sound;
      card.querySelector('#soundBtn').textContent = `SOUND: ${settings.sound ? 'ON' : 'OFF'}`;
    });
    card.querySelector('#newBtn').addEventListener('click', () => {
      clearSave();
      window.location.reload();
    });
  }

  function setPaused(value) {
    paused = value;
    if (value) ensurePauseCard();
    if (pauseCard) pauseCard.hidden = !value;
  }

  function isPaused() {
    return paused;
  }

  /** Begin audio on the first pointer or key, the browser's autoplay rule honoured. */
  function wireFirstGesture() {
    const go = () => {
      audio.start();
      window.removeEventListener('pointerdown', go);
      window.removeEventListener('keydown', go);
    };
    window.addEventListener('pointerdown', go);
    window.addEventListener('keydown', go);
  }

  return { setPaused, isPaused, wireFirstGesture, settings };
}
