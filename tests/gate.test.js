import test from 'node:test';
import assert from 'node:assert/strict';
import { PIN_HASH, hashPin, checkPin } from '../public/game/js/gate.js';

// The real access code is deliberately not written in this file: the repository
// is public. The tests use a made-up code and its own hash instead.

test('hashPin gives a stable 64-character hex hash', async () => {
  const a = await hashPin('12345');
  const b = await hashPin('12345');
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, await hashPin('12346'));
});

test('checkPin accepts the code that matches the hash and rejects others', async () => {
  const hash = await hashPin('12345');
  assert.equal(await checkPin('12345', hash), true);
  assert.equal(await checkPin('12346', hash), false);
  assert.equal(await checkPin('', hash), false);
});

test('the stored hash is well-formed and rejects wrong codes', async () => {
  assert.match(PIN_HASH, /^[0-9a-f]{64}$/);
  assert.equal(await checkPin('00000'), false);
  assert.equal(await checkPin(''), false);
  assert.equal(await checkPin('12345'), false);
});
