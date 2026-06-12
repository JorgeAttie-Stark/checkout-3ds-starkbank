import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Stark3DSAuthenticateTimeoutError } from "../../src/core/errors.js";
import { withAuthenticateTimeout } from "../../src/utils/timeout.js";

describe("withAuthenticateTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the value when promise settles before timeout", async () => {
    const result = withAuthenticateTimeout(Promise.resolve("ok"), 1000);
    await expect(result).resolves.toBe("ok");
  });

  it("rejects with the original error when promise rejects before timeout", async () => {
    const original = new Error("network down");
    const result = withAuthenticateTimeout(Promise.reject(original), 1000);
    await expect(result).rejects.toBe(original);
  });

  it("rejects with Stark3DSAuthenticateTimeoutError when promise stalls", async () => {
    const pending = new Promise(() => {});
    const result = withAuthenticateTimeout(pending, 500);

    vi.advanceTimersByTime(500);

    await expect(result).rejects.toBeInstanceOf(Stark3DSAuthenticateTimeoutError);
    await expect(result).rejects.toThrow(/timed out after 500ms/);
  });

  it("returns the original promise when timeoutMs <= 0", () => {
    const original = Promise.resolve("ok");
    expect(withAuthenticateTimeout(original, 0)).toBe(original);
    expect(withAuthenticateTimeout(original, -1)).toBe(original);
  });

  it("clears the timer when promise resolves (no late rejection)", async () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    await withAuthenticateTimeout(Promise.resolve("ok"), 1000);
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it("clears the timer when promise rejects (no late rejection)", async () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    await withAuthenticateTimeout(Promise.reject(new Error("x")), 1000).catch(
      () => {},
    );
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
