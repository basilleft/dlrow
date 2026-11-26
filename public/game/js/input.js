// Keyboard state. Reports which actions are currently held down.

const LEFT = ['ArrowLeft', 'KeyA'];
const RIGHT = ['ArrowRight', 'KeyD'];
const JUMP = ['Space', 'ArrowUp', 'KeyW'];
const CONFIRM = ['Enter'];
const USED = new Set([...LEFT, ...RIGHT, ...JUMP, ...CONFIRM]);

export function createInput(target = window) {
  const held = new Set();

  target.addEventListener('keydown', (event) => {
    if (!USED.has(event.code)) return;
    event.preventDefault(); // stop space and arrows from scrolling the page
    held.add(event.code);
  });
  target.addEventListener('keyup', (event) => held.delete(event.code));
  // If the window loses focus we never see the keyup, so release everything.
  target.addEventListener('blur', () => held.clear());

  const any = (codes) => codes.some((code) => held.has(code));
  return {
    get left() { return any(LEFT); },
    get right() { return any(RIGHT); },
    get jump() { return any(JUMP); },
    get confirm() { return any(CONFIRM); },
  };
}
