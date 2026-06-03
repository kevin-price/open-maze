/**
 * creator.js
 * Maze editor: obstacle creation, deletion, grid management.
 */

import { state } from './state.js';
import { BORDER, COLORS } from './constants.js';
import { drawGrid } from './renderer.js';

// ─── Obstacle lookup grid ─────────────────────────────────────────────────────

/**
 * Rebuilds the 2-D obstacle lookup grids from scratch.
 *
 * After this call:
 *   state.obstacleRows[y][x]    → indices of vertical obstacles at (x, y)
 *   state.obstacleColumns[x][y] → indices of horizontal obstacles at (x, y)
 *
 * Must be called whenever state.obstacles changes in bulk
 * (e.g. after loading a maze file).
 */
export function generateObstacleGrid() {
  const { xGrids, yGrids } = state;

  // Vertical obstacles are stored by [row (y)][col (x)]
  state.obstacleRows = Array.from({ length: yGrids + 1 }, () =>
    Array.from({ length: xGrids + 1 }, () => []),
  );

  // Horizontal obstacles are stored by [col (x)][row (y)]
  state.obstacleColumns = Array.from({ length: xGrids + 1 }, () =>
    Array.from({ length: yGrids + 1 }, () => []),
  );

  for (let i = 0; i < state.obstacles.length; i++) {
    const obs = state.obstacles[i];
    if (obs.orient === 'vertical') {
      state.obstacleRows[obs.y]?.[obs.x]?.push(i);
    } else {
      state.obstacleColumns[obs.x]?.[obs.y]?.push(i);
    }
  }
}

// ─── Obstacle search helpers ──────────────────────────────────────────────────

/**
 * Returns the index of an existing obstacle at the same grid position
 * and orientation, or -1 if none exists.
 * @param {{ orient: string, x: number, y: number }} candidate
 * @returns {number}
 */
export function checkForObstacle(candidate) {
  return state.obstacles.findIndex(
    obs =>
      obs.x === candidate.x &&
      obs.y === candidate.y &&
      obs.orient === candidate.orient,
  );
}

/**
 * Returns the index of the 'begin' obstacle, or -1.
 * @returns {number}
 */
export function findBegin() {
  return state.obstacles.findIndex(obs => obs.type === 'begin');
}

/**
 * Returns indices of all 'end' obstacles.
 * @returns {number[]}
 */
export function findEnds() {
  return state.obstacles.reduce((acc, obs, i) => {
    if (obs.type === 'end') acc.push(i);
    return acc;
  }, []);
}

// ─── Obstacle drawing ─────────────────────────────────────────────────────────

/**
 * Registers a new obstacle in state.obstacles and the lookup grids,
 * then draws it immediately on the canvas.
 *
 * If the type is 'begin', any existing begin obstacle is removed first
 * (there can only be one). begin obstacles are always horizontal.
 *
 * @param {{ type: string, orient: string, x: number, y: number }} obstacle
 */
export function drawObstacle(obstacle) {
  if (obstacle.type === 'begin') {
    obstacle.orient = 'horizontal'; // begin is always a horizontal line

    const existingIdx = findBegin();
    if (existingIdx !== -1) {
      const old = state.obstacles[existingIdx];
      const col = state.obstacleColumns[old.x];
      if (col?.[old.y]) {
        const pos = col[old.y].indexOf(existingIdx);
        if (pos !== -1) col[old.y].splice(pos, 1);
      }
      state.obstacles.splice(existingIdx, 1);
      generateObstacleGrid(); // indices shifted — rebuild
      drawGrid();
    }

    // Player starts just below the begin line, facing up
    state.beginning = [obstacle.x, obstacle.y - 0.5, 'up', 'stopped'];
  }

  state.obstacles.push(obstacle);
  const newIdx = state.obstacles.length - 1;

  // Register in lookup grid
  if (obstacle.orient === 'vertical') {
    state.obstacleRows[obstacle.y]?.[obstacle.x]?.push(newIdx);
  } else {
    state.obstacleColumns[obstacle.x]?.[obstacle.y]?.push(newIdx);
  }

  // Draw on canvas
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('canvas'));
  const ctx    = canvas.getContext('2d');
  const iv     = state.interval;
  const x      = obstacle.x * iv + BORDER;
  const y      = obstacle.y * iv + BORDER;

  ctx.beginPath();
  ctx.lineWidth   = 2;
  ctx.strokeStyle = COLORS[obstacle.type] ?? COLORS.wall;

  if (obstacle.orient === 'vertical') {
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + iv);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x + iv, y);
  }
  ctx.stroke();
}

// ─── Click → grid-line snap ───────────────────────────────────────────────────

/**
 * Takes a raw canvas pixel coordinate from a click and snaps it to the
 * nearest grid line. Then either creates a new obstacle or toggles off
 * an existing one at that position.
 *
 * @param {number} px  Canvas x in pixels
 * @param {number} py  Canvas y in pixels
 */
export function setLine(px, py) {
  const iv = state.interval;

  // How far is the click from the nearest vertical and horizontal grid lines?
  const xMod  = px % iv;
  const yMod  = py % iv;
  const xDist = Math.min(xMod, iv - xMod);
  const yDist = Math.min(yMod, iv - yMod);

  let snappedX, snappedY, orient;

  if (xDist <= yDist) {
    // Closer to a vertical grid line → vertical obstacle
    orient   = 'vertical';
    snappedX = xMod >= iv - xMod ? px + (iv - xMod) : px - xMod;
    snappedY = py - yMod; // snap Y to the grid row above
  } else {
    // Closer to a horizontal grid line → horizontal obstacle
    orient   = 'horizontal';
    snappedX = px - xMod; // snap X to the grid column to the left
    snappedY = yMod >= iv - yMod ? py + (iv - yMod) : py - yMod;
  }

  const candidate = {
    type:   state.obstacleType,
    orient,
    x: snappedX / iv,
    y: snappedY / iv,
  };

  const existingIdx = checkForObstacle(candidate);
  if (existingIdx === -1) {
    // No obstacle here yet — create one
    drawObstacle(candidate);
  } else {
    // Obstacle already here — toggle it off
    state.obstacles.splice(existingIdx, 1);
    if (orient === 'vertical') {
      const row = state.obstacleRows[candidate.y]?.[candidate.x];
      if (row) row.splice(0, 1);
    } else {
      const col = state.obstacleColumns[candidate.x]?.[candidate.y];
      if (col) col.splice(0, 1);
    }
    drawGrid();
  }
}

// ─── Bulk operations ──────────────────────────────────────────────────────────

/**
 * Clears all obstacles and resets grid dimensions (with confirmation).
 */
export function eraseMaze() {
  if (!confirm('Erase all obstacles? This cannot be undone.')) return;
  state.obstacles = [];
  state.interval  = 20;
  state.xGrids    = 28;
  state.yGrids    = 12;
  generateObstacleGrid();
  drawGrid();
}

/**
 * Applies new grid dimensions if they are in the valid range [10, 200].
 * @param {number} horizontal  New width in cells
 * @param {number} vertical    New height in cells
 * @returns {boolean}          True on success
 */
export function applyGridSize(horizontal, vertical) {
  horizontal = Number(horizontal);
  vertical   = Number(vertical);
  if (
    isNaN(horizontal) || isNaN(vertical) ||
    horizontal < 10 || horizontal > 200 ||
    vertical   < 10 || vertical   > 200
  ) {
    return false;
  }
  state.xGrids = Math.round(horizontal);
  state.yGrids = Math.round(vertical);
  drawGrid();
  return true;
}
