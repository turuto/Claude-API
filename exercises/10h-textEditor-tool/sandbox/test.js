import assert from "node:assert/strict";
import { calculatePi } from "./main.js";

// 1. Default (5 decimal places) should match Math.PI rounded to 5 places.
const pi5 = calculatePi();
const expected5 = Math.round(Math.PI * 1e5) / 1e5; // 3.14159
assert.strictEqual(
  pi5,
  expected5,
  `Expected pi to 5 decimals to be ${expected5}, got ${pi5}`
);

// 2. Explicitly passing 5 should behave the same as the default.
assert.strictEqual(
  calculatePi(5),
  expected5,
  "calculatePi(5) should equal the default calculatePi()"
);

// 3. Fewer decimals: 2 places should give 3.14.
const pi2 = calculatePi(2);
const expected2 = Math.round(Math.PI * 1e2) / 1e2; // 3.14
assert.strictEqual(
  pi2,
  expected2,
  `Expected pi to 2 decimals to be ${expected2}, got ${pi2}`
);

// 4. The result should be within a small tolerance of the real pi.
assert.ok(
  Math.abs(pi5 - Math.PI) < 1e-4,
  `pi5 (${pi5}) should be close to Math.PI (${Math.PI})`
);

console.log("All tests passed ✅");
