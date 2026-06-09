# Open Maze

A puzzle maze with a twist — instead of navigating corridors, you travel in straight lines across graph paper until you hit a barrier. The type of barrier determines which turns you can make.

Originally invented as a childhood pencil-and-paper game, now playable in the browser.

---

## How It Works

The maze is a sheet of graph paper. You move in a straight line in one direction until you collide with a **barrier** drawn on the grid. Then:

- **Red wall** — you must turn left or right (or turn around if it's a dead end)
- **Blue permeable wall** — all the usual options, plus you may pass straight through it
- **Forced turn** — only one direction is open, so the maze advances automatically

Your goal is to travel from the **dark green** start marker to the **light green** end marker. There may be multiple end markers on a maze.

---

## Controls

| Input | Action |
|---|---|
| Arrow keys | Move / choose direction |
| `B` / Backspace | Backtrack one step |
| `+` / `-` | Zoom in / out |
| Click canvas | Stop movement |
| Swipe (mobile) | Choose direction |
| Pinch (mobile) | Zoom in / out |

A built-in **Tutorial** walks you through all the mechanics step by step — hit the Tutorial button in the top bar to start.

---

## Features

- **Multiple built-in mazes** — Easy and Challenging difficulties
- **Maze Creator** — draw your own mazes on a custom grid and download them as `.maze` files
- **Load from file** — share and play community-made mazes
- **Auto-solver** — stuck? Ask the computer to find a path from your current position
- **Custom start** — click anywhere on the grid to begin from a non-default position
- **Zoom & pinch-to-zoom** — adjust the grid size to suit your screen
- **Mobile-friendly** — touch controls, swipe navigation, and scrollable canvas with large scroll controls

---

## Running Locally

Serve the project from the `open-maze` directory:

```bash
npx serve
```

Or on a custom port:

```bash
npx serve -l 8080
```

To stop a server running in the background:

```bash
npx kill-port 3000
```

> **Note:** Do not create a `serve.bat` file in this directory. `npx` will attempt to execute it as the `serve` command and enter an infinite loop.

---

## URL Query Parameters

You can deep-link directly into a specific state by appending query parameters to the URL.

| Parameter | Example | Description |
|---|---|---|
| `maze` | `?maze=easy2.maze` | Load a specific built-in maze on page load. Must be a valid filename from the catalog. |
| `tutorial` | `?tutorial` | Open the tutorial immediately on page load. |

**Valid `maze` values:** `easy1.maze`, `easy2.maze`, `easy3.maze`, `challenging1.maze`, `challenging2.maze`

Both parameters can be combined: `?tutorial&maze=…` is ignored in favour of the tutorial (tutorial takes priority).

---

## File Format

Mazes are saved as `.maze` files — plain text files you can open, share, and load directly in the browser. Use the **Maze Creator** to build one, then **Save Maze** to download it.

---

*Built with vanilla JavaScript, HTML5 Canvas, and CSS — no build step required.*
