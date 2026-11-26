// Access code check for the game page.
//
// This is a courtesy lock, not real security. The check runs in the visitor's
// browser, so anyone who reads this file can find the code by trying all
// combinations, and the game files can still be fetched directly by URL.
// It only keeps casual visitors out. For real protection the web server would
// have to ask for the password (see the "Game" notes in CLAUDE.md).
//
// Only a hash of the code is stored here, never the code itself.
// To change the code, run this in the repo root and paste the output below:
//   node -e "import('./public/game/js/gate.js').then(g => g.hashPin('NEW-CODE')).then(console.log)"

export const PIN_HASH = '8f32a7b132867ca9ac477f5f6f4e05bfac7f8a70840d4a7762d4e48910e41f06';

const SALT = 'dlrow-game:';

// Returns the SHA-256 hash of the code as 64 hex characters.
// crypto.subtle exists in browsers on https:// and localhost, and in Node.
export async function hashPin(pin) {
  const bytes = new TextEncoder().encode(SALT + pin);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function checkPin(pin, expectedHash = PIN_HASH) {
  return (await hashPin(pin)) === expectedHash;
}
