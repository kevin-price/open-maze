/**
 * movement.js
 * Player movement: obstacle detection, animation loop, stop/resume/start.
 *
 * Circular-import note:
 *   This module imports from ui.js and actions.js. Those modules also import
 *   from this one. ES modules handle this correctly because all cross-module
 *   calls happen inside function bodies (after all modules have finished
 *   initialising), not at the top level.
 */

import { state }                        from './state.js';
import { BORDER, COLORS }               from './constants.js';
import { drawGrid, drawCurrentPosition } from './renderer.js';
import { findBegin }                     from './creator.js';
import { copyArray }                     from './utils.js';
// Resolved at call time (circular):
import { showMovingUI, showPausedUI, showStoppedUI, showOffEdgeUI, showVictoryUI } from './ui.js';
import { applyTurnRight, applyTurnLeft } from './actions.js';
import { addRouteToSolved }              from './solver.js';
import { tutorialHandler }               from './tutorial.js';

// ─── Obstacle detection ───────────────────────────────────────────────────────

/**
 * Looks ahead from the given position in its current direction and returns
 * the next obstacle (or maze edge) that the player will hit.
 *
 * @param {number[]} [checkSpot]  [x, y, dir, …]. Defaults to state.spot.
 * @returns {{ obstacle: number, dist: number }}
 *   obstacle: index into state.obstacles (-1 = hit the edge)
 *   dist:     distance in grid units to the obstacle
 */
export function checkObstacles(checkSpot = state.spot) {
  const { obstacleRows, obstacleColumns, obstacles, xGrids, yGrids } = state;
  let obsIdx = -1;
  let dist   = 0;

  switch (checkSpot[2]) {
    case 'up': {
      const x = Math.round(checkSpot[0]);
      const y = Math.floor(checkSpot[1]);
      for (let i = y; i >= 0; i--) {
        if (obstacleColumns[x]?.[i]?.length) { obsIdx = obstacleColumns[x][i][0]; break; }
      }
      dist = obsIdx === -1
        ? Math.abs(-0.5 - checkSpot[1])
        : Math.abs(obstacles[obsIdx].y - checkSpot[1]);
      break;
    }
    case 'down': {
      const x = Math.round(checkSpot[0]);
      const y = Math.ceil(checkSpot[1]);
      for (let i = y + 1; i <= yGrids; i++) {
        if (obstacleColumns[x]?.[i]?.length) { obsIdx = obstacleColumns[x][i][0]; break; }
      }
      dist = obsIdx === -1
        ? Math.abs(yGrids + 0.5 - checkSpot[1]) - 1
        : Math.abs(obstacles[obsIdx].y - checkSpot[1]) - 1;
      break;
    }
    case 'right': {
      const x = Math.ceil(checkSpot[0]);
      const y = Math.round(checkSpot[1]);
      for (let i = x + 1; i <= xGrids; i++) {
        if (obstacleRows[y]?.[i]?.length) { obsIdx = obstacleRows[y][i][0]; break; }
      }
      dist = obsIdx === -1
        ? Math.abs(xGrids + 0.5 - checkSpot[0]) - 1
        : Math.abs(obstacles[obsIdx].x - checkSpot[0]) - 1;
      break;
    }
    case 'left': {
      const x = Math.floor(checkSpot[0]);
      const y = Math.round(checkSpot[1]);
      for (let i = x; i >= 0; i--) {
        if (obstacleRows[y]?.[i]?.length) { obsIdx = obstacleRows[y][i][0]; break; }
      }
      dist = obsIdx === -1
        ? Math.abs(-0.5 - checkSpot[0])
        : Math.abs(obstacles[obsIdx].x - checkSpot[0]);
      break;
    }
  }

  return { obstacle: obsIdx, dist };
}

// ─── Direction logic ──────────────────────────────────────────────────────────

/**
 * Returns the list of actions available to the player at the given stop.
 *
 * Possible actions: 'forward' | 'backward' | 'left' | 'right'
 *
 * 'forward' is only available when the obstacle is permeable.
 * 'backward' appears when both perpendicular sides have walls (dead-end).
 * 'left' / 'right' follow the standard turning conventions.
 *
 * Note: when travelling *downward*, compass-left and compass-right are
 * swapped relative to the player's perspective — this matches the original.
 *
 * @param {number}   stopObstacle  Index of the obstacle hit.
 * @param {number[]} [checkSpot]   Defaults to state.spot.
 * @returns {string[]}
 */
export function obstacleDirections(stopObstacle, checkSpot = state.spot) {
  if (stopObstacle === -1) return [];

  const { obstacles, obstacleRows, obstacleColumns } = state;
  const [gx, gy, dir] = checkSpot;

  const isBlocking = (idx) => idx !== undefined && obstacles[idx]?.type !== 'permeable';

  const leftObs   = obstacleRows[gy]?.[gx]?.[0];
  const rightObs  = obstacleRows[gy]?.[gx + 1]?.[0];
  const topObs    = obstacleColumns[gx]?.[gy]?.[0];
  const bottomObs = obstacleColumns[gx]?.[gy + 1]?.[0];

  const hasLeft   = isBlocking(leftObs);
  const hasRight  = isBlocking(rightObs);
  const hasTop    = isBlocking(topObs);
  const hasBottom = isBlocking(bottomObs);

  const out = [];
  if (obstacles[stopObstacle].type === 'permeable') out.push('forward');

  switch (dir) {
    case 'up':
      if (hasLeft && hasRight)   out.push('backward');
      if (hasLeft  && !hasRight) out.push('right');
      if (!hasLeft && hasRight)  out.push('left');
      if (!hasLeft && !hasRight) out.push('right', 'left');
      break;
    case 'down':
      if (hasLeft && hasRight)   out.push('backward');
      if (hasLeft  && !hasRight) out.push('left');   // swapped for downward travel
      if (!hasLeft && hasRight)  out.push('right');
      if (!hasLeft && !hasRight) out.push('right', 'left');
      break;
    case 'right':
      if (hasTop && hasBottom)   out.push('backward');
      if (hasTop  && !hasBottom) out.push('right');
      if (!hasTop && hasBottom)  out.push('left');
      if (!hasTop && !hasBottom) out.push('right', 'left');
      break;
    case 'left':
      if (hasTop && hasBottom)   out.push('backward');
      if (hasTop  && !hasBottom) out.push('left');
      if (!hasTop && hasBottom)  out.push('right');
      if (!hasTop && !hasBottom) out.push('right', 'left');
      break;
  }

  return out;
}

/**
 * Updates state.turns so arrow keys map to the correct game actions
 * given the player's current facing direction and available choices.
 *
 * @param {string[]} directions  Available actions from obstacleDirections().
 */
export function pushArrowKeyOptions(directions) {
  const dir = state.spot[2];
  const has = (action) => directions.includes(action);

  // Maps: for each facing direction, which physical key does each action?
  const KEY = {
    up:    { forward: 'upkey',    backward: 'downkey',  right: 'rightkey', left: 'leftkey'  },
    down:  { forward: 'downkey',  backward: 'upkey',    right: 'leftkey',  left: 'rightkey' },
    right: { forward: 'rightkey', backward: 'leftkey',  right: 'downkey',  left: 'upkey'    },
    left:  { forward: 'leftkey',  backward: 'rightkey', right: 'upkey',    left: 'downkey'  },
  };

  const map = KEY[dir] ?? {};
  const turns = {};
  for (const [action, key] of Object.entries(map)) {
    if (has(action)) turns[key] = action;
  }
  state.turns = turns;
}

// ─── Auto-scroll ──────────────────────────────────────────────────────────────

/**
 * Scrolls #canvas-scroll so the player stays comfortably in view.
 * Called every animation frame and after zoom changes.
 */
export function scrollToPlayer() {
  const scroll = document.getElementById('canvas-scroll');
  if (!scroll) return;

  const iv = state.interval;
  const px = state.spot[0] * iv + iv / 2 + BORDER; // player canvas-pixel X
  const py = state.spot[1] * iv + iv / 2 + BORDER; // player canvas-pixel Y

  // Keep the player at least MARGIN px away from the visible edge
  const MARGIN = iv * 4;

  const visL = scroll.scrollLeft;
  const visT = scroll.scrollTop;
  const visR = visL + scroll.clientWidth;
  const visB = visT + scroll.clientHeight;

  if (px < visL + MARGIN) scroll.scrollLeft = px - MARGIN;
  if (px > visR - MARGIN) scroll.scrollLeft = px - scroll.clientWidth + MARGIN;
  if (py < visT + MARGIN) scroll.scrollTop  = py - MARGIN;
  if (py > visB - MARGIN) scroll.scrollTop  = py - scroll.clientHeight + MARGIN;
}

// ─── Animation loop ───────────────────────────────────────────────────────────

/**
 * Starts the requestAnimationFrame animation loop.
 * The player moves toward the next obstacle at state.speed px/s.
 * Stops automatically when the obstacle is reached.
 */
export function move() {
  const stop = checkObstacles();
  let distRemaining = stop.dist; // grid units
  let prevTime = null;

  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('canvas'));
  const ctx    = canvas.getContext('2d');

  function frame(timestamp) {
    // Another code path may have already stopped the player (e.g. backtrack)
    if (state.spot[3] !== 'moving') {
      drawCurrentPosition();
      if (state.tutorial) tutorialHandler();
      return;
    }

    if (prevTime === null) prevTime = timestamp;
    // Cap elapsed to 50 ms so a hidden/background tab doesn't cause giant jumps
    const elapsed   = Math.min(timestamp - prevTime, 50);
    prevTime        = timestamp;

    // Convert speed (px/s) and elapsed (ms) to grid units moved this frame
    const gridMoved = (state.speed * elapsed) / (1000 * state.interval);

    // Draw the incremental line segment in dark green
    ctx.beginPath();
    ctx.strokeStyle = COLORS.routeLast;
    ctx.lineWidth   = 2;
    ctx.moveTo(
      Math.round(state.spot[0] * state.interval + state.interval / 2) + BORDER,
      Math.round(state.spot[1] * state.interval + state.interval / 2) + BORDER,
    );

    switch (state.spot[2]) {
      case 'up':    state.spot[1] -= gridMoved; break;
      case 'down':  state.spot[1] += gridMoved; break;
      case 'right': state.spot[0] += gridMoved; break;
      case 'left':  state.spot[0] -= gridMoved; break;
    }

    ctx.lineTo(
      Math.round(state.spot[0] * state.interval + state.interval / 2) + BORDER,
      Math.round(state.spot[1] * state.interval + state.interval / 2) + BORDER,
    );
    ctx.stroke();

    scrollToPlayer();

    distRemaining -= gridMoved;
    if (distRemaining <= 0) {
      stopHandler(stop.obstacle);
      return;
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

// ─── Obstacle stop handler ────────────────────────────────────────────────────

/**
 * Called when the player reaches an obstacle (or edge).
 * Rounds position, updates the route, redraws, and delegates to UI.
 * Handles forced turns (single-direction stops) automatically.
 *
 * @param {number}  obstacleIdx  Index in state.obstacles, or -1 for the edge.
 * @param {boolean} [push=true]  If false, don't push a new entry onto state.route
 *                               (used by backTrack, which already repositioned).
 */
export function stopHandler(obstacleIdx, push = true) {
  // Snap to exact grid position to prevent floating-point accumulation
  state.spot[0] = Math.round(state.spot[0]);
  state.spot[1] = Math.round(state.spot[1]);
  state.spot[3] = 'stopped';

  drawGrid();

  if (push) {
    state.route.push({ spot: copyArray(state.spot), obstacle: obstacleIdx });
  }

  drawCurrentPosition();

  // ── Off the edge ───────────────────────────────────────────────────────────
  if (obstacleIdx === -1) {
    showOffEdgeUI();
    return;
  }

  // ── Reached the goal ───────────────────────────────────────────────────────
  if (state.obstacles[obstacleIdx].type === 'end') {
    addRouteToSolved();
    showVictoryUI();
    return;
  }

  const directions = obstacleDirections(obstacleIdx);
  pushArrowKeyOptions(directions);

  // ── Forced turn (only one non-backward option) ─────────────────────────────
  if (directions.length === 1 && directions[0] !== 'backward') {
    if (directions[0] === 'right') { applyTurnRight(); return; }
    if (directions[0] === 'left')  { applyTurnLeft();  return; }
  }

  // ── Player must choose ─────────────────────────────────────────────────────
  showStoppedUI(directions);

  if (state.tutorial) tutorialHandler();
}

// ─── Maze control ─────────────────────────────────────────────────────────────

/**
 * Resumes movement from the current spot.
 */
export function resumeMaze() {
  state.spot[3] = 'moving';
  state.turns   = {};
  showMovingUI();
  move();
}

/**
 * Pauses movement.
 */
export function stopMaze() {
  state.spot[3] = 'stopped';
  showPausedUI();
}

/**
 * Sends the player to the beginning obstacle and starts the maze.
 */
export function startMaze() {
  const beginIdx = findBegin();
  if (beginIdx === -1) {
    alert(
      'No starting point found.\n\n' +
      'Open the Maze Creator and place a "Beginning" marker.',
    );
    return;
  }

  state.route = [];
  const obs   = state.obstacles[beginIdx];
  state.spot  = [obs.x, obs.y - 0.5, 'up', 'moving'];

  state.route.push({ spot: copyArray(state.spot), obstacle: beginIdx });

  drawGrid();
  resumeMaze();
}
