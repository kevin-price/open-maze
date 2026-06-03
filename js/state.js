/**
 * state.js
 * The single shared mutable game state object.
 *
 * All game modules import this object and read/write it directly.
 * This mirrors the original globals but keeps them in one explicit place.
 *
 * COORDINATE SYSTEM
 * -----------------
 * Positions are in *grid units* (not pixels).
 * Grid (0, 0) is the top-left corner.
 * X increases rightward, Y increases downward.
 * The player's spot can be fractional during movement (e.g. y = 4.73).
 * Obstacles always sit at exact integer grid coordinates.
 *
 * Conversion to canvas pixels:
 *   canvasX = gridX * interval + interval/2 + BORDER
 *   canvasY = gridY * interval + interval/2 + BORDER
 */

import {
  DEFAULT_INTERVAL,
  DEFAULT_X_GRIDS,
  DEFAULT_Y_GRIDS,
  DEFAULT_SPEED,
  BORDER,
} from './constants.js';

export const state = {
  // ── Grid settings ────────────────────────────────────────────────────────
  /** Pixels per grid cell. Changes when user zooms. */
  interval: DEFAULT_INTERVAL,
  /** Maze width in cells. */
  xGrids: DEFAULT_X_GRIDS,
  /** Maze height in cells. */
  yGrids: DEFAULT_Y_GRIDS,

  // ── Animation ────────────────────────────────────────────────────────────
  /** Player movement speed in pixels per second. */
  speed: DEFAULT_SPEED,

  // ── Maze data ────────────────────────────────────────────────────────────
  /**
   * Flat array of all obstacles.
   * Each obstacle: { type, orient: 'horizontal'|'vertical', x, y }
   */
  obstacles: [],

  /**
   * 2-D lookup for *vertical* obstacles, indexed [gridY][gridX].
   * Each cell holds an array of indices into state.obstacles.
   */
  obstacleRows: [],

  /**
   * 2-D lookup for *horizontal* obstacles, indexed [gridX][gridY].
   * Each cell holds an array of indices into state.obstacles.
   */
  obstacleColumns: [],

  // ── Player ───────────────────────────────────────────────────────────────
  /**
   * Current player position and state.
   * [gridX, gridY, direction, status]
   * direction: 'up' | 'down' | 'left' | 'right'
   * status:    'stopped' | 'moving' | 'drawing' | 'startCustom'
   */
  spot: [0, 0, 'up', 'stopped'],

  /** Start position loaded from the 'begin' obstacle. Same shape as spot. */
  beginning: [],

  /**
   * Route history — every stop point the player has visited.
   * Each entry: { spot: [x, y, dir], obstacle: obstacleIndex }
   * obstacle = -1 means the player fell off the edge.
   */
  route: [],

  // ── Solver ───────────────────────────────────────────────────────────────
  /** Completed solved routes (array of [x, y, dir] triples). */
  solvedRoutes: [],
  /** Same routes expressed as mazeMap indices. */
  solvedRouteIndices: [],
  /**
   * The full maze decision graph built by mapMaze().
   * Null until mapMaze() runs successfully.
   */
  mazeMap: null,

  // ── UI state ─────────────────────────────────────────────────────────────
  /**
   * Maps arrow-key names to game actions at the current stop.
   * Keys:   'upkey' | 'downkey' | 'leftkey' | 'rightkey'
   * Values: 'forward' | 'backward' | 'left' | 'right'
   */
  turns: { upkey: 'forward' },

  /** Temporary click position while the user picks a custom start location. */
  customSpot: [],

  /** Which obstacle type the creator tool currently draws. */
  obstacleType: 'wall',

  /** True while tutorial mode is active. */
  tutorial: false,

  // ── Derived (read-only getters) ───────────────────────────────────────────
  get canvasWidth()  { return this.interval * this.xGrids  + BORDER * 2; },
  get canvasHeight() { return this.interval * this.yGrids  + BORDER * 2; },
};
