import { describe, expect, it } from "vitest";
import { Stark3DSValidationError } from "../../src/core/errors.js";
import {
  validateAuthenticateInput,
  validateConfig,
} from "../../src/validation/input.js";

const baseInput = {
  accessToken: "test-jwt",
  order: {
    number: "123",
    amount: 1000,
    currency: "BRL",
    installments: 1,
    paymentMethod: "credit",
  },
  card: {
    number: "4000000000000002",
    expirationMonth: "1",
    expirationYear: "30",
  },
};

describe("validateConfig", () => {
  it("accepts empty configure", () => {
    expect(() => validateConfig({})).not.toThrow();
  });

  it("accepts debug and timeout overrides", () => {
    expect(() =>
      validateConfig({ debug: true, authenticateTimeoutMs: 60_000 }),
    ).not.toThrow();
  });

  it("rejects invalid environment", () => {
    expect(() => validateConfig({ environment: "staging" })).toThrow(
      Stark3DSValidationError,
    );
  });

  it("rejects authenticateTimeoutMs <= 0", () => {
    expect(() => validateConfig({ authenticateTimeoutMs: 0 })).toThrow(
      Stark3DSValidationError,
    );
    expect(() => validateConfig({ authenticateTimeoutMs: -1 })).toThrow(
      Stark3DSValidationError,
    );
  });

  it("rejects scriptLoadAttempts < 1", () => {
    expect(() => validateConfig({ scriptLoadAttempts: 0 })).toThrow(
      Stark3DSValidationError,
    );
  });

  it("rejects scriptRetryDelayMs < 0", () => {
    expect(() => validateConfig({ scriptRetryDelayMs: -1 })).toThrow(
      Stark3DSValidationError,
    );
  });

  it("accepts scriptRetryDelayMs = 0", () => {
    expect(() => validateConfig({ scriptRetryDelayMs: 0 })).not.toThrow();
  });
});

describe("validateAuthenticateInput", () => {
  it("rejects missing accessToken", () => {
    const { accessToken: _t, ...withoutToken } = baseInput;
    expect(() => validateAuthenticateInput(withoutToken)).toThrow(
      Stark3DSValidationError,
    );
  });

  it("rejects whitespace-only accessToken", () => {
    expect(() =>
      validateAuthenticateInput({ ...baseInput, accessToken: "   " }),
    ).toThrow(Stark3DSValidationError);
  });

  it("accepts environment on authenticate input", () => {
    expect(() =>
      validateAuthenticateInput({ ...baseInput, environment: "production" }),
    ).not.toThrow();
  });

  it("rejects invalid environment on authenticate input", () => {
    expect(() =>
      validateAuthenticateInput({ ...baseInput, environment: "staging" }),
    ).toThrow(Stark3DSValidationError);
  });

  it("rejects missing order.number", () => {
    expect(() =>
      validateAuthenticateInput({
        ...baseInput,
        order: { ...baseInput.order, number: "" },
      }),
    ).toThrow(Stark3DSValidationError);
  });

  it("rejects order.amount <= 0", () => {
    expect(() =>
      validateAuthenticateInput({
        ...baseInput,
        order: { ...baseInput.order, amount: 0 },
      }),
    ).toThrow(Stark3DSValidationError);
    expect(() =>
      validateAuthenticateInput({
        ...baseInput,
        order: { ...baseInput.order, amount: -1 },
      }),
    ).toThrow(Stark3DSValidationError);
  });

  it("rejects missing order.currency", () => {
    expect(() =>
      validateAuthenticateInput({
        ...baseInput,
        order: { ...baseInput.order, currency: "" },
      }),
    ).toThrow(Stark3DSValidationError);
  });

  it("rejects unsupported currency codes", () => {
    expect(() =>
      validateAuthenticateInput({
        ...baseInput,
        order: { ...baseInput.order, currency: "XYZ" },
      }),
    ).toThrow(Stark3DSValidationError);
  });

  it("rejects missing card.number", () => {
    expect(() =>
      validateAuthenticateInput({
        ...baseInput,
        card: { ...baseInput.card, number: "" },
      }),
    ).toThrow(Stark3DSValidationError);
  });

  it("rejects missing card.expirationMonth", () => {
    expect(() =>
      validateAuthenticateInput({
        ...baseInput,
        card: { ...baseInput.card, expirationMonth: "" },
      }),
    ).toThrow(Stark3DSValidationError);
  });

  it("rejects missing card.expirationYear", () => {
    expect(() =>
      validateAuthenticateInput({
        ...baseInput,
        card: { ...baseInput.card, expirationYear: "" },
      }),
    ).toThrow(Stark3DSValidationError);
  });

  // Bug herdado do as-is: order sem `amount` (undefined) passa porque
  // `undefined <= 0` é false. Manter por paridade comportamental até Fase 5.
  it.todo("rejects missing order.amount (currently passes — known bug from as-is)");
});
