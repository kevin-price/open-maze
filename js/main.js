/**
 * main.js
 * Entry point — wires up the page once the DOM is ready.
 */

import { state }               from './state.js';
import { loadMazeFile, loadDefaultMazeSync } from './mazeIO.js';
import { openTutorial }        from './tutorial.js';
import { initScrollbars }      from './scrollbars.js';
import {
  wireNavButtons,
  handleKeyDown,
  handleCanvasClick,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  handleWheelZoom,
  showMazeSelectUI,
  MAZE_CATALOG,
} from './ui.js';

// ─── Initialisation ───────────────────────────────────────────────────────────

function init() {
  // NOTE: Removed initial drawGrid() here. loadDefaultMazeSync() or loadMazeFile() 
  // will draw the grid immediately with the correct final dimensions, avoiding a layout shift.

  // Wire persistent nav buttons
  wireNavButtons();

  // Custom scrollbars (touch-friendly, since canvas consumes all touch events)
  initScrollbars();

  // Keyboard input
  document.addEventListener('keydown', handleKeyDown);

  // Canvas: mouse clicks
  const canvas = document.getElementById('canvas');
  canvas.addEventListener('click', handleCanvasClick);

  // Area around the canvas: touch events
  const touchTarget = document.querySelector('.maze-wrap');
  touchTarget.addEventListener('touchstart', handleTouchStart, { passive: false });
  touchTarget.addEventListener('touchmove',  handleTouchMove,  { passive: false });
  touchTarget.addEventListener('touchend',   handleTouchEnd,   { passive: false });

  // Trackpad pinch-to-zoom (Wheel event with ctrlKey)
  touchTarget.addEventListener('wheel', handleWheelZoom, { passive: false });

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
    // Default: load on the next animation frame to prevent any layout jank
	// Load Easy Maze 1 synchronously
    requestAnimationFrame(() => {
      loadDefaultMazeSync();
      //showMazeSelectUI();  // (don't) show the maze-select menu immediately
    });
  }
}

// Run after the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}