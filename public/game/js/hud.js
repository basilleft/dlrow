// The text overlay on top of the canvas: coin counter and end-of-level message.

// Returns the texts to show for a game state. message is '' while playing.
export function hudText(game) {
  const total = game.coins.length;
  const coins = `Münzen: ${game.coinCount} / ${total}`;
  const message = game.status === 'won'
    ? `Level geschafft!\n${game.coinCount} von ${total} Münzen gesammelt\nEnter: noch einmal spielen`
    : '';
  return { coins, message };
}

export function createHud(doc = document) {
  const coinsEl = doc.getElementById('coins');
  const messageEl = doc.getElementById('message');
  let shown = { coins: null, message: null };

  return {
    // Call once per frame. Only touches the page when a text changed.
    update(game) {
      const next = hudText(game);
      if (next.coins !== shown.coins) coinsEl.textContent = next.coins;
      if (next.message !== shown.message) {
        messageEl.textContent = next.message;
        messageEl.hidden = next.message === '';
      }
      shown = next;
    },
  };
}
