import { describe, expect, it } from "vitest";
import {
  resolveEnvironment,
  withResolvedEnvironment,
} from "../../src/config/environment.js";

describe("resolveEnvironment", () => {
  it("prefers authenticate input environment", () => {
    expect(resolveEnvironment({}, "production")).toBe("production");
  });

  it("input wins even when config sets a different environment", () => {
    expect(resolveEnvironment({ environment: "sandbox" }, "production")).toBe(
      "production",
    );
  });

  it("falls back to config.environment when input omits it", () => {
    expect(resolveEnvironment({ environment: "production" })).toBe("production");
  });

  it("defaults to sandbox when nothing provided", () => {
    expect(resolveEnvironment({})).toBe("sandbox");
  });
});

describe("withResolvedEnvironment", () => {
  it("returns config with environment defaulted to sandbox", () => {
    expect(withResolvedEnvironment({})).toEqual({ environment: "sandbox" });
  });

  it("preserves other config fields", () => {
    expect(
      withResolvedEnvironment({ debug: true, authenticateTimeoutMs: 60_000 }),
    ).toEqual({
      debug: true,
      authenticateTimeoutMs: 60_000,
      environment: "sandbox",
    });
  });

  it("input environment overrides config", () => {
    expect(
      withResolvedEnvironment({ environment: "sandbox" }, "production"),
    ).toEqual({ environment: "production" });
  });
});
