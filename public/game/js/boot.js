// First script on the page: asks for the access code, then loads the game.
//
// The game itself (main.js and with it three.js) is only downloaded after the
// right code was entered, via a dynamic import().

import { checkPin } from './gate.js';

const STORAGE_KEY = 'game-unlocked';

const gate = document.getElementById('gate');
const pinInput = document.getElementById('pin');
const errorText = document.getElementById('gate-error');

// sessionStorage remembers the unlock for this browser tab only. It can be
// unavailable (private mode, blocked site data), so every access is guarded.
function wasUnlocked() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberUnlock() {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Not remembered; the code is simply asked again on the next visit.
  }
}

function startGame() {
  gate.hidden = true;
  pinInput.blur(); // so that key presses go to the game, not the input field
  import('./main.js');
}

function showError(text) {
  errorText.textContent = text;
  errorText.hidden = false;
}

if (wasUnlocked()) {
  startGame();
} else {
  gate.hidden = false;
  pinInput.focus();

  gate.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorText.hidden = true;

    let correct;
    try {
      correct = await checkPin(pinInput.value.trim());
    } catch (error) {
      console.error(error);
      showError('Der Code kann in diesem Browser nicht geprüft werden.');
      return;
    }

    if (correct) {
      rememberUnlock();
      startGame();
    } else {
      showError('Falscher Code.');
      pinInput.value = '';
      pinInput.focus();
    }
  });
}
