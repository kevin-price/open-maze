/**
 * main.js
 * Entry point — wires up the page once the DOM is ready.
 */

import { state }               from './state.js';
import { drawGrid }            from './renderer.js';
import { loadMazeFile }        from './mazeIO.js';
import { openTutorial }        from './tutorial.js';
import { initScrollbars }      from './scrollbars.js';
import {
  wireNavButtons,
  handleKeyDown,
  handleCanvasClick,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  showMazeSelectUI,
  MAZE_CATALOG,
} from './ui.js';

// ─── Initialisation ───────────────────────────────────────────────────────────

function init() {
  // Draw the empty grid immediately
  drawGrid();

  // Wire persistent nav buttons
  wireNavButtons();

  // Custom scrollbars (touch-friendly, since canvas consumes all touch events)
  initScrollbars();

  // Keyboard input
  document.addEventListener('keydown', handleKeyDown);

  // Canvas: mouse clicks
  const canvas = document.getElementById('canvas');
  canvas.addEventListener('click', handleCanvasClick);

  // Canvas: touch (swipe to choose direction, tap to stop, pinch to zoom)
  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchmove',  handleTouchMove,  { passive: false });
  canvas.addEventListener('touchend',   handleTouchEnd,   { passive: false });

  // Read URL query parameters
  const params   = new URLSearchParams(window.location.search);
  const tutorial = params.get('tutorial');
  const maze     = params.get('maze');

  const allMazes = [...MAZE_CATALOG.easy, ...MAZE_CATALOG.challenging];
  const catalogMaze = maze && allMazes.find(m => m.file === maze);

  if (tutorial !== null) {
    openTutorial();
  } else if (catalogMaze) {
    loadMazeFile(catalogMaze.file);
  } else {
    // Default: load Easy Maze 1 and show the maze-select menu
    loadMazeFile('easy1.maze').then(() => showMazeSelectUI());
  }
}

// Run after the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
