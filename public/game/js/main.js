// Entry point: builds everything and runs the game loop.

import { LEVEL_1, parseLevel } from './level.js';
import { createGame, stepGame } from './game.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createView, isWebGLAvailable } from './render.js';

const STEP = 1 / 60;     // the simulation always advances in steps of this size
const MAX_FRAME = 0.1;   // never simulate more than this much time per frame

const canvas = document.getElementById('game');

if (isWebGLAvailable()) {
  start();
} else {
  canvas.hidden = true;
  document.getElementById('help').hidden = true;
  document.getElementById('no-webgl').hidden = false;
}

function start() {
  const game = createGame(parseLevel(LEVEL_1));
  const input = createInput();
  const hud = createHud();
  const view = createView(canvas, game.level);

  window.addEventListener('resize', view.resize);
  view.resize();

  let last = performance.now();
  let accumulator = 0;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    // Fixed time step: the screen may refresh at any rate, but the game rules
    // always run in equal steps, so jumps behave the same on every machine.
    if (!document.hidden) {
      accumulator += dt;
      while (accumulator >= STEP) {
        stepGame(game, input, STEP);
        accumulator -= STEP;
      }
    }

    view.render(game, dt, now / 1000);
    hud.update(game);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
