/**
 * actions.js
 * Player-controlled actions: turning, passing through permeable walls, backtracking.
 *
 * Each turn has two variants:
 *   apply*()   — mutates state.spot and immediately resumes movement (used by UI)
 *   compute*() — pure function returning the new direction (used by solver)
 */

import { state }                                from './state.js';
import { drawGrid, drawCurrentPosition }        from './renderer.js';
import { copyArray }                            from './utils.js';
import {
  obstacleDirections,
  pushArrowKeyOptions,
  resumeMaze,
  checkObstacles,
  stopHandler,
} from './movement.js';
import { tutorialHandler }                      from './tutorial.js';
import { enterPlayMode }                        from './ui.js';

// ─── Pure direction helpers (used by solver) ──────────────────────────────────

/** @param {string} dir @returns {string} */
export function computeTurnRight(dir) {
  return { up: 'right', down: 'left', right: 'down', left: 'up' }[dir];
}

/** @param {string} dir @returns {string} */
export function computeTurnLeft(dir) {
  return { up: 'left', down: 'right', right: 'up', left: 'down' }[dir];
}

/** @param {string} dir @returns {string} */
export function computeTurnBackward(dir) {
  return { up: 'down', down: 'up', right: 'left', left: 'right' }[dir];
}

/**
 * Advances a spot [x, y, dir] one half-step forward past a permeable wall.
 * Returns the new spot — does not mutate state. Used by the solver.
 * @param {number[]} spot
 * @returns {number[]}
 */
export function computeMoveForward(spot) {
  const half = 0.5; // grid units — enough to pass through the permeable line
  const [x, y, dir] = spot;
  switch (dir) {
    case 'up':    return [x,        y - half, dir];
    case 'down':  return [x,        y + half, dir];
    case 'right': return [x + half, y,        dir];
    case 'left':  return [x - half, y,        dir];
  }
}

// ─── Applied turn actions (used by UI & stop handler) ────────────────────────

/** Turn right relative to current facing and resume. */
export function applyTurnRight() {
  state.spot[2] = computeTurnRight(state.spot[2]);
  resumeMaze();
}

/** Turn left relative to current facing and resume. */
export function applyTurnLeft() {
  state.spot[2] = computeTurnLeft(state.spot[2]);
  resumeMaze();
}

/** Reverse direction and resume. */
export function applyTurnBackward() {
  state.spot[2] = computeTurnBackward(state.spot[2]);
  resumeMaze();
}

/** Pass through a permeable wall (nudge forward) and resume. */
export function applyMoveForward() {
  const iv   = state.interval;
  const nudge = 0.5; // grid units — enough to clear the permeable line

  switch (state.spot[2]) {
    case 'up':    state.spot[1] -= nudge; break;
    case 'down':  state.spot[1] += nudge; break;
    case 'right': state.spot[0] += nudge; break;
    case 'left':  state.spot[0] -= nudge; break;
  }
  resumeMaze();
}

// ─── Backtracking ─────────────────────────────────────────────────────────────

/**
 * Steps the player back along their route history.
 * Keeps going backward automatically through forced turns (only one choice)
 * until a real decision point is reached.
 *
 * If the player backtracks all the way to the beginning obstacle,
 * the game returns to the "ready to play" state.
 */
export function backTrack() {
  const route = state.route;

  // If the player is currently sitting at the most recent stop point,
  // pop it first so we don't count it twice.
  const last = route[route.length - 1];
  if (
    last &&
    state.spot[0] === last.spot[0] &&
    state.spot[1] === last.spot[1] &&
    route.length > 1
  ) {
    route.pop();
  }

  let directions;
  let first = true;

  // Keep stepping backward through forced turns
  do {
    if (!first) route.pop();
    first = false;

    const entry = route[route.length - 1];
    state.spot  = copyArray(entry.spot);

    // Reached the beginning — return to ready state
    if (entry.obstacle !== -1 && state.obstacles[entry.obstacle]?.type === 'begin') {
      state.turns = { upkey: 'forward' };
      drawGrid();
      drawCurrentPosition();
      enterPlayMode(true);
      return;
    }

    // Custom start with no real obstacle
    if (entry.obstacle === -1) {
      drawGrid();
      resumeMaze();
      return;
    }

    directions = obstacleDirections(entry.obstacle);
    pushArrowKeyOptions(directions);
  } while (directions.length === 1);

  drawGrid();
  drawCurrentPosition();

  if (state.tutorial) tutorialHandler();

  // Re-run stopHandler logic (without pushing to route again)
  stopHandler(checkObstacles().obstacle, false);
}
