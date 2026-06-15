import { afterEach, describe, expect, it } from "vitest";
import {
  __configure,
  __resetConfigForTests,
  getEffectiveConfig,
} from "../../src/services/config-store.js";
import { Stark3DSValidationError } from "../../src/core/errors.js";

describe("services/config-store", () => {
  afterEach(() => __resetConfigForTests());

  it("default config é objeto vazio", () => {
    expect(getEffectiveConfig()).toEqual({});
  });

  it("__configure({}) aceita vazio", () => {
    expect(() => __configure({})).not.toThrow();
    expect(getEffectiveConfig()).toEqual({});
  });

  it("__configure persiste último valor", () => {
    __configure({ environment: "sandbox", authenticateTimeoutMs: 5000 });
    expect(getEffectiveConfig()).toEqual({
      environment: "sandbox",
      authenticateTimeoutMs: 5000,
    });
  });

  it("__configure valida via validateConfig", () => {
    expect(() => __configure({ environment: "invalid" })).toThrow(
      Stark3DSValidationError,
    );
    expect(() => __configure({ authenticateTimeoutMs: 0 })).toThrow(
      Stark3DSValidationError,
    );
  });

  it("__resetConfigForTests volta ao default", () => {
    __configure({ environment: "production" });
    __resetConfigForTests();
    expect(getEffectiveConfig()).toEqual({});
  });

  it("getEffectiveConfig devolve cópia imutável do default", () => {
    const config = getEffectiveConfig();
    expect(() => {
      config.foo = "bar";
    }).toThrow();
  });
});
