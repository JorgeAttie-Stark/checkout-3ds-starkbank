import { BrowserMpiAdapter } from "../adapters/mpi/browser-adapter.js";

const defaultFactory = (config) => new BrowserMpiAdapter(config);

let adapterFactory = defaultFactory;

/**
 * @returns {(config: object) => { authenticate: (input: object) => Promise<object> }}
 */
export function getAdapterFactory() {
  return adapterFactory;
}

/**
 * @internal
 * @param {(config: object) => { authenticate: (input: object) => Promise<object> }} factory
 */
export function __setAdapterFactory(factory) {
  adapterFactory = factory;
}

/** @internal */
export function __resetAdapterFactory() {
  adapterFactory = defaultFactory;
}
