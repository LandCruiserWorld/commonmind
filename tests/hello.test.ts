import test from 'node:test';
import assert from 'node:assert/strict';
import { hello } from '../src/index.js';

test('hello reports the configured embed provider', () => {
  process.env.EMBED_PROVIDER = 'local';
  const msg = hello();
  assert.ok(msg.includes('cortex-memory ready'));
  assert.ok(msg.includes('local'));
});