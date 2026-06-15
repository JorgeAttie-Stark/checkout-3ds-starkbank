/**
 * @param {object} [behavior]
 * @param {object} [behavior.result]
 * @param {Error} [behavior.throw]
 * @param {number} [behavior.delayMs]
 * @returns {{ authenticate: (input: object) => Promise<object>, calls: object[] }}
 */
export function createFakeMpiAdapter(behavior = {}) {
  const calls = [];

  async function authenticate(input) {
    calls.push(input);
    if (behavior.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, behavior.delayMs));
    }
    if (behavior.throw) {
      throw behavior.throw;
    }
    return behavior.result ?? { status: "failed" };
  }

  return { authenticate, calls };
}
