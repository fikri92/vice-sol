// WebAudio without any asset files: a two-cylinder engine hum whose pitch follows the speed,
// tyre squeal, a police siren wail, gunshots, explosions and a light sea-and-gulls ambience.
// Everything is synthesised; the AudioContext starts on the first user gesture.

export function createAudio() {
  let ctx = null;
  let engine = null, engineGain = null, sirenOsc = null, sirenGain = null;
  let sea = null;
  let started = false;

  /** Start (or resume) the context; safe to call from any first gesture handler. */
  function start() {
    if (started) {
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return;
    }
    started = true;
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();

    // Engine: a low sawtooth plus a sub-oscillator through a low-pass, gain driven by speed.
    engine = ctx.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.value = 55;
    const sub = ctx.createOscillator();
    sub.type = 'triangle';
    sub.frequency.value = 27;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engine.connect(filter); sub.connect(filter);
    filter.connect(engineGain); engineGain.connect(ctx.destination);
    engine.start(); sub.start();

    // Siren: two-tone wail, muted until a pursuit.
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 620;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(ctx.destination);
    sirenOsc.start();

    // Ambience: filtered noise for the surf, very quiet.
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) data[i] = (Math.random() * 2 - 1) * 0.4;
    sea = ctx.createBufferSource();
    sea.buffer = buffer;
    sea.loop = true;
    const seaFilter = ctx.createBiquadFilter();
    seaFilter.type = 'lowpass';
    seaFilter.frequency.value = 500;
    const seaGain = ctx.createGain();
    seaGain.gain.value = 0.035;
    sea.connect(seaFilter); seaFilter.connect(seaGain); seaGain.connect(ctx.destination);
    sea.start();
  }

  /** Update the continuous layers from the game state each step. */
  function update(state) {
    if (!ctx) return;
    const inCar = state.vehicle !== null && state.vehicle !== undefined;
    engine.frequency.value = 48 + (inCar ? Math.abs(state.vehicle.speed) * 6 : 0);
    engineGain.gain.value = inCar ? 0.05 : 0;
    const pursuit = state.wanted > 0;
    if (pursuit) {
      const t = ctx.currentTime;
      sirenOsc.frequency.setValueAtTime(560, t);
      sirenOsc.frequency.linearRampToValueAtTime(880, t + 0.45);
      sirenOsc.frequency.linearRampToValueAtTime(560, t + 0.9);
      sirenGain.gain.value = Math.max(0, 0.05 - state.policeDistance * 0.0004);
    } else {
      sirenGain.gain.value = 0;
    }
  }

  /** A one-shot noise burst through a shaped envelope. */
  function burst(dur, gainValue, freq, type) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type ?? 'square';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainValue, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  const gunshot = () => burst(0.12, 0.25, 160, 'square');
  const explosion = () => { burst(0.7, 0.5, 46, 'sawtooth'); burst(0.3, 0.3, 90, 'square'); };
  const squeal = () => burst(0.25, 0.12, 700, 'sawtooth');
  const pickup = () => burst(0.18, 0.2, 660, 'sine');

  return { start, update, gunshot, explosion, squeal, pickup };
}
