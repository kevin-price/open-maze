/**
 * mazeIO.js
 * Loading and saving maze files (.maze XML format).
 *
 * File format (unchanged from v1 for full compatibility):
 *   <maze>
 *     <size><X_GRIDS>…</X_GRIDS><Y_GRIDS>…</Y_GRIDS><DefaultSpacing>…</DefaultSpacing></size>
 *     <obstacle><type>…</type><orient>…</orient><x>…</x><y>…</y></obstacle>
 *     …
 *   </maze>
 */

import { state }                      from './state.js';
import { generateObstacleGrid, findBegin } from './creator.js';
import { mapMaze }                    from './solver.js';
import { drawGrid, drawCurrentPosition } from './renderer.js';
import { copyArray }                  from './utils.js';
import { saveBlob }                   from './utils.js';
import { enterPlayMode, showMazeSelectUI, showSaveUI, showLoadUI } from './ui.js';
import { tutorialHandler }            from './tutorial.js';
import { findSpotInAutosolve }        from './solver.js';

// ─── XML parser ───────────────────────────────────────────────────────────────

/**
 * Parses a .maze XML string, populates state, and redraws the canvas.
 * Also runs mapMaze() so autoSolve() is immediately available.
 *
 * @param {string} xmlText  Raw XML content of a .maze file.
 */
export function processFile(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, 'text/xml');

  const getText = (tag, parent = xml) =>
    parent.getElementsByTagName(tag)[0]?.firstChild?.nodeValue ?? '';

  state.xGrids   = parseInt(getText('X_GRIDS'),       10);
  state.yGrids   = parseInt(getText('Y_GRIDS'),       10);
  state.interval = parseInt(getText('DefaultSpacing'), 10);

  // Reload obstacles
  state.obstacles = [];
  state.route     = [];

  let skipped = false;
  const xmlObs = xml.getElementsByTagName('obstacle');
  for (const el of xmlObs) {
    const obs = {
      type:   getText('type',   el),
      orient: getText('orient', el),
      x:      parseInt(getText('x', el), 10),
      y:      parseInt(getText('y', el), 10),
    };
    if (obs.x > state.xGrids || obs.y > state.yGrids) {
      skipped = true;
    } else {
      state.obstacles.push(obs);
    }
  }

  generateObstacleGrid();

  if (skipped) {
    alert(
      'Some obstacles in this file lie outside the declared grid boundaries and were skipped.\n' +
      'To clean up: save the maze again — those obstacles will be omitted.',
    );
  }

  drawGrid();

  // Place the player at the beginning
  const beginIdx = findBegin();
  if (beginIdx === -1) {
    alert(
      'This maze has no starting point.\n' +
      'Open the Maze Creator and add a "Beginning" marker.',
    );
    return;
  }

  const beginObs  = state.obstacles[beginIdx];
  const startSpot = [beginObs.x, beginObs.y - 0.5, 'up', 'stopped'];

  state.beginning = copyArray(startSpot);
  state.spot      = copyArray(startSpot);
  if (state.tutorial) state.beginning[3] = 'tutorial';

  state.route.push({ spot: copyArray(state.beginning), obstacle: beginIdx });
  state.turns = { upkey: 'forward' };

  drawCurrentPosition();
  mapMaze();

  // Load any pre-solved routes embedded in the file
  state.solvedRoutes      = [];
  state.solvedRouteIndices = [];
  const xmlRoutes = xml.getElementsByTagName('route');
  for (const routeEl of xmlRoutes) {
    const spots     = routeEl.getElementsByTagName('spot');
    const solvedRoute = [];
    const solvedIndex = [];
    for (const sp of spots) {
      const s = [
        parseInt(getText('x', sp), 10),
        parseInt(getText('y', sp), 10),
        getText('dir', sp),
      ];
      solvedRoute.push(s);
      const idx = findSpotInAutosolve(s, state.mazeMap);
      if (idx !== -1) solvedIndex.push(idx);
    }
    state.solvedRoutes.push(solvedRoute);
    state.solvedRouteIndices.push(solvedIndex);
  }

  // Always set up the play-mode action bar first so "Begin Maze" is available.
  // tutorialHandler() then overlays the tutorial panel content on top.
  enterPlayMode(true);
  if (state.tutorial) tutorialHandler();
}

// ─── Built-in mazes ───────────────────────────────────────────────────────────

/**
 * Fetches and loads a maze file from the mazes/ directory by filename.
 * @param {string} filename  e.g. 'easy1.maze', 'challenging2.maze'
 * @returns {Promise<void>}
 */
export async function loadMazeFile(filename) {
  try {
    const res  = await fetch(`mazes/${filename}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    state.currentFile = filename;
    processFile(text);
  } catch (err) {
    alert(`Could not load maze "${filename}": ${err.message}`);
  }
}

/**
 * Fetches and loads the tutorial maze (mazes/tutorial.maze).
 */
export async function tutorialFile() {
  try {
    const res  = await fetch('mazes/tutorial.maze');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    processFile(text);
  } catch (err) {
    alert(`Could not load the tutorial maze: ${err.message}`);
  }
}

// ─── Load from user file ──────────────────────────────────────────────────────

/**
 * Opens a file-picker dialog and loads the chosen .maze file.
 * Called by the UI's "Load from File" action.
 */
export function loadMaze() {
  showLoadUI();
}

/**
 * Handles the <input type="file"> change event.
 * @param {Event} event
 */
export function handleFileInput(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload  = e => processFile(e.target.result);
  reader.onerror = e => alert('File could not be read. Code: ' + e.target.error.code);
  reader.readAsText(file);
}

// ─── Sample maze menu ─────────────────────────────────────────────────────────

/**
 * Shows the maze-selection menu.
 * @param {boolean} [force=true]  When false, skips the endTutorial step.
 */
export function loadSample(force = true) {
  if (state.tutorial && force) {
    // Imported lazily to avoid a top-level circular dep with tutorial.js
    import('./tutorial.js').then(m => m.endTutorial());
    return;
  }
  showMazeSelectUI();
}

// ─── Save ────────────────────────────────────────────────────────────────────

/**
 * Shows the save-filename prompt.
 */
export function saveMaze() {
  showSaveUI();
}

/**
 * Serialises the current maze to XML and triggers a download.
 * @param {string} filename  Base name (without .maze extension).
 */
export function outputFile(filename) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<maze>',
    `  <size><X_GRIDS>${state.xGrids}</X_GRIDS><Y_GRIDS>${state.yGrids}</Y_GRIDS><DefaultSpacing>${state.interval}</DefaultSpacing></size>`,
  ];

  for (const obs of state.obstacles) {
    lines.push(
      `  <obstacle><type>${obs.type}</type><orient>${obs.orient}</orient>` +
      `<x>${obs.x}</x><y>${obs.y}</y></obstacle>`,
    );
  }

  lines.push('</maze>');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
  saveBlob(blob, filename.endsWith('.maze') ? filename : `${filename}.maze`);
}
