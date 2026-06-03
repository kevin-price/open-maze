/**
 * constants.js
 * All compile-time constants for the Inverted Maze game.
 * Import these instead of using magic numbers.
 */

/** 1-pixel border drawn around the maze canvas edge */
export const BORDER = 1;

// ─── Grid defaults ────────────────────────────────────────────────────────────
export const DEFAULT_INTERVAL = 20;   // pixels per grid cell
export const DEFAULT_X_GRIDS  = 28;
export const DEFAULT_Y_GRIDS  = 25;

// ─── Zoom ─────────────────────────────────────────────────────────────────────
export const ZOOM_MIN  = 10;   // minimum cell size in px
export const ZOOM_MAX  = 35;   // maximum cell size in px
export const ZOOM_STEP = 5;

// ─── Animation speed ─────────────────────────────────────────────────────────
export const DEFAULT_SPEED = 100;   // px / second
export const SPEED_MIN     = 30;
export const SPEED_MAX     = 250;
export const SPEED_STEP    = 35;

// ─── Maze element types ───────────────────────────────────────────────────────
/** All valid obstacle type strings, in render order. */
export const OBSTACLE_TYPES = /** @type {const} */ (['wall', 'permeable', 'begin', 'end']);

// ─── Colors ───────────────────────────────────────────────────────────────────
export const COLORS = {
  grid:         '#DDDDDD',
  wall:         '#FF0000',
  permeable:    '#0000FF',
  begin:        '#005500',
  end:          '#00DD00',
  route:        '#00FF00',
  routeLast:    '#006600',
  solution:     '#FFA613',
  player:       'green',
  playerStroke: '#FFA613',
  endMarker:    '#FFA613',
};

// ─── Player status values ─────────────────────────────────────────────────────
export const STATUS = {
  STOPPED:      'stopped',
  MOVING:       'moving',
  DRAWING:      'drawing',
  START_CUSTOM: 'startCustom',
};

