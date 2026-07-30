// Entry point for this sandbox — Claude edits this file via the text editor tool.

/**
 * Calculate an approximation of pi using the Leibniz series:
 *
 *   pi = 4 * (1 - 1/3 + 1/5 - 1/7 + 1/9 - ...)
 *
 * The Leibniz series converges very slowly, so instead of running for a
 * fixed number of terms we keep adding terms until the running estimate
 * of pi is stable to the requested number of decimal places.
 *
 * @param {number} [decimals=5] Number of decimal digits to stabilise.
 * @returns {number} An approximation of pi rounded to `decimals` places.
 */
export function calculatePi(decimals = 5) {
  const factor = Math.pow(10, decimals);
  const round = (value) => Math.round(value * factor) / factor;

  let sum = 0;
  let k = 0;
  let previous = null;
  let current = 0;

  // Guard against an infinite loop; this is far more than enough terms
  // to stabilise 5 decimal places, and it keeps things safe for larger
  // requests too.
  const maxIterations = 100_000_000;

  do {
    // Leibniz term: (-1)^k / (2k + 1)
    sum += (k % 2 === 0 ? 1 : -1) / (2 * k + 1);
    k++;

    previous = current;
    current = round(4 * sum);
  } while (previous !== current && k < maxIterations);

  return current;
}

// When run directly (node main.js), print the result.
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`pi ≈ ${calculatePi(5)}`);
}
