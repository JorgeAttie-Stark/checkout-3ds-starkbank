import { Stark3DSError } from "../core/errors.js";

const defaultFactory = () => {
  throw new Stark3DSError(
    "MPI adapter not available yet — Fase 3",
    "ADAPTER_NOT_CONFIGURED",
  );
};

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
