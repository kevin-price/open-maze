/**
 * tutorial.js
 * In-game tutorial that walks the player through the maze mechanics.
 *
 * The tutorial is keyed to specific grid positions in tutorial.maze.
 * Each page is shown when the player reaches the corresponding position.
 */

import { state }    from './state.js';
import { loadMazeFile, tutorialFile } from './mazeIO.js';

// ─── Tutorial lifecycle ───────────────────────────────────────────────────────

/**
 * Activates tutorial mode and loads the tutorial maze (mazes/tutorial.maze).
 */
export function openTutorial() {
  state.tutorial = true;
  // tutorialFile is async; tutorialHandler() will be called inside processFile
  // once the maze data is loaded and state.spot is set correctly.
  tutorialFile();
}

/**
 * Deactivates tutorial mode, clears the tutorial panel, and loads Sample 1.
 */
export function endTutorial() {
  state.tutorial = false;
  const panel = document.getElementById('tutorial-panel');
  if (panel) {
    panel.hidden  = true;
    panel.innerHTML = '';
  }

  // Load Easy Maze 1, then show the maze-select menu so the user can choose.
  // The .then() fires after processFile finishes, ensuring the action bar
  // is not overwritten by enterPlayMode() inside loadMazeFile().
  loadMazeFile('easy1.maze').then(() => {
    import('./ui.js').then(({ showMazeSelectUI }) => showMazeSelectUI());
  });
}

// ─── Tutorial dispatcher ──────────────────────────────────────────────────────

/**
 * Checks the player's current position and shows the appropriate tutorial page.
 * Called after each stop.
 */
export function tutorialHandler() {
  if (!state.tutorial) return;

  const panel = document.getElementById('tutorial-panel');
  if (!panel) return;

  panel.hidden = false;
  panel.innerHTML = '';

  const content = document.createElement('div');
  content.id = 'tutorial-content';

  const skipBtn = document.createElement('button');
  skipBtn.textContent = 'Skip / End Tutorial';
  skipBtn.className = 'tutorial-skip btn btn--danger';
  skipBtn.addEventListener('click', endTutorial);
  content.appendChild(skipBtn);
  panel.appendChild(content);

  const [x, y] = state.spot;

  if      (x === 4  && y === 8.5) pageOne();
  else if (x === 4  && y === 1)   pageTwo();
  else if (x === 7  && y === 1)   pageThree();
  else if (x === 8  && y === 6)   pageFour();
  else if (x === 10 && y === 6)   pageFive();
  else if (x === 8  && y === 3)   pageSix();
  else if (x === 8  && y === 8)   pageSeven();
  else if (
    (x === 8  && y === 2) ||
    (x === 10 && y === 2) ||
    (x === -1 && y === 2)
  ) pageBacktrack();
}

// ─── Tutorial pages ───────────────────────────────────────────────────────────

function append(html) {
  document.getElementById('tutorial-content').insertAdjacentHTML('beforeend', html);
}

function pageOne() {
  append(`
    <h2>Welcome to Open Maze!</h2>
    <p>This maze works differently from most. Instead of following a corridor,
    you travel in a straight line along the grid until you hit a <strong>barrier</strong>.
    The barrier tells you which turns are available.</p>

    <p>The <strong>dark green</strong> marker shows where you start; the
    <strong>light green</strong> marker is the goal. There may be multiple goals.</p>

    <div class="tutorial-action">
      <h3>📌 Action</h3>
      <p>Click <strong>Show Start/End</strong> in the nav to highlight the start and
      end, then press <strong>Begin Maze</strong> or the <strong>↑ Up arrow</strong>
      to start moving.</p>
    </div>`);
}

function pageTwo() {
  append(`
    <h2>Your First Wall</h2>
    <p>You've hit a regular <strong>red wall</strong>. Coming from below, you can
    turn left or right — the wall blocks straight ahead.</p>
    <p>You can also use <strong>arrow keys</strong> instead of the on-screen buttons!</p>

    <div class="tutorial-action">
      <h3>📌 Action</h3>
      <p>Press <strong>Go Right</strong> or the <strong>→ Right arrow</strong>.
      (Choosing Left skips the dead-end demo on the next page.)</p>
    </div>`);
}

function pageThree() {
  append(`
    <h2>Dead End</h2>
    <p>You've hit a dead end! Both sides are walled off, so you can only
    <strong>turn around</strong> and retrace your path.</p>

    <div class="tutorial-action">
      <h3>📌 Action</h3>
      <p>Press <strong>Turn Around</strong> or the <strong>← Left arrow</strong>.</p>
    </div>`);
}

function pageFour() {
  append(`
    <img src="assets/07-forced-turn.png" width="65" height="65"
         style="float:left;margin:0 10px 5px 0" alt="Forced turn diagram">
    <h2>Forced Turns & Permeable Walls</h2>
    <p>You just passed through two <strong>forced turns</strong> — spots with only
    one available direction, so the maze continues automatically.</p>
    <p>Now you're at a <strong>blue permeable wall</strong>. Unlike a red wall, it
    gives you the extra option to <strong>pass straight through</strong> it.</p>

    <div class="tutorial-action">
      <h3>📌 Action</h3>
      <p>Pass through: press <strong>Move Forward</strong> or the
      <strong>→ Right arrow</strong>.</p>
      <p style="color:var(--color-danger)"><strong>If you've been here before,</strong>
      press <strong>↑ Up</strong> instead.</p>
    </div>`);
}

function pageFive() {
  append(`
    <h2>Off the Edge!</h2>
    <p>Oops — you went off the edge of the maze. You can backtrack to recover.</p>

    <div class="tutorial-action">
      <h3>📌 Action</h3>
      <p>Press <strong>Backtrack</strong> or the <strong>B</strong> key.
      When the page reappears, choose <strong>↑ Up</strong> to go up instead
      of passing through the wall.</p>
    </div>`);
}

function pageSix() {
  append(`
    <h2>Permeable Dead End</h2>
    <p>Another dead end — but this time the back wall is
    <strong>permeable (blue)</strong>, so you can either turn around or pass
    through. Passing through leads nowhere useful here.</p>

    <div class="tutorial-action">
      <h3>📌 Action</h3>
      <p>Turn around: press <strong>↓ Down arrow</strong>.</p>
    </div>`);
}

function pageSeven() {
  append(`
    <h2>Tutorial Complete!</h2>
    <p>You've seen all the core mechanics. A few more things to know:</p>
    <ul>
      <li>The <strong>Maze Creator</strong> lets you build and download your own mazes.</li>
      <li><strong>Other Mazes</strong> lets you load a saved .maze file or pick one
      of the built-in samples.</li>
      <li>The <strong>Solution</strong> button (shown when you're stopped at a
      choice) asks the computer to solve the maze from where you are.</li>
    </ul>

    <div class="tutorial-action">
      <h3>📌 Action</h3>
      <p>Press <strong>Skip / End Tutorial</strong> above. Sample 1 will load
      automatically so you can play right away.</p>
    </div>`);
}

function pageBacktrack() {
  append(`
    <h2>Dead End — Backtrack</h2>
    <p>The maze cannot be solved from this position.
    Press <strong>Backtrack</strong> or <strong>B</strong> to go back.</p>`);
}
