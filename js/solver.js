/**
 * solver.js
 * Maze mapping and automatic solving.
 *
 * PHASE 1 — mapMaze()
 *   Does a depth-first traversal of the entire maze from the beginning,
 *   building a graph of every decision point (obstacle stop + available choices).
 *   Result stored in state.mazeMap.
 *
 * PHASE 2 — autoSolve()
 *   Runs BFS from the player's current node to find the shortest path
 *   (fewest stops) to every reachable end obstacle.  BFS guarantees that
 *   re-pressing Solution from any intermediate node on the optimal route
 *   always shows the remaining portion of that same route.
 */

import { state }                  from './state.js';
import { copyArray, arraysEqual } from './utils.js';
import { checkObstacles, obstacleDirections }   from './movement.js';
import {
  computeTurnRight,
  computeTurnLeft,
  computeTurnBackward,
  computeMoveForward,
} from './actions.js';
import { drawGrid, drawCurrentPosition, drawSolution } from './renderer.js';

// ─── Route helpers ────────────────────────────────────────────────────────────

/**
 * Saves the current route as a completed solved route.
 * Called when the player reaches an 'end' obstacle.
 */
export function addRouteToSolved() {
  const solvedRoute = state.route.slice(1).map(entry => entry.spot.slice(0, 3));
  const solvedIndex = solvedRoute
    .map(spot => findSpotInAutosolve(spot, state.mazeMap))
    .filter(idx => idx !== -1);

  state.solvedRoutes.push(solvedRoute);
  state.solvedRouteIndices.push(solvedIndex);
}

// ─── Graph search helpers ─────────────────────────────────────────────────────

/**
 * Returns the index of an entry in `map` whose obstacleSpot matches `location`,
 * or -1 if not found.
 *
 * When `obstacleNum` is provided the search is optimised: only entries that
 * hit the same obstacle are compared by position, skipping most entries.
 *
 * @param {number[]}  location     [x, y, dir]
 * @param {object[]}  map          The mazeMap / checkedlist array
 * @param {number}    [obstacleNum]
 * @returns {number}
 */
export function findSpotInAutosolve(location, map, obstacleNum) {
  for (let i = 0; i < map.length; i++) {
    const entry = map[i];
    if (!entry.hasOwnProperty('obstacleSpot')) continue;

    if (obstacleNum !== undefined) {
      // Fast path: filter by obstacle index first
      if (entry.obstacle !== obstacleNum) continue;
      if (!entry.hasOwnProperty('obstacleSpot')) continue;
    }

    if (arraysEqual(location, entry.obstacleSpot)) return i;
  }
  return -1;
}

// ─── Phase 1: maze mapping ────────────────────────────────────────────────────

/**
 * Examines a single position in the maze and returns a decision-point object
 * describing the obstacle hit, available directions, and next positions.
 *
 * @param {number[]} mazeLocation  [x, y, dir]
 * @param {object[]} checkedlist   All previously mapped decision points
 * @param {number}   prevIndex     Index of the calling entry, or -1
 * @returns {object} mazeDecision
 */
function mapSpotChecker(mazeLocation, checkedlist, prevIndex) {
  const decision = {
    firstSpot:     mazeLocation,
    previousIndex: prevIndex,
    links:         [],
  };

  const { obstacle } = checkObstacles(mazeLocation);
  decision.obstacle  = obstacle;

  if (obstacle === -1) {
    decision.notes = 'edge';
    return decision;
  }

  // Compute the position where the player will sit when touching this obstacle
  const obs = state.obstacles[obstacle];
  let obsSpot;
  switch (mazeLocation[2]) {
    case 'up':    obsSpot = [obs.x,     obs.y,     'up'];    break;
    case 'down':  obsSpot = [obs.x,     obs.y - 1, 'down'];  break;
    case 'right': obsSpot = [obs.x - 1, obs.y,     'right']; break;
    case 'left':  obsSpot = [obs.x,     obs.y,     'left'];  break;
  }
  decision.obstacleSpot = obsSpot;

  if (obs.type === 'end') {
    decision.notes = 'end';
    return decision;
  }

  // Loop detection — have we been here before?
  const loopIdx = findSpotInAutosolve(obsSpot, checkedlist, obstacle);
  if (loopIdx !== -1) {
    decision.notes = 'link';
    decision.links = [loopIdx];
    return decision;
  }

  // Build the set of next positions (one per available direction)
  const directions = obstacleDirections(obstacle, obsSpot);
  decision.directions = directions;
  decision.choices    = directions.map(action => {
    let next = copyArray(obsSpot);
    switch (action) {
      case 'right':    next[2] = computeTurnRight(obsSpot[2]);    break;
      case 'left':     next[2] = computeTurnLeft(obsSpot[2]);     break;
      case 'backward': next[2] = computeTurnBackward(obsSpot[2]); break;
      case 'forward':  next    = computeMoveForward(next);        break;
    }
    // Nudge slightly forward so the next obstacle check doesn't immediately
    // re-trigger on the current permeable wall
    switch (next[2]) {
      case 'up':    next[1] -= 0.1; break;
      case 'down':  next[1] += 0.1; break;
      case 'right': next[0] += 0.1; break;
      case 'left':  next[0] -= 0.1; break;
    }
    return next;
  });

  decision.notes = 'OK';
  return decision;
}

/**
 * Traverses the entire maze from state.beginning using depth-first search
 * and stores the resulting decision graph in state.mazeMap.
 *
 * The graph is required by autoSolve(). It is rebuilt automatically when
 * a maze is loaded or modified in the creator.
 */
export function mapMaze() {
  const LOOP_LIMIT = 2000;
  let spot = copyArray(state.beginning);

  const checkedlist  = [];
  let prevIndex      = -1;
  let currentIndex   = 0;
  let loopcount      = 0;
  let foundEnd       = false;
  let done           = false;

  while (!done) {
    loopcount++;

    const decision = mapSpotChecker(spot, checkedlist, prevIndex);
    checkedlist.push(decision);
    currentIndex = checkedlist.length - 1;

    if (prevIndex !== -1) {
      checkedlist[prevIndex].links.push(currentIndex);
    }

    if (decision.notes === 'end') foundEnd = true;

    const shouldBacktrack =
      decision.notes === 'end' ||
      decision.notes === 'edge' ||
      decision.links.length === 1;

    if (shouldBacktrack) {
      // Walk back up the graph to find an unexplored branch
      let numChoices   = 0;
      let branchTaken  = 0;
      currentIndex     = checkedlist.length - 1;

      while (currentIndex !== -1 && branchTaken === numChoices) {
        currentIndex = checkedlist[currentIndex].previousIndex;
        if (currentIndex !== -1) {
          numChoices  = checkedlist[currentIndex].choices?.length ?? 0;
          branchTaken = checkedlist[currentIndex].links.length;
        }
      }

      if (currentIndex === -1) {
        done = true;
      } else {
        spot = checkedlist[currentIndex].choices[branchTaken];
      }
    } else {
      spot = decision.choices[0];
    }

    if (loopcount >= LOOP_LIMIT) break;
    prevIndex = currentIndex;
  }

  if (loopcount >= LOOP_LIMIT) {
    console.warn('mapMaze: hit iteration limit — maze may be very large or contain a logic loop.');
    state.mazeMap = null;
  } else if (!foundEnd) {
    console.warn('mapMaze: no reachable end obstacle found.');
    state.mazeMap = null;
  } else {
    state.mazeMap = checkedlist;
  }
}

// ─── Phase 2: solving ─────────────────────────────────────────────────────────

/**
 * Finds the shortest solution(s) from the player's current position and
 * draws them in gold on the canvas.
 *
 * Uses breadth-first search (BFS), which guarantees the minimum number of
 * stops to reach each end obstacle.  A key property of BFS: if the optimal
 * path from A is A→B→C→end, then the optimal path from B is B→C→end —
 * the exact remaining portion.  So re-pressing Solution after following the
 * route partway always shows the same continuation, never a confusing detour.
 *
 * 'link' nodes (back-edges inserted by mapMaze for cycle detection) are
 * followed transparently to their real target before any visited-check.
 *
 * @param {number} [maxTurns]  If set, only the first N steps are drawn.
 * @returns {boolean}  true if at least one solution was found and drawn.
 */
export function autoSolve(maxTurns) {
  if (!state.mazeMap) {
    console.warn('autoSolve: mazeMap not built — load a maze first.');
    return false;
  }

  // ── Locate the player's current node in the graph ───────────────────────────
  // Special-case: player at the very beginning maps to index 0.
  const beginning = state.beginning;
  let startIndex;
  if (
    state.spot[0] === beginning[0] &&
    state.spot[1] === beginning[1] &&
    state.spot[2] === beginning[2]
  ) {
    startIndex = 0;
  } else {
    startIndex = findSpotInAutosolve(state.spot.slice(0, 3), state.mazeMap);
  }

  if (startIndex === -1) {
    console.warn('autoSolve: current position not found in mazeMap.');
    return false;
  }

  // ── BFS ─────────────────────────────────────────────────────────────────────
  // parent maps nodeIdx → parentIdx (null for the start node).
  // The first time BFS reaches any node is via the shortest path, so we
  // never need to update parent entries once set.
  const parent   = new Map([[startIndex, null]]);
  const queue    = [startIndex];
  const endPaths = [];   // one reconstructed path per reachable end node

  for (let qi = 0; qi < queue.length; qi++) {
    const idx  = queue[qi];
    const node = state.mazeMap[idx];

    // Reached an end — reconstruct the path and record it; don't expand further.
    if (node.notes === 'end') {
      const path = [];
      for (let cur = idx; cur !== null; cur = parent.get(cur)) {
        path.unshift(cur);
      }
      endPaths.push(path);
      continue;
    }

    // Expand all neighbours of this node.
    for (const rawLink of (node.links ?? [])) {
      // Follow 'link' (back-edge) nodes transparently to their real target.
      let targetIdx = rawLink;
      const visited = new Set();
      while (state.mazeMap[targetIdx]?.notes === 'link') {
        if (visited.has(targetIdx)) { targetIdx = -1; break; }
        visited.add(targetIdx);
        targetIdx = state.mazeMap[targetIdx].links[0] ?? -1;
      }

      if (targetIdx === -1)                             continue; // broken link
      if (state.mazeMap[targetIdx]?.notes === 'edge')  continue; // off-edge dead end
      if (parent.has(targetIdx))                        continue; // already visited

      parent.set(targetIdx, idx);
      queue.push(targetIdx);
    }
  }

  if (endPaths.length === 0) {
    console.warn('autoSolve: no solutions found from current position.');
    return false;
  }

  drawSolution(endPaths, maxTurns);
  return true;
}
