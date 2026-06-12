import { Stark3DSValidationError } from "../core/errors.js";
import { isSupportedCurrency } from "../utils/currency.js";

function assertEnvironment(value) {
  if (
    value !== undefined &&
    value !== "sandbox" &&
    value !== "production"
  ) {
    throw new Stark3DSValidationError(
      'environment must be "sandbox" or "production"',
    );
  }
}

/**
 * @param {object} input
 * @throws {Stark3DSValidationError}
 */
export function validateAuthenticateInput(input) {
  if (!input.accessToken?.trim()) {
    throw new Stark3DSValidationError("accessToken is required");
  }
  assertEnvironment(input.environment);

  if (!input.order?.number) {
    throw new Stark3DSValidationError("order.number is required");
  }
  if (input.order.amount <= 0) {
    throw new Stark3DSValidationError("order.amount must be greater than 0");
  }
  if (!input.order.currency) {
    throw new Stark3DSValidationError("order.currency is required");
  }
  if (!isSupportedCurrency(input.order.currency)) {
    throw new Stark3DSValidationError(
      `Unsupported currency: ${input.order.currency}. Use an ISO 4217 alphabetic code (e.g. BRL, USD, EUR).`,
    );
  }

  if (!input.card?.number) {
    throw new Stark3DSValidationError("card.number is required");
  }
  if (!input.card.expirationMonth || !input.card.expirationYear) {
    throw new Stark3DSValidationError("card expiration is required");
  }
}

/**
 * @internal SDK overrides (homolog).
 * @param {object} config
 * @throws {Stark3DSValidationError}
 */
export function validateConfig(config) {
  assertEnvironment(config.environment);

  if (
    config.authenticateTimeoutMs !== undefined &&
    config.authenticateTimeoutMs <= 0
  ) {
    throw new Stark3DSValidationError(
      "authenticateTimeoutMs must be greater than 0",
    );
  }
  if (config.scriptLoadAttempts !== undefined && config.scriptLoadAttempts < 1) {
    throw new Stark3DSValidationError("scriptLoadAttempts must be at least 1");
  }
  if (config.scriptRetryDelayMs !== undefined && config.scriptRetryDelayMs < 0) {
    throw new Stark3DSValidationError("scriptRetryDelayMs must be 0 or greater");
  }
}
