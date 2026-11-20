// The street graph: eleven north-south avenues and twenty-one cross streets on a 60 m grid,
// with the beach boulevard at x = 0. Nodes are the intersections; driving lanes run on the
// right-hand offset of each edge. The graph answers the queries the rest of the city asks:
// nearestRoadPoint for spawning, randomRoadPoint for traffic, routeBetweenNodes for the
// police's straightforward chases, and lane offsets for keeping to a side.

import { WORLD } from './config.js';

/** Every intersection node in a flat array, index = row * cols + col. */
export function buildRoadGraph() {
  const nodes = [];
  for (let row = 0; row < WORLD.rows; row += 1) {
    for (let col = 0; col < WORLD.cols; col += 1) {
      nodes.push({ x: -WORLD.boulevardX - col * WORLD.block, z: WORLD.gridMinZ + row * WORLD.block, row, col });
    }
  }
  return nodes;
}

export function nodeIndex(row, col) {
  return row * WORLD.cols + col;
}

/** The centre of an avenue (col 0 is the boulevard) on the x axis. */
export function avenueX(col) {
  return -WORLD.boulevardX - col * WORLD.block;
}

/** The centre of a cross street (row 0 is the south end) on the z axis. */
export function crossZ(row) {
  return WORLD.gridMinZ + row * WORLD.block;
}

/** Squared distance from (x, z) to the closest point on the street network. */
export function nearestRoadPoint(x, z) {
  const col = Math.round(-x / WORLD.block - WORLD.boulevardX / WORLD.block);
  const row = Math.round((z - WORLD.gridMinZ) / WORLD.block);
  // Snap to the closest of the four surrounding intersection centres.
  const c0 = Math.max(0, Math.min(WORLD.cols - 1, col));
  const r0 = Math.max(0, Math.min(WORLD.rows - 1, row));
  let best = { x: avenueX(c0), z: crossZ(r0), row: r0, col: c0, d: Infinity };
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      const r = Math.max(0, Math.min(WORLD.rows - 1, r0 + dr));
      const c = Math.max(0, Math.min(WORLD.cols - 1, c0 + dc));
      const nx = avenueX(c), nz = crossZ(r);
      const d = (nx - x) ** 2 + (nz - z) ** 2;
      if (d < best.d) best = { x: nx, z: nz, row: r, col: c, d };
    }
  }
  return best;
}

/** A random lane point anywhere in the grid: on a road, offset to a driving side. */
export function randomRoadPoint(random) {
  const alongAvenue = random.next() < 0.45;
  if (alongAvenue) {
    const col = random.int(0, WORLD.cols - 1);
    const z = random.range(WORLD.gridMinZ, WORLD.gridMaxZ);
    const side = random.chance(2) ? 3.5 : -3.5;
    return { x: avenueX(col) + side, z, heading: side > 0 ? Math.PI / 2 : -Math.PI / 2, onAvenue: true };
  }
  const row = random.int(0, WORLD.rows - 1);
  const x = random.range(avenueX(WORLD.cols - 1), avenueX(0) + 30);
  const side = random.chance(2) ? 3.5 : -3.5;
  return { x, z: crossZ(row) + side, heading: side > 0 ? Math.PI : 0, onAvenue: false };
}

/** A greedy route across the grid from node (r1, c1) to (r2, c2): node list, avenue runs then crosses. */
export function routeBetweenNodes(r1, c1, r2, c2) {
  const route = [];
  let col = c1, row = r1;
  route.push({ row, col });
  while (col !== c2) {
    col += Math.sign(c2 - col);
    route.push({ row, col });
  }
  while (row !== r2) {
    row += Math.sign(r2 - row);
    route.push({ row, col });
  }
  return route;
}

/**
 * Right-hand lane offset for a vehicle driving from node A to node B (adjacent nodes): the
 * directed pair decides the perpendicular shift, so traffic keeps to one side.
 */
export function laneOffset(fromRow, fromCol, toRow, toCol) {
  const east = toCol < fromCol; // avenues grow westward as col rises
  if (fromRow === toRow) {
    return { dx: 0, dz: east ? 3.2 : -3.2, heading: east ? Math.PI : 0 };
  }
  return { dx: toRow > fromRow ? 3.2 : -3.2, dz: 0, heading: toRow > fromRow ? Math.PI / 2 : -Math.PI / 2 };
}

/** True when (x, z) lies on any road surface (including the shoulder line). */
export function isOnRoad(x, z, margin = WORLD.roadHalf) {
  const nearX = snapDist(-x, WORLD.cols - 1);
  const nearZ = snapDist(z - WORLD.gridMinZ, WORLD.rows - 1);
  return nearX <= margin || nearZ <= margin;
}

function snapDist(value, count) {
  const idx = Math.round(value / WORLD.block);
  if (idx < 0 || idx > count) return Infinity;
  return Math.abs(value - idx * WORLD.block);
}

/** True when (x, z) lies on the sand or in the surf. */
export function isOnBeach(x) {
  return x > WORLD.beachStartX && x < WORLD.waterX + 20;
}
