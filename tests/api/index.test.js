import { describe, expect, it } from "vitest";
import {
  Stark3DS,
  Stark3DSError,
  Stark3DSValidationError,
  Stark3DSAuthenticateTimeoutError,
  isAuthenticated,
  toChallengeResult,
  isLiabilityShiftToIssuer,
} from "../../src/api/index.js";

describe("api/index — Fase 0 façade", () => {
  it("expõe Stark3DS.authenticate (stub que rejeita)", async () => {
    await expect(Stark3DS.authenticate({})).rejects.toBeInstanceOf(Stark3DSError);
  });

  it("re-exporta helpers", () => {
    expect(typeof isAuthenticated).toBe("function");
    expect(typeof toChallengeResult).toBe("function");
    expect(typeof isLiabilityShiftToIssuer).toBe("function");
  });

  it("re-exporta classes de erro", () => {
    expect(new Stark3DSValidationError("x")).toBeInstanceOf(Stark3DSError);
    expect(new Stark3DSAuthenticateTimeoutError("x")).toBeInstanceOf(Stark3DSError);
  });

  it("isLiabilityShiftToIssuer trata ECI 01/02/05", () => {
    expect(isLiabilityShiftToIssuer("05")).toBe(true);
    expect(isLiabilityShiftToIssuer("5")).toBe(true);
    expect(isLiabilityShiftToIssuer("07")).toBe(false);
    expect(isLiabilityShiftToIssuer(undefined)).toBe(false);
  });
});
