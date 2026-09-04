import assert from 'node:assert/strict';
import test from 'node:test';
import { checkByteBudget } from './rate-limit.ts';

const MB = 1024 * 1024;
let counter = 0;
/** Fresh key per test so windows never bleed across cases. */
const key = () => `test:${process.pid}:${counter++}`;

test('accumulates bytes across requests until the budget is spent', () => {
  const k = key();
  const budget = 60 * MB;

  assert.equal(checkByteBudget(k, 25 * MB, budget, 60_000).success, true);
  assert.equal(checkByteBudget(k, 25 * MB, budget, 60_000).success, true);

  // 75MB total is past a 60MB budget even though only three requests were made.
  const third = checkByteBudget(k, 25 * MB, budget, 60_000);
  assert.equal(third.success, false);
  assert.equal(third.remainingBytes, 0);
});

test('reports the remaining allowance', () => {
  const k = key();
  const first = checkByteBudget(k, 10 * MB, 60 * MB, 60_000);
  assert.equal(first.success, true);
  assert.equal(first.remainingBytes, 50 * MB);

  const second = checkByteBudget(k, 20 * MB, 60 * MB, 60_000);
  assert.equal(second.remainingBytes, 30 * MB);
});

test('a single request larger than the whole budget is refused', () => {
  assert.equal(checkByteBudget(key(), 200 * MB, 60 * MB, 60_000).success, false);
});

test('an over-budget retry loop cannot reset its own window', () => {
  const k = key();
  assert.equal(checkByteBudget(k, 100 * MB, 60 * MB, 60_000).success, false);
  // The refused request still consumed the window, so a follow-up small upload
  // is refused too rather than starting from a clean slate.
  assert.equal(checkByteBudget(k, 1 * MB, 60 * MB, 60_000).success, false);
});

test('the window expires and the allowance returns', async () => {
  const k = key();
  assert.equal(checkByteBudget(k, 50 * MB, 60 * MB, 50).success, true);
  assert.equal(checkByteBudget(k, 50 * MB, 60 * MB, 50).success, false);

  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(checkByteBudget(k, 50 * MB, 60 * MB, 50).success, true);
});

test('budgets are isolated per key', () => {
  const a = key();
  const b = key();
  assert.equal(checkByteBudget(a, 60 * MB, 60 * MB, 60_000).success, true);
  assert.equal(checkByteBudget(a, 1 * MB, 60 * MB, 60_000).success, false);
  assert.equal(checkByteBudget(b, 1 * MB, 60 * MB, 60_000).success, true);
});
