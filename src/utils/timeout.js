import { Stark3DSAuthenticateTimeoutError } from "../core/errors.js";

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} timeoutMs
 * @returns {Promise<T>}
 * @throws {Stark3DSAuthenticateTimeoutError}
 */
export function withAuthenticateTimeout(promise, timeoutMs) {
  if (timeoutMs <= 0) return promise;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Stark3DSAuthenticateTimeoutError(
          `3DS authentication timed out after ${timeoutMs}ms`,
        ),
      );
    }, timeoutMs);

    promise.finally(() => clearTimeout(timer)).then(resolve, reject);
  });
}
