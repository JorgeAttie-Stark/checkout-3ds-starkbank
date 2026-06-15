import { afterEach, describe, expect, it } from "vitest";
import {
  getAdapterFactory,
  __setAdapterFactory,
  __resetAdapterFactory,
} from "../../src/services/adapter-factory.js";
import { Stark3DSError } from "../../src/core/errors.js";

describe("services/adapter-factory", () => {
  afterEach(() => __resetAdapterFactory());

  it("factory default lança ADAPTER_NOT_CONFIGURED (Fase 2)", () => {
    const factory = getAdapterFactory();
    let caught;
    try {
      factory({});
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Stark3DSError);
    expect(caught.code).toBe("ADAPTER_NOT_CONFIGURED");
  });

  it("__setAdapterFactory substitui a factory ativa", () => {
    const fake = { authenticate: async () => ({ status: "failed" }) };
    __setAdapterFactory(() => fake);

    expect(getAdapterFactory()({})).toBe(fake);
  });

  it("__resetAdapterFactory volta à default", () => {
    __setAdapterFactory(() => ({ authenticate: async () => ({}) }));
    __resetAdapterFactory();

    expect(() => getAdapterFactory()({})).toThrow(Stark3DSError);
  });
});
