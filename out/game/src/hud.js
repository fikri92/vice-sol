// The DOM HUD: cash, health and armour bars, wanted stars, weapon and ammo, the mission banner,
// the objective line, the speedometer, timed notifications and the dialogue subtitle. update()
// is cheap and called once per frame; timed panels get ticked from the same call.

import { HUD } from './config.js';

const byId = (id) => document.getElementById(id);

export function createHud() {
  const els = {
    hud: byId('hud'), cash: byId('cash'), wanted: byId('wanted'),
    hp: byId('hpfill'), armor: byId('arfill'), banner: byId('banner'),
    objective: byId('objective'), weapon: byId('weapon'), speedo: byId('speedo'),
    speedValue: byId('speedo').querySelector('b'), notes: byId('notes'),
    subtitle: byId('subtitle'), subtitleName: byId('subtitle').querySelector('b'),
    subtitleText: byId('subtitle').querySelector('span'),
  };
  const timers = { subtitle: 0, notes: [] };
  let bannerText = '__unset';

  /** Show a timed announcement on the right stack. */
  function notify(text) {
    const div = document.createElement('div');
    div.textContent = text;
    els.notes.appendChild(div);
    timers.notes.push({ div, life: HUD.noteMs / 1000 });
  }

  /** Named speaker line above the bottom of the screen. */
  function subtitles(name, line) {
    els.subtitleName.textContent = name ? `${name}: ` : '';
    els.subtitleText.textContent = line;
    els.subtitle.style.display = 'block';
    timers.subtitle = HUD.subtitleMs / 1000;
  }

  function showBanner(text) {
    bannerText = text;
    els.banner.hidden = !text;
    els.banner.textContent = text;
  }

  function setObjectiveText(text) {
    els.objective.hidden = !text;
    if (text) els.objective.textContent = text;
  }

  let lastStars = -1;

  /** One HUD update from the game state; call after the sim step, before the render. */
  function update(state) {
    els.cash.textContent = `$${state.money.toLocaleString('en-US')}`;
    els.hp.style.width = `${Math.max(0, state.health)}%`;
    els.armor.style.width = `${state.armor}%`;
    if (state.wanted !== lastStars) {
      lastStars = state.wanted;
      els.wanted.textContent = '★'.repeat(state.wanted) + '☆'.repeat(Math.max(0, 5 - state.wanted));
      els.wanted.style.color = state.wanted > 0 ? '#ff5c49' : '#ffd75e';
    }
    if (state.vehicle) {
      els.weapon.style.display = 'none';
      els.speedo.style.display = 'block';
      els.speedValue.textContent = Math.round(Math.abs(state.vehicle.speed * 3.6 * 1.6));
    } else {
      els.weapon.style.display = 'block';
      els.speedo.style.display = 'none';
      els.weapon.textContent = `${state.weapon}${state.ammo !== Infinity ? ` · ${state.ammo}` : ''}`;
      if (state.weapon === 'FISTS') els.weapon.textContent = 'FISTS';
    }
    if (bannerText) els.banner.hidden = false;
  }

  /** Age the timed panels; called with the frame's delta seconds. */
  function tick(dt) {
    if (timers.subtitle > 0) {
      timers.subtitle -= dt;
      if (timers.subtitle <= 0) els.subtitle.style.display = 'none';
    }
    for (let i = timers.notes.length - 1; i >= 0; i -= 1) {
      timers.notes[i].life -= dt;
      if (timers.notes[i].life <= 0) {
        timers.notes[i].div.remove();
        timers.notes.splice(i, 1);
      }
    }
  }

  function setVisible(on) {
    els.hud.hidden = !on;
  }

  return { update, tick, notify, subtitles, showBanner, setObjectiveText, setVisible };
}
