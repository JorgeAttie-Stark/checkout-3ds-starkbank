import { validateConfig } from "../validation/input.js";

const DEFAULT_CONFIG = Object.freeze({});

let globalConfig = null;

/**
 * @internal
 * @param {object} [config]
 */
export function __configure(config = {}) {
  validateConfig(config);
  globalConfig = { ...config };
}

/**
 * @returns {object}
 */
export function getEffectiveConfig() {
  return globalConfig ?? DEFAULT_CONFIG;
}

/** @internal */
export function __resetConfigForTests() {
  globalConfig = null;
}
