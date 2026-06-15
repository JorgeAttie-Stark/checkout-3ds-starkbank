import { toIso4217Numeric } from "../../utils/currency.js";

/**
 * @param {string} year
 * @returns {string}
 */
export function normalizeCardYear(year) {
  return year.length === 2 ? `20${year}` : year;
}

/**
 * @param {object} input
 * @returns {Record<string, string>}
 */
export function buildMpiPaymentSubmissionFields(input) {
  const { order, card } = input;
  return {
    bpmpi_cardnumber: card.number.replace(/\s/g, ""),
    bpmpi_cardexpirationmonth: card.expirationMonth.padStart(2, "0"),
    bpmpi_cardexpirationyear: normalizeCardYear(card.expirationYear),
    bpmpi_paymentmethod: order.paymentMethod,
    bpmpi_installments: String(order.installments),
    bpmpi_totalamount: String(order.amount),
    bpmpi_currency: toIso4217Numeric(order.currency),
    bpmpi_ordernumber: order.number,
    bpmpi_accesstoken: input.accessToken,
    bpmpi_auth_notifyonly: "false",
  };
}

/**
 * @param {object} input
 * @returns {Record<string, string | undefined>}
 */
export function buildFullMpiFieldMap(input) {
  return {
    bpmpi_auth: "true",
    bpmpi_auth_notifyonly: "false",
    ...buildMpiPaymentSubmissionFields(input),
    bpmpi_cardalias: input.card.alias,
    bpmpi_merchant_url: input.merchantUrl,
    bpmpi_transaction_mode: input.transactionMode ?? "R",
  };
}
