/**
 * ui.js
 * UI state machine: action bar, keyboard/touch input, zoom, speed, mode helpers.
 *
 * The action bar (#action-bar) is rebuilt each time the game mode changes.
 * createBtn() produces properly labelled <button> elements with event listeners,
 * avoiding the fragile innerHTML-with-onclick-strings pattern of v1.
 */

import { state }                from './state.js';
import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, SPEED_MIN, SPEED_MAX, SPEED_STEP } from './constants.js';
import { drawGrid, drawCurrentPosition, displayEnds } from './renderer.js';
import { generateObstacleGrid, applyGridSize, eraseMaze } from './creator.js';
import { mapMaze }              from './solver.js';
import { autoSolve }            from './solver.js';
import {
  resumeMaze, startMaze, stopMaze, stopHandler, checkObstacles, scrollToPlayer,
} from './movement.js';
import {
  applyTurnRight, applyTurnLeft, applyTurnBackward, applyMoveForward, backTrack,
} from './actions.js';
import { loadMazeFile, loadSample, saveMaze, outputFile, handleFileInput } from './mazeIO.js';
import { openTutorial, endTutorial } from './tutorial.js';

// ─── Button factory ───────────────────────────────────────────────────────────

/**
 * Creates a styled <button> with a click handler.
 * @param {string}   label
 * @param {Function} onClick
 * @param {string}   [variant='default']  CSS modifier class suffix
 * @returns {HTMLButtonElement}
 */
function createBtn(label, onClick, variant = 'default') {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.className   = `btn btn--${variant}`;
  btn.addEventListener('click', onClick);
  return btn;
}

/** Creates a text-only label span */
function label(text) {
  const s = document.createElement('span');
  s.className = 'action-label';
  s.textContent = text;
  return s;
}

/** Creates a visual separator between button groups */
function sep() {
  const s = document.createElement('span');
  s.className = 'action-sep';
  s.setAttribute('aria-hidden', 'true');
  return s;
}

/**
 * Replaces the action bar content with the given elements.
 * @param {...(HTMLElement)} items
 */
function setActionBar(...items) {
  const bar = document.getElementById('action-bar');
  bar.innerHTML = '';
  for (const item of items) bar.appendChild(item);
}

// ─── Keyboard shortcut hint ───────────────────────────────────────────────────

/**
 * Updates the keyboard-hint strip below the action bar.
 * @param {string[]} hints  e.g. ['↑ Forward', '← Go Left', '→ Go Right', 'B Backtrack']
 */
function setKeyHints(...hints) {
  const strip = document.getElementById('key-hints');
  if (!strip) return;
  strip.innerHTML = hints.map(h => `<kbd>${h}</kbd>`).join('');
}

function clearKeyHints() {
  const strip = document.getElementById('key-hints');
  if (strip) strip.innerHTML = '';
}

// ─── UI state renderers ───────────────────────────────────────────────────────

/** Ready to start: no maze in progress yet. */
export function showMazeReadyUI() {
  const items = [
    createBtn('Begin Maze', startMaze, 'primary'),
  ];
  if (state.route.length > 1) {
    items.push(createBtn('Resume', resumeMaze));
  }
  items.push(sep());
  items.push(createBtn('Custom Start', () => enterCustomStart(), 'subtle'));
  setActionBar(...items);
  setKeyHints('↑ Begin Maze');
}

/** Player is currently moving. */
export function showMovingUI() {
  setActionBar(
    createBtn('Stop', stopMaze),
    createBtn('Backtrack', backTrack),
    sep(),
    createBtn('Speed +', speedUp),
    createBtn('Speed −', slowDown),
  );
  setKeyHints('Click canvas — Stop', 'B — Backtrack', '+ − Zoom');
}

/** Player stopped at an obstacle with multiple choices. */
export function showStoppedUI(directions) {
  const { spot } = state;
  const dir = spot[2];

  // Translate logical actions to compass labels relative to the player's view
  const compassLabel = {
    up:    { right: 'Go Right', left: 'Go Left' },
    down:  { right: 'Go Left',  left: 'Go Right' }, // swapped when facing down
    right: { right: 'Go Down',  left: 'Go Up'   },
    left:  { right: 'Go Up',    left: 'Go Down'  },
  }[dir] ?? {};

  const items = [createBtn('Backtrack', backTrack)];
  const hints = ['B — Backtrack'];

  if (directions.includes('left')) {
    const lbl = compassLabel.left ?? 'Go Left';
    items.push(createBtn(lbl, applyTurnLeft, 'primary'));
    hints.push(`← — ${lbl}`);
  }
  if (directions.includes('right')) {
    const lbl = compassLabel.right ?? 'Go Right';
    items.push(createBtn(lbl, applyTurnRight, 'primary'));
    hints.push(`→ — ${lbl}`);
  }
  if (directions.includes('backward')) {
    items.push(createBtn('Turn Around', applyTurnBackward, 'primary'));
    hints.push('↓ — Turn Around');
  }
  if (directions.includes('forward')) {
    items.push(createBtn('Move Forward', applyMoveForward, 'primary'));
    hints.push('↑ — Move Forward');
  }

  if (directions.length > 1) {
    items.push(sep());
    items.push(createBtn('Restart', startMaze, 'subtle'));
    items.push(createBtn('Custom Start', () => enterCustomStart(), 'subtle'));
    items.push(createBtn('Solution', () => {
      if (!autoSolve()) _showNoSolutionNotice();
    }, 'subtle'));
  }

  setActionBar(...items);
  setKeyHints(...hints);
}

/** Player is paused mid-maze. */
export function showPausedUI() {
  setActionBar(
    createBtn('Resume', resumeMaze, 'primary'),
    createBtn('Backtrack', backTrack),
    sep(),
    createBtn('Restart', startMaze, 'subtle'),
    createBtn('Custom Start', () => enterCustomStart(), 'subtle'),
    sep(),
    createBtn('Speed +', speedUp),
    createBtn('Speed −', slowDown),
  );
  setKeyHints('B — Backtrack');
}

/** Player went off the edge. */
export function showOffEdgeUI() {
  setActionBar(
    label('⚠️ You went off the edge!'),
    sep(),
    createBtn('Backtrack', backTrack, 'primary'),
    createBtn('Restart', startMaze, 'subtle'),
  );
  clearKeyHints();
}

/** Player reached the end. */
export function showVictoryUI() {
  setActionBar(
    label('🎉 You solved it!'),
    sep(),
    createBtn('Play Again', startMaze, 'primary'),
    createBtn('Other Mazes', () => showMazeSelectUI()),
  );
  clearKeyHints();
}

// ─── Maze catalog ─────────────────────────────────────────────────────────────

/**
 * Config-driven catalog of built-in mazes.
 * Add entries here to extend the dropdowns — no other code changes required.
 */
const MAZE_CATALOG = {
  easy: [
    { label: 'Easy Maze 1', file: 'easy1.maze' },
    { label: 'Easy Maze 2', file: 'easy2.maze' },
    { label: 'Easy Maze 3', file: 'easy3.maze' },
  ],
  challenging: [
    { label: 'Challenging Maze 1', file: 'challenging1.maze' },
    { label: 'Challenging Maze 2', file: 'challenging2.maze' },
  ],
};

/**
 * Builds a <select> dropdown for a group of mazes.
 * Selecting an option immediately loads that maze file.
 *
 * @param {string} groupLabel  Header text shown as the disabled placeholder option.
 * @param {{ label: string, file: string }[]} mazes
 * @returns {HTMLSelectElement}
 */
function createMazeSelect(groupLabel, mazes) {
  const sel = document.createElement('select');
  sel.className = 'action-select';

  const placeholder = document.createElement('option');
  placeholder.value       = '';
  placeholder.textContent = `── ${groupLabel} ──`;
  placeholder.disabled    = true;
  placeholder.selected    = true;
  sel.appendChild(placeholder);

  for (const { label: lbl, file } of mazes) {
    const opt = document.createElement('option');
    opt.value       = file;
    opt.textContent = lbl;
    sel.appendChild(opt);
  }

  sel.addEventListener('change', () => {
    if (sel.value) loadMazeFile(sel.value);
  });

  return sel;
}

/** Sample maze chooser. */
export function showMazeSelectUI() {
  setActionBar(
    label('Load maze:'),
    createMazeSelect('Easy',        MAZE_CATALOG.easy),
    createMazeSelect('Challenging', MAZE_CATALOG.challenging),
    sep(),
    createBtn('Load from File', () => showLoadUI()),
    createBtn('Cancel', () => enterPlayMode(true), 'subtle'),
  );
  clearKeyHints();
}

/** Maze creator toolbar. */
export function showCreatorUI() {
  // Draw-type buttons with active state
  const drawBtn = (lbl, type) => {
    const b = createBtn(lbl, () => { state.obstacleType = type; updateCreatorActive(); });
    b.dataset.drawType = type;
    return b;
  };

  setActionBar(
    createBtn('Grid Size', showGridSizeUI),
    createBtn('Erase All', eraseMaze, 'danger'),
    createBtn('Save Maze', saveMaze),
    sep(),
    label('Draw:'),
    drawBtn('Wall',       'wall'),
    drawBtn('Permeable',  'permeable'),
    drawBtn('Beginning',  'begin'),
    drawBtn('End',        'end'),
    sep(),
    createBtn('Done', () => enterPlayMode(false)),
  );
  updateCreatorActive();
  clearKeyHints();
}

function updateCreatorActive() {
  document.querySelectorAll('[data-draw-type]').forEach(btn => {
    btn.classList.toggle('btn--active', btn.dataset.drawType === state.obstacleType);
  });
}

/** Grid-size input prompt. */
export function showGridSizeUI() {
  const bar = document.getElementById('action-bar');
  bar.innerHTML = `
    <span class="action-label">Horizontal cells (10–200):</span>
    <input type="number" id="input-hgrid" class="action-input" min="10" max="200" value="${state.xGrids}">
    <span class="action-label" style="margin-left:12px">Vertical:</span>
    <input type="number" id="input-vgrid" class="action-input" min="10" max="200" value="${state.yGrids}">
  `;
  const ok = createBtn('OK', () => {
    const h = parseInt(document.getElementById('input-hgrid').value, 10);
    const v = parseInt(document.getElementById('input-vgrid').value, 10);
    if (!applyGridSize(h, v)) {
      alert('Please enter values between 10 and 200 for both dimensions.');
      return;
    }
    showCreatorUI();
  }, 'primary');
  const cancel = createBtn('Cancel', showCreatorUI, 'subtle');
  bar.appendChild(ok);
  bar.appendChild(cancel);
}

/** Zoom controls. */
export function showZoomUI() {
  setActionBar(
    createBtn('Zoom In',  zoomIn),
    createBtn('Zoom Out', zoomOut),
    createBtn('Done', () => enterPlayMode(true), 'subtle'),
    label('(or use + / − keys)'),
  );
  clearKeyHints();
}

/** File-open prompt. */
export function showLoadUI() {
  const bar = document.getElementById('action-bar');
  bar.innerHTML = `<span class="action-label">Load .maze file:</span>`;
  const fileInput = document.createElement('input');
  fileInput.type   = 'file';
  fileInput.accept = '.maze';
  fileInput.className = 'action-input';
  fileInput.addEventListener('change', handleFileInput);
  const cancel = createBtn('Cancel', () => enterPlayMode(true), 'subtle');
  bar.appendChild(fileInput);
  bar.appendChild(cancel);
}

/** Filename prompt for saving. */
export function showSaveUI() {
  const bar = document.getElementById('action-bar');
  bar.innerHTML = `<span class="action-label">Save as:</span>`;
  const input = document.createElement('input');
  input.type      = 'text';
  input.id        = 'save-filename';
  input.className = 'action-input';
  input.placeholder = 'my-maze';
  const ok     = createBtn('Save', () => {
    const name = document.getElementById('save-filename').value.trim() || 'my-maze';
    outputFile(name);
    showCreatorUI();
  }, 'primary');
  const cancel = createBtn('Cancel', showCreatorUI, 'subtle');
  bar.appendChild(input);
  bar.appendChild(ok);
  bar.appendChild(cancel);
}

// ─── Mode entry points ────────────────────────────────────────────────────────

/**
 * Enters "play" mode. If the maze was recently changed in the creator,
 * quick=false triggers a full re-map.
 * @param {boolean} quick
 */
export function enterPlayMode(quick = false) {
  if (state.spot[3] !== 'drawing') quick = true;

  if (state.obstacles.length > 10 && !quick) {
    generateObstacleGrid();
    mapMaze();
    state.solvedRouteIndices = [];
    state.solvedRoutes       = [];
  }

  state.spot[3] = 'stopped';
  showMazeReadyUI();
}

/** Enters creator mode. */
export function enterCreatorMode() {
  state.route = [];
  drawGrid();
  state.spot[3] = 'drawing';
  showCreatorUI();
}

// ─── Custom start ─────────────────────────────────────────────────────────────

/**
 * Begins the three-step "custom start" flow:
 *  1. Prompt the user to click the canvas.
 *  2. Ask which direction to start facing.
 *  3. Start the maze from that position.
 */
export function enterCustomStart() {
  state.spot[3] = 'startCustom';
  setActionBar(label('Click anywhere on the maze to set your starting position.'));
  clearKeyHints();
}

/** Called by the canvas click/tap handler when in startCustom mode. */
export function handleCustomStartClick(gridX, gridY) {
  state.customSpot = [gridX, gridY];

  setActionBar(
    label('Starting direction:'),
    createBtn('Up',    () => _applyCustomStart('up'),    'primary'),
    createBtn('Down',  () => _applyCustomStart('down'),  'primary'),
    createBtn('Left',  () => _applyCustomStart('left'),  'primary'),
    createBtn('Right', () => _applyCustomStart('right'), 'primary'),
    createBtn('Cancel', () => enterPlayMode(true), 'subtle'),
  );
  setKeyHints('↑ Up', '↓ Down', '← Left', '→ Right');
}

function _applyCustomStart(direction) {
  state.spot[0] = state.customSpot[0];
  state.spot[1] = state.customSpot[1];
  state.spot[2] = direction;
  state.route   = [];
  drawGrid();
  state.route.push({ spot: [...state.spot], obstacle: -1 });
  resumeMaze();
}

// ─── No-solution notice ───────────────────────────────────────────────────────

/**
 * Appends a temporary "no solution" notice to the action bar.
 * Auto-removes after 4 seconds without disturbing the existing buttons.
 */
function _showNoSolutionNotice() {
  const bar = document.getElementById('action-bar');
  if (!bar) return;
  // Remove any stale notice first
  bar.querySelector('.no-solution-notice')?.remove();

  const notice = document.createElement('span');
  notice.className = 'no-solution-notice';
  notice.textContent = '⚠️ No solution from this position — try backtracking.';
  bar.appendChild(notice);

  setTimeout(() => notice.remove(), 4000);
}

// ─── Zoom ────────────────────────────────────────────────────────────────────

export function zoomIn() {
  if (state.interval < ZOOM_MAX) {
    state.interval += ZOOM_STEP;
    drawGrid();
    drawCurrentPosition();
    scrollToPlayer();
  }
}

export function zoomOut() {
  if (state.interval > ZOOM_MIN) {
    state.interval -= ZOOM_STEP;
    drawGrid();
    drawCurrentPosition();
    scrollToPlayer();
  }
}

// ─── Speed ───────────────────────────────────────────────────────────────────

export function speedUp() {
  if (state.speed < SPEED_MAX) state.speed += SPEED_STEP;
}

export function slowDown() {
  if (state.speed > SPEED_MIN) state.speed -= SPEED_STEP;
}

// ─── Keyboard handler ─────────────────────────────────────────────────────────

/**
 * Executes the action mapped to a game direction ('forward','backward','left','right').
 * @param {string} action
 */
function dispatchAction(action) {
  switch (action) {
    case 'forward':  applyMoveForward();   break;
    case 'backward': applyTurnBackward(); break;
    case 'right':    applyTurnRight();    break;
    case 'left':     applyTurnLeft();     break;
  }
}

/**
 * Global keydown handler. Wired up in main.js.
 * @param {KeyboardEvent} e
 */
export function handleKeyDown(e) {
  // Zoom shortcuts (+/−)
  if (e.key === '+' || (e.shiftKey && e.key === '=')) { zoomIn();  return; }
  if (e.key === '-' || e.key === '_')                  { zoomOut(); return; }

  // Backtrack
  if (e.key === 'b' || e.key === 'B' || e.key === 'Backspace') {
    backTrack();
    return;
  }

  // Custom start: arrow keys select direction
  if (state.spot[3] === 'startCustom' && state.customSpot.length) {
    const dirs = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const dir  = dirs[e.key];
    if (dir) { _applyCustomStart(dir); return; }
  }

  // In-game navigation — only when not drawing
  if (state.spot[3] === 'drawing') return;

  const keyMap = {
    ArrowUp:    'upkey',
    ArrowDown:  'downkey',
    ArrowLeft:  'leftkey',
    ArrowRight: 'rightkey',
  };
  const key    = keyMap[e.key];
  const action = key && state.turns[key];
  if (action) dispatchAction(action);
}

// ─── Touch / swipe + pinch-to-zoom handler ───────────────────────────────────

let _touchStart = null;   // single-finger swipe origin
let _pinchStart = null;   // { dist, interval } captured when 2nd finger lands

function _pinchDist(e) {
  const a = e.touches[0], b = e.touches[1];
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

/**
 * Handles touchstart on the canvas. Call from main.js.
 * @param {TouchEvent} e
 */
export function handleTouchStart(e) {
  if (e.touches.length >= 2) {
    // Second finger down — start a pinch, cancel any pending swipe
    _touchStart = null;
    _pinchStart = { dist: _pinchDist(e), interval: state.interval };
    e.preventDefault();
    return;
  }
  const t = e.changedTouches[0];
  _touchStart = { x: t.clientX, y: t.clientY };
}

/**
 * Handles touchmove on the canvas for pinch-to-zoom. Call from main.js.
 * @param {TouchEvent} e
 */
export function handleTouchMove(e) {
  if (!_pinchStart || e.touches.length < 2) return;
  e.preventDefault();

  const scale       = _pinchDist(e) / _pinchStart.dist;
  const newInterval = Math.round(_pinchStart.interval * scale);
  const clamped     = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newInterval));

  if (clamped !== state.interval) {
    state.interval = clamped;
    drawGrid();
    drawCurrentPosition();
    scrollToPlayer();
  }
}

/**
 * Handles touchend on the canvas. Call from main.js.
 * @param {TouchEvent} e
 */
export function handleTouchEnd(e) {
  // Pinch ending — wait until both fingers are up before resetting
  if (_pinchStart) {
    if (e.touches.length < 2) {
      _pinchStart = null;
      _touchStart = null; // prevent a ghost swipe after pinch
    }
    return;
  }

  if (!_touchStart) return;
  const t  = e.changedTouches[0];
  const dx = t.clientX - _touchStart.x;
  const dy = t.clientY - _touchStart.y;
  _touchStart = null;

  const dist = Math.hypot(dx, dy);

  if (dist < 12) {
    // Treat as a tap
    _handleCanvasTap(e);
    return;
  }

  // Swipe — determine direction
  const horizontal = Math.abs(dx) > Math.abs(dy);
  let swipeDir;
  if (horizontal) swipeDir = dx > 0 ? 'rightkey' : 'leftkey';
  else            swipeDir = dy > 0 ? 'downkey'  : 'upkey';

  const action = state.turns[swipeDir];
  if (action) dispatchAction(action);
}

function _handleCanvasTap(e) {
  if (state.spot[3] === 'moving') {
    e.preventDefault(); // suppress the synthetic click that follows a touch tap
    stopMaze();
    return;
  }
  if (state.spot[3] === 'paused') {
    e.preventDefault(); // suppress the synthetic click that follows a touch tap
    resumeMaze();
    return;
  }
  if (state.spot[3] === 'startCustom') {
    const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('canvas'));
    const rect   = canvas.getBoundingClientRect();
    const t      = e.changedTouches[0];
    const px     = Math.round(t.clientX - rect.left);
    const py     = Math.round(t.clientY - rect.top);
    const iv     = state.interval;
    const gridX  = Math.floor(px / iv);
    const gridY  = Math.floor(py / iv);
    handleCustomStartClick(gridX, gridY);
  }
}

// ─── Canvas click handler ─────────────────────────────────────────────────────

/**
 * Handles mouse clicks on the canvas. Wired up in main.js.
 * @param {MouseEvent} e
 */
export function handleCanvasClick(e) {
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('canvas'));
  const rect   = canvas.getBoundingClientRect();
  const px     = Math.round(e.clientX - rect.left);
  const py     = Math.round(e.clientY - rect.top);

  switch (state.spot[3]) {
    case 'moving':
      stopMaze();
      break;
    case 'drawing': {
      import('./creator.js').then(({ setLine }) => setLine(px, py));
      break;
    }
    case 'startCustom': {
      const iv    = state.interval;
      const gridX = Math.floor(px / iv);
      const gridY = Math.floor(py / iv);
      handleCustomStartClick(gridX, gridY);
      break;
    }
    default:
      // Clicking the canvas while stopped does nothing — use the Custom Start button.
      break;
  }
}

// ─── Nav bar button wiring ────────────────────────────────────────────────────

/**
 * Wires all persistent navigation buttons (called once from main.js).
 */
export function wireNavButtons() {
  const wire = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  };

  wire('nav-tutorial', openTutorial);
  wire('nav-mazes',    () => showMazeSelectUI());
  wire('nav-creator',  enterCreatorMode);
  wire('nav-ends',     () => {
    displayEnds();
    // Show ends for 1.5 s then redraw
    setTimeout(() => { drawGrid(); drawCurrentPosition(); }, 1500);
  });
  wire('nav-zoom',     showZoomUI);
}
