import { afterEach, describe, expect, it } from "vitest";
import {
  getAdapterFactory,
  __setAdapterFactory,
  __resetAdapterFactory,
} from "../../src/services/adapter-factory.js";
import { BrowserMpiAdapter } from "../../src/adapters/mpi/browser-adapter.js";

describe("services/adapter-factory", () => {
  afterEach(() => __resetAdapterFactory());

  it("factory default instancia BrowserMpiAdapter", () => {
    const adapter = getAdapterFactory()({ environment: "sandbox" });
    expect(adapter).toBeInstanceOf(BrowserMpiAdapter);
    expect(typeof adapter.authenticate).toBe("function");
  });

  it("factory default repassa config pro adapter", () => {
    const config = {
      environment: "production",
      authenticateTimeoutMs: 60000,
    };
    const adapter = getAdapterFactory()(config);
    expect(adapter.options).toEqual(config);
  });

  it("__setAdapterFactory substitui a factory ativa", () => {
    const fake = { authenticate: async () => ({ status: "failed" }) };
    __setAdapterFactory(() => fake);

    expect(getAdapterFactory()({})).toBe(fake);
  });

  it("__resetAdapterFactory volta à default (BrowserMpiAdapter)", () => {
    __setAdapterFactory(() => ({ authenticate: async () => ({}) }));
    __resetAdapterFactory();

    const adapter = getAdapterFactory()({ environment: "sandbox" });
    expect(adapter).toBeInstanceOf(BrowserMpiAdapter);
  });
});
