import { moveBox } from './physics.js';

export const MOVE_SPEED = 6;      // tiles per second
export const GRAVITY = 40;        // tiles per second squared
export const JUMP_SPEED = 15;     // full jump reaches about 2.8 tiles
export const JUMP_CUT_SPEED = 6;  // upward speed is capped to this once jump is released
export const MAX_FALL_SPEED = 20;

export function createPlayer(start) {
  return {
    x: start.x + 0.15, y: start.y, w: 0.7, h: 0.9,
    vx: 0, vy: 0, onGround: false, jumpHeld: false,
  };
}

// input is { left, right, jump } booleans.
export function updatePlayer(player, input, dt, solidAt) {
  player.vx = ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * MOVE_SPEED;

  // Jump only on a fresh key press, not while the key stays held.
  if (input.jump && !player.jumpHeld && player.onGround) player.vy = JUMP_SPEED;
  // Releasing the key early cuts the jump short.
  if (!input.jump && player.vy > JUMP_CUT_SPEED) player.vy = JUMP_CUT_SPEED;
  player.jumpHeld = input.jump;

  player.vy = Math.max(player.vy - GRAVITY * dt, -MAX_FALL_SPEED);

  const hit = moveBox(player, player.vx * dt, player.vy * dt, solidAt);
  if (hit.floor || hit.ceiling) player.vy = 0;
  player.onGround = hit.floor;
}
