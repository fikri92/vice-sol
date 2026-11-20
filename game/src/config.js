// Tuning constants for the whole city: sizes, speeds, the daylight palette, wanted-star
// thresholds, the eight story jobs and a little of the HUD layout. Numbers live here and
// nowhere else, so balance is one file.

export const WORLD = {
  block: 60,          // distance between road centrelines
  roadHalf: 7,        // road half-width (14 m of lanes total)
  sidewalk: 5,        // sidewalk width
  cols: 11,          // north-south avenues, boulevard at index 0
  rows: 21,          // east-west cross streets
  boulevardX: 0,     // the beach boulevard runs along z at x = 0
  beachStartX: 30,   // where the sand begins, east of the boulevard
  waterX: 150,       // where the ocean begins
  gridMinZ: -600, gridMaxZ: 600,
};

export const SPEEDS = {
  walk: 4.2, run: 7.8, pedWalk: 1.4,
  carMax: 27, carAccel: 15, carBrake: 30, carTurn: 2.1, grip: 4,
  policeMax: 30, trafficCruise: 9, gravity: 22,
};

export const DAYLIGHT = {
  sky: 0x8ecdf0, fog: 0xbfdcef, fogNear: 260, fogFar: 900,
  hemiSky: 0xcfe8ff, hemiGround: 0xbfa27a, hemiPower: 0.9,
  sunColor: 0xfff2d8, sunPower: 2.2, sunFrom: [360, 150, 260],
  exposure: 1.15, startHour: 15.4,
  asphalt: 0x9a9aa2, lane: 0xffffff, sidewalk: 0xe8dfc8,
  sand: 0xf0dfb0, sea: 0x2ec4c9, seaFoam: 0xbdeff2,
  palmTrunk: 0x8a6f4d, palmFrond: 0x2e7d4f,
};

export const PALETTE = {
  facades: [0xf6d8b8, 0xfbe3d4, 0xbde3d6, 0xc7e0f5, 0xf3c6c1, 0xfaf0d7],
  awnings: [0xe2725b, 0x3e8ed0, 0x49b675, 0xf2b134, 0xba68c8],
  roofs: 0xd9cfc0, towers: [0xa7c8e8, 0x9fb6d6, 0xcfe0ef],
  cars: [0xd94f3d, 0xf2b134, 0x3e8ed0, 0x49b675, 0xe8e4da, 0x8d5bd6, 0x2b3140, 0x101318],
  taxi: 0xf7c531, policeBody: 0xf5f7fa, policeStripe: 0x1d3f8f,
  pedShirt: [0xe2725b, 0x4a90d9, 0xf2c94c, 0x67b26f, 0xba68c8, 0xf5f0e6, 0x2a3d66],
  pedPants: [0x33415c, 0x5b4a3a, 0x767680, 0x2b3038],
};

export const WANTED = {
  levels: [0, 30, 90, 180, 320, 520],   // heat thresholds per star
  decayPerSec: 2.4,
  copsByStar: [0, 2, 4, 7, 10, 12],
  cruisersByStar: [0, 1, 2, 3, 4, 5],
  bustDistance: 2.8,
};

export const COMBAT = {
  pistolDamage: 26, pistolRate: 0.34,
  smgDamage: 13, smgRate: 0.09,
  range: 160, pedFleeRadius: 55,
};

export const HEALTH = { max: 100, armorMax: 100, carMax: 100, respawnHp: 80 };

// Eight story jobs. Objective kinds: 'goto' (reach a point on foot or by car), 'drive' (arrive
// while inside a vehicle), 'eliminate' (neutralise N hostile peds spawned at the point),
// 'collect' (pick up N glowing stashes inside the radius), 'escape' (wanted level back to 0).
export const MISSIONS = [
  { id: 1, giver: 'mira', title: 'Welcome to the Strip',
    brief: 'Rico, sunshine. The Broker wants a driver who does not ask questions. Meet me at the boulevard kiosk.',
    objectives: [
      { kind: 'goto', x: 8, z: 40, r: 7, text: 'Meet Mira at the boulevard kiosk' },
      { kind: 'drive', x: -70, z: -130, r: 10, text: 'Test-drive any car to the downtown garage' }],
    reward: 400 },
  { id: 2, giver: 'mira', title: 'Sunset Collections',
    brief: 'Three stashes of the Broker\'s cash sit on the container docks. Collect them before the tide does.',
    objectives: [
      { kind: 'collect', x: 90, z: 300, n: 3, r: 60, text: 'Grab the dock stashes' },
      { kind: 'goto', x: 8, z: 40, r: 8, text: 'Bring the cash back to Mira' }],
    reward: 650 },
  { id: 3, giver: 'broker', title: 'Crating Heat',
    brief: 'A rival crew squats on container row. Give them a permanent vacation, Rico.',
    objectives: [
      { kind: 'eliminate', x: 60, z: 330, n: 4, r: 45, text: 'Take out the dockside crew' },
      { kind: 'escape', text: 'Slip away from the heat' }],
    reward: 900 },
  { id: 4, giver: 'mira', title: 'Heat on the Strip',
    brief: 'Hale fenced the marina with cruisers. Run the package through and keep it moving.',
    objectives: [
      { kind: 'drive', x: 34, z: -260, r: 12, text: 'Run the marina package in a car' },
      { kind: 'escape', text: 'Lose the police pursuit' }],
    reward: 1200 },
  { id: 5, giver: 'broker', title: 'Glass Houses',
    brief: 'Downtown glass belongs to a rival of mine. Eliminate the lieutenants before happy hour.',
    objectives: [
      { kind: 'eliminate', x: -250, z: -180, n: 5, r: 50, text: 'Eliminate the downtown lieutenants' },
      { kind: 'escape', text: 'Escape Detective Hale' }],
    reward: 1600 },
  { id: 6, giver: 'mira', title: 'The Marina Handoff',
    brief: 'Pick up the Broker\'s briefcase at the marina and deliver it west. Do not open it.',
    objectives: [
      { kind: 'goto', x: 40, z: -300, r: 7, text: 'Pick up the briefcase' },
      { kind: 'drive', x: -420, z: 420, r: 14, text: 'Deliver it to the west gate' }],
    reward: 1900 },
  { id: 7, giver: 'hale', title: 'The Detective Racket',
    brief: 'Hale offers a deal: clear the strip of the Broker\'s runners and he forgets your face.',
    objectives: [
      { kind: 'eliminate', x: 20, z: 120, n: 6, r: 60, text: 'Drive off the Broker runners' },
      { kind: 'goto', x: -560, z: 0, r: 9, text: 'Report to Hale at the precinct' }],
    reward: 2400 },
  { id: 8, giver: 'broker', title: 'Vice Sol Sunset',
    brief: 'One last job: the rivals meet on the causeway. Close the account, and the city is yours.',
    objectives: [
      { kind: 'eliminate', x: -380, z: -420, n: 7, r: 50, text: 'End the rival meeting' },
      { kind: 'escape', text: 'Vanish into the sunset' }],
    reward: 4000 },
];

export const HUD = {
  minimapSize: 168, minimapRange: 330,
  cashStart: 250, subtitleMs: 4200, noteMs: 3400,
};
