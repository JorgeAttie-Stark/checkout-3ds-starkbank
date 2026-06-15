import { describe, expect, it } from "vitest";
import {
  buildFullMpiFieldMap,
  buildMpiPaymentSubmissionFields,
  normalizeCardYear,
} from "../../../src/adapters/mpi/mpi-fields.js";
import { Stark3DSValidationError } from "../../../src/core/errors.js";

const baseInput = () => ({
  accessToken: "jwt-token",
  order: {
    number: "order-1",
    amount: 12345,
    currency: "BRL",
    installments: 3,
    paymentMethod: "credit",
  },
  card: {
    number: "4111 1111 1111 1111",
    expirationMonth: "5",
    expirationYear: "30",
  },
});

describe("adapters/mpi/mpi-fields", () => {
  describe("normalizeCardYear", () => {
    it('expande "30" → "2030"', () => {
      expect(normalizeCardYear("30")).toBe("2030");
    });
    it('mantém "2030"', () => {
      expect(normalizeCardYear("2030")).toBe("2030");
    });
  });

  describe("buildMpiPaymentSubmissionFields", () => {
    it("remove espaços do cardnumber", () => {
      const fields = buildMpiPaymentSubmissionFields(baseInput());
      expect(fields.bpmpi_cardnumber).toBe("4111111111111111");
    });

    it("zero-pad do expirationMonth", () => {
      const fields = buildMpiPaymentSubmissionFields(baseInput());
      expect(fields.bpmpi_cardexpirationmonth).toBe("05");
    });

    it("expande expirationYear de 2 pra 4 dígitos", () => {
      const fields = buildMpiPaymentSubmissionFields(baseInput());
      expect(fields.bpmpi_cardexpirationyear).toBe("2030");
    });

    it("currency vira numérico ISO 4217 (BRL → 986)", () => {
      const fields = buildMpiPaymentSubmissionFields(baseInput());
      expect(fields.bpmpi_currency).toBe("986");
    });

    it("currency inválida lança Stark3DSValidationError", () => {
      const input = baseInput();
      input.order.currency = "XYZ";
      expect(() => buildMpiPaymentSubmissionFields(input)).toThrow(
        Stark3DSValidationError,
      );
    });

    it("amount e installments vão como string", () => {
      const fields = buildMpiPaymentSubmissionFields(baseInput());
      expect(fields.bpmpi_totalamount).toBe("12345");
      expect(fields.bpmpi_installments).toBe("3");
    });

    it("accessToken e ordernumber preservados", () => {
      const fields = buildMpiPaymentSubmissionFields(baseInput());
      expect(fields.bpmpi_accesstoken).toBe("jwt-token");
      expect(fields.bpmpi_ordernumber).toBe("order-1");
    });

    it("bpmpi_auth_notifyonly é sempre false", () => {
      const fields = buildMpiPaymentSubmissionFields(baseInput());
      expect(fields.bpmpi_auth_notifyonly).toBe("false");
    });
  });

  describe("buildFullMpiFieldMap", () => {
    it("inclui bpmpi_auth=true e merge dos payment fields", () => {
      const fields = buildFullMpiFieldMap(baseInput());
      expect(fields.bpmpi_auth).toBe("true");
      expect(fields.bpmpi_cardnumber).toBe("4111111111111111");
    });

    it("transaction_mode default = R", () => {
      const fields = buildFullMpiFieldMap(baseInput());
      expect(fields.bpmpi_transaction_mode).toBe("R");
    });

    it("transaction_mode pode ser sobrescrito", () => {
      const input = { ...baseInput(), transactionMode: "S" };
      const fields = buildFullMpiFieldMap(input);
      expect(fields.bpmpi_transaction_mode).toBe("S");
    });

    it("cardalias passa quando presente", () => {
      const input = baseInput();
      input.card.alias = "main-card";
      const fields = buildFullMpiFieldMap(input);
      expect(fields.bpmpi_cardalias).toBe("main-card");
    });

    it("cardalias undefined quando ausente", () => {
      const fields = buildFullMpiFieldMap(baseInput());
      expect(fields.bpmpi_cardalias).toBeUndefined();
    });

    it("merchant_url undefined se não passado", () => {
      const fields = buildFullMpiFieldMap(baseInput());
      expect(fields.bpmpi_merchant_url).toBeUndefined();
    });
  });
});
