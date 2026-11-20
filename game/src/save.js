// Save and load the run in localStorage: cash, weapons, ammo, health, armour, the mission index
// and the wanted level. Best-effort everywhere: private windows keep the run for this visit.

const KEY = 'vice-sol.save.v1';

export function saveGame(state) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({
      money: state.money,
      health: state.health,
      armor: state.armor,
      weaponIndex: state.weaponIndex,
      ammo: state.ammo,
      missionIndex: state.missionIndex,
      jobsDone: state.jobsDone,
    }));
    return true;
  } catch {
    return false;
  }
}

/** Returns the saved fields, or null when nothing usable is stored. */
export function loadGame() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clean.
  }
}
