/**
 * renderer.js
 * All canvas drawing operations.
 * Nothing in this module mutates game state — it only reads it.
 */

import { state } from './state.js';
import { COLORS, BORDER, OBSTACLE_TYPES } from './constants.js';

// ─── Coordinate helpers ───────────────────────────────────────────────────────

/**
 * Converts a grid X coordinate to the canvas pixel centre of that cell.
 * @param {number} gx  Grid x (can be fractional during movement)
 * @returns {number}
 */
export function gridToCanvasX(gx) {
  return Math.round(gx * state.interval + state.interval / 2) + BORDER;
}

/**
 * Converts a grid Y coordinate to the canvas pixel centre of that cell.
 * @param {number} gy  Grid y
 * @returns {number}
 */
export function gridToCanvasY(gy) {
  return Math.round(gy * state.interval + state.interval / 2) + BORDER;
}

// ─── Canvas access helper ─────────────────────────────────────────────────────

/** @returns {{ canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D }} */
function getCtx() {
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('canvas'));
  return { canvas, ctx: canvas.getContext('2d') };
}

// ─── Full redraw ──────────────────────────────────────────────────────────────

/**
 * Clears and redraws the entire canvas: grid lines, obstacles, and route.
 * Call this whenever the maze layout or zoom level changes.
 */
export function drawGrid() {
  const { canvas, ctx } = getCtx();
  canvas.width  = state.canvasWidth;
  canvas.height = state.canvasHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Graph-paper grid lines
  ctx.beginPath();
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let x = BORDER; x <= canvas.width; x += state.interval) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
  }
  for (let y = BORDER; y < canvas.height; y += state.interval) {
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
  }
  ctx.stroke();

  _drawObstacles(ctx);

  if (state.route.length > 0) {
    _drawRoute(ctx);
  }
}

// ─── Obstacle drawing ─────────────────────────────────────────────────────────

/**
 * Draws all obstacles, batched by type so each colour only needs one beginPath.
 * @param {CanvasRenderingContext2D} ctx
 */
function _drawObstacles(ctx) {
  const iv = state.interval;

  for (const type of OBSTACLE_TYPES) {
    ctx.beginPath();
    ctx.strokeStyle = COLORS[type];
    ctx.lineWidth = 2;

    for (const obs of state.obstacles) {
      if (obs.type !== type) continue;
      const x = obs.x * iv + BORDER;
      const y = obs.y * iv + BORDER;
      if (obs.orient === 'vertical') {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + iv);
      } else {
        ctx.moveTo(x, y);
        ctx.lineTo(x + iv, y);
      }
    }
    ctx.stroke();
  }
}

// ─── Route drawing ────────────────────────────────────────────────────────────

/**
 * Draws the player's travelled path.
 * The full route is bright green; the most recent segment is darker.
 * @param {CanvasRenderingContext2D} ctx
 */
function _drawRoute(ctx) {
  const route = state.route;
  if (route.length < 1) return;

  // Full route — bright green
  ctx.beginPath();
  ctx.strokeStyle = COLORS.route;
  ctx.lineWidth = 2;
  ctx.moveTo(gridToCanvasX(route[0].spot[0]), gridToCanvasY(route[0].spot[1]));
  for (let i = 1; i < route.length; i++) {
    ctx.lineTo(gridToCanvasX(route[i].spot[0]), gridToCanvasY(route[i].spot[1]));
  }
  ctx.stroke();

  // Last segment — dark green
  const last = route[route.length - 1];
  ctx.beginPath();
  ctx.strokeStyle = COLORS.routeLast;
  ctx.lineWidth = 2;
  ctx.moveTo(gridToCanvasX(last.spot[0]), gridToCanvasY(last.spot[1]));
  ctx.lineTo(gridToCanvasX(state.spot[0]), gridToCanvasY(state.spot[1]));
  ctx.stroke();
}

// ─── Player marker ────────────────────────────────────────────────────────────

/**
 * Draws a filled circle at the player's current (or given) position.
 * @param {number[]} [position]  [x, y, …] in grid coords. Defaults to state.spot.
 */
export function drawCurrentPosition(position = state.spot) {
  const { ctx } = getCtx();
  const iv = state.interval;
  const cx = position[0] * iv + iv / 2 + BORDER;
  const cy = position[1] * iv + iv / 2 + BORDER;
  const r  = iv / 4;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.fillStyle = COLORS.player;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.playerStroke;
  ctx.stroke();
}

// ─── Start / end markers ──────────────────────────────────────────────────────

/**
 * Draws orange circles around the begin and end obstacles.
 * Intended to be shown temporarily (caller should redraw to clear them).
 */
export function displayEnds() {
  const { ctx } = getCtx();
  const iv     = state.interval;
  const radius = iv / 2 + 5;

  ctx.lineWidth   = 3;
  ctx.strokeStyle = COLORS.endMarker;

  for (const obs of state.obstacles) {
    if (obs.type !== 'begin' && obs.type !== 'end') continue;

    let cx, cy;
    if (obs.orient === 'horizontal') {
      cx = obs.x * iv + iv / 2 + BORDER;
      cy = obs.y * iv + BORDER;
    } else {
      cx = obs.x * iv + BORDER;
      cy = obs.y * iv + iv / 2 + BORDER;
    }

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.stroke();
  }
}

// ─── Solution path ────────────────────────────────────────────────────────────

/**
 * Draws the auto-solved path(s) in gold on top of the existing canvas.
 * @param {number[][]} solutions  Each element is an array of mazeMap indices.
 * @param {number}     [maxTurns] If set, only the first N steps are drawn per route.
 */
export function drawSolution(solutions, maxTurns) {
  const { ctx } = getCtx();
  ctx.strokeStyle = COLORS.solution;
  ctx.lineWidth   = 2;

  for (const solution of solutions) {
    ctx.beginPath();
    ctx.moveTo(gridToCanvasX(state.spot[0]), gridToCanvasY(state.spot[1]));

    for (let i = 0; i < solution.length; i++) {
      const entry = state.mazeMap[solution[i]];
      if (!entry?.obstacleSpot) continue;
      ctx.lineTo(
        gridToCanvasX(entry.obstacleSpot[0]),
        gridToCanvasY(entry.obstacleSpot[1]),
      );
      if (maxTurns != null && i >= maxTurns) break;
    }
    ctx.stroke();
  }
}
