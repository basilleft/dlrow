import test from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../public/game/js/input.js';

function key(type, code) {
  const event = new Event(type, { cancelable: true });
  event.code = code;
  return event;
}

test('keys map to actions while held and release on keyup', () => {
  const target = new EventTarget();
  const input = createInput(target);
  assert.equal(input.left, false);

  target.dispatchEvent(key('keydown', 'KeyA'));
  assert.equal(input.left, true);
  target.dispatchEvent(key('keyup', 'KeyA'));
  assert.equal(input.left, false);

  target.dispatchEvent(key('keydown', 'ArrowRight'));
  target.dispatchEvent(key('keydown', 'Space'));
  target.dispatchEvent(key('keydown', 'Enter'));
  assert.equal(input.right, true);
  assert.equal(input.jump, true);
  assert.equal(input.confirm, true);
});

test('game keys do not scroll the page, other keys are left alone', () => {
  const target = new EventTarget();
  createInput(target);
  const space = key('keydown', 'Space');
  const tab = key('keydown', 'Tab');
  target.dispatchEvent(space);
  target.dispatchEvent(tab);
  assert.equal(space.defaultPrevented, true);
  assert.equal(tab.defaultPrevented, false);
});

test('losing focus releases all keys', () => {
  const target = new EventTarget();
  const input = createInput(target);
  target.dispatchEvent(key('keydown', 'KeyD'));
  target.dispatchEvent(new Event('blur'));
  assert.equal(input.right, false);
});

test('game keys are ignored while Cmd, Ctrl or Alt is held', () => {
  const cases = [
    ['metaKey', 'KeyA', 'left'],
    ['ctrlKey', 'KeyD', 'right'],
    ['altKey', 'ArrowLeft', 'left'],
  ];
  for (const [modifier, code, action] of cases) {
    const target = new EventTarget();
    const input = createInput(target);
    const event = key('keydown', code);
    event[modifier] = true;
    target.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false, `${modifier}+${code} is left to the browser`);
    assert.equal(input[action], false, `${modifier}+${code} does not press ${action}`);
  }
});
