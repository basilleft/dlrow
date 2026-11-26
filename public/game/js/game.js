import { isSolid } from './level.js';
import { overlaps } from './physics.js';
import { createPlayer, updatePlayer } from './player.js';
import { createEnemy, updateEnemy } from './enemy.js';

// Upward speed after stomping an enemy. On the next step the bounce is cut to
// JUMP_CUT_SPEED (player.js) unless the jump key is held, so holding jump while
// stomping gives a higher bounce (about 1.8 tiles instead of about 1.1). This is intended.
export const BOUNCE_SPEED = 10;

// Builds a fresh game state from a parsed level.
export function createGame(level) {
  return {
    level,
    player: createPlayer(level.player),
    enemies: level.enemies.map(createEnemy),
    // Coin: a 0.5 x 0.5 box centred in its tile.
    coins: level.coins.map((c) => ({ x: c.x + 0.25, y: c.y + 0.25, w: 0.5, h: 0.5, collected: false })),
    // Flag: a 0.4 wide, 3 tall box centred on the pole, so the player cannot jump over it by accident.
    flag: { x: level.flag.x + 0.3, y: level.flag.y, w: 0.4, h: 3 },
    coinCount: 0,
    status: 'playing', // 'playing' or 'won'
    confirmHeld: false, // was Enter down on the previous step? (to detect a fresh press)
  };
}

// Puts everything back to the start, keeping the same game object.
export function resetGame(game) {
  Object.assign(game, createGame(game.level));
}

// Advances the game by one fixed time step.
// input is { left, right, jump, confirm } booleans.
export function stepGame(game, input, dt) {
  // Enter only counts as a fresh press, not when it was already held down.
  const confirmPressed = input.confirm && !game.confirmHeld;
  game.confirmHeld = input.confirm;

  if (game.status === 'won') {
    if (confirmPressed) {
      resetGame(game);
      game.confirmHeld = true; // resetGame cleared it, but Enter is still down
    }
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
