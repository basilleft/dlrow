import { moveBox } from './physics.js';

export const ENEMY_SPEED = 2; // tiles per second

export function createEnemy(start) {
  return { x: start.x + 0.1, y: start.y, w: 0.8, h: 0.8, dir: -1, alive: true };
}

// Walks sideways. Turns around at walls and at platform edges. Enemies have no
// gravity; they must start on top of a solid tile.
export function updateEnemy(enemy, dt, solidAt) {
  if (!enemy.alive) return;

  const hit = moveBox(enemy, enemy.dir * ENEMY_SPEED * dt, 0, solidAt);
  if (hit.left || hit.right) {
    enemy.dir = -enemy.dir;
    return;
  }

  const frontX = enemy.dir > 0 ? enemy.x + enemy.w : enemy.x;
  const tileBelow = Math.round(enemy.y) - 1;
  if (!solidAt(Math.floor(frontX), tileBelow)) enemy.dir = -enemy.dir;
}
