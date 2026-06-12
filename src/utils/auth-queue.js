let queueTail = Promise.resolve();

/**
 * @template T
 * @param {() => Promise<T>} run
 * @returns {Promise<T>}
 */
export function enqueueAuthenticate(run) {
  const next = queueTail.then(run);
  queueTail = next.catch(() => undefined);
  return next;
}

/** @internal */
export function resetAuthenticateQueueForTests() {
  queueTail = Promise.resolve();
}
