import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const bundlePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../dist/checkout-3ds.min.js",
);

function getStark3DS() {
  const sdk = window.Stark3DS;
  if (!sdk) {
    throw new Error("window.Stark3DS missing after loading CDN bundle");
  }
  return sdk;
}

describe.skipIf(!existsSync(bundlePath))("CDN IIFE bundle smoke", () => {
  beforeAll(() => {
    const code = readFileSync(bundlePath, "utf8");
    window.eval(code);
  });

  it("exposes window.Stark3DS with public API", () => {
    const sdk = getStark3DS();
    expect(sdk).toBeDefined();
    expect(typeof sdk.authenticate).toBe("function");
    expect(typeof sdk.isAuthenticated).toBe("function");
    expect(typeof sdk.toChallengeResult).toBe("function");
    expect(typeof sdk.isLiabilityShiftToIssuer).toBe("function");
  });

  it("exposes error classes as aliases", () => {
    const sdk = getStark3DS();
    expect(typeof sdk.Error).toBe("function");
    expect(typeof sdk.ValidationError).toBe("function");
    expect(typeof sdk.AuthenticateTimeoutError).toBe("function");
  });

  it("does not leak __Stark3DSBundle__ on window", () => {
    expect(window.__Stark3DSBundle__).toBeUndefined();
  });
});
