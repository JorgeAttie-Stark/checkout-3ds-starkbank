import { ISO4217_ALPHA_TO_NUMERIC } from "./iso4217.js";
import { Stark3DSValidationError } from "../core/errors.js";

export function normalizeCurrencyCode(currency) {
  if (typeof currency !== "string") return null;
  const code = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return null;
  if (!(code in ISO4217_ALPHA_TO_NUMERIC)) return null;
  return code;
}

export function isSupportedCurrency(currency) {
  return normalizeCurrencyCode(currency) !== null;
}

/**
 * @param {string} currency
 * @returns {string}
 * @throws {Stark3DSValidationError}
 */
export function toIso4217Numeric(currency) {
  const code = normalizeCurrencyCode(currency);
  if (!code) {
    throw new Stark3DSValidationError(`Unsupported currency: ${currency}`);
  }
  return ISO4217_ALPHA_TO_NUMERIC[code];
}
