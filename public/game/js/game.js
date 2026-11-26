import { isSolid } from './level.js';
import { overlaps } from './physics.js';
import { createPlayer, updatePlayer } from './player.js';
import { createEnemy, updateEnemy } from './enemy.js';

export const BOUNCE_SPEED = 10; // upward speed after stomping an enemy

// Builds a fresh game state from a parsed level.
export function createGame(level) {
  return {
    level,
    player: createPlayer(level.player),
    enemies: level.enemies.map(createEnemy),
    coins: level.coins.map((c) => ({ x: c.x + 0.25, y: c.y + 0.25, w: 0.5, h: 0.5, collected: false })),
    flag: { x: level.flag.x + 0.3, y: level.flag.y, w: 0.4, h: 3 },
    coinCount: 0,
    status: 'playing', // 'playing' or 'won'
  };
}

// Puts everything back to the start, keeping the same game object.
export function resetGame(game) {
  Object.assign(game, createGame(game.level));
}

// Advances the game by one fixed time step.
// input is { left, right, jump, confirm } booleans.
export function stepGame(game, input, dt) {
  if (game.status === 'won') {
    if (input.confirm) resetGame(game);
    return;
  }

  const solidAt = (tx, ty) => isSolid(game.level, tx, ty);
  const player = game.player;

  updatePlayer(player, input, dt, solidAt);
  for (const enemy of game.enemies) updateEnemy(enemy, dt, solidAt);

  for (const enemy of game.enemies) {
    if (!enemy.alive || !overlaps(player, enemy)) continue;
    const fromAbove = player.vy < 0 && player.y > enemy.y + enemy.h / 2;
    if (!fromAbove) {
      resetGame(game);
      return;
    }
    enemy.alive = false;
    player.vy = BOUNCE_SPEED;
  }

  for (const coin of game.coins) {
    if (coin.collected || !overlaps(player, coin)) continue;
    coin.collected = true;
    game.coinCount += 1;
  }

  if (overlaps(player, game.flag)) {
    game.status = 'won';
    return;
  }

  // Fell into a pit: the whole player is below the bottom of the level.
  if (player.y + player.h < 0) resetGame(game);
}
