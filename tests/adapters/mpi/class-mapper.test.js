import { afterEach, describe, expect, it } from "vitest";
import {
  buildMpiContainer,
  removeMpiContainer,
} from "../../../src/adapters/mpi/class-mapper.js";

const baseInput = () => ({
  accessToken: "jwt-token",
  order: {
    number: "order-1",
    amount: 100,
    currency: "BRL",
    installments: 1,
    paymentMethod: "credit",
  },
  card: {
    number: "4111111111111111",
    expirationMonth: "12",
    expirationYear: "2030",
  },
});

function fieldValue(container, className) {
  return container.querySelector(`input.${className}`)?.value;
}

describe("adapters/mpi/class-mapper", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  describe("buildMpiContainer", () => {
    it("retorna <div> escondido com marcador data-stark-3ds", () => {
      const container = buildMpiContainer(baseInput());
      expect(container.tagName).toBe("DIV");
      expect(container.getAttribute("data-stark-3ds")).toBe("payment-fields");
      expect(container.style.display).toBe("none");
      expect(container.getAttribute("aria-hidden")).toBe("true");
    });

    it("popula campos bpmpi_* básicos como <input type=hidden>", () => {
      const container = buildMpiContainer(baseInput());
      expect(fieldValue(container, "bpmpi_cardnumber")).toBe("4111111111111111");
      expect(fieldValue(container, "bpmpi_ordernumber")).toBe("order-1");
      expect(fieldValue(container, "bpmpi_accesstoken")).toBe("jwt-token");
      expect(fieldValue(container, "bpmpi_auth")).toBe("true");
      const inputs = container.querySelectorAll("input[type=hidden]");
      expect(inputs.length).toBeGreaterThan(0);
    });

    it("merchant_url usa window.location.origin quando não passado", () => {
      const container = buildMpiContainer(baseInput());
      expect(fieldValue(container, "bpmpi_merchant_url")).toBe(
        window.location.origin,
      );
    });

    it("merchant_url respeita input.merchantUrl", () => {
      const input = { ...baseInput(), merchantUrl: "https://lojinha.com" };
      const container = buildMpiContainer(input);
      expect(fieldValue(container, "bpmpi_merchant_url")).toBe(
        "https://lojinha.com",
      );
    });

    it("inclui address fields quando billing presente", () => {
      const input = {
        ...baseInput(),
        billing: {
          name: "Jorge",
          email: "j@x.com",
          phone: "11999999999",
          street1: "Rua A",
          city: "SP",
          state: "SP",
          country: "BR",
          zipcode: "01000-000",
        },
      };
      const container = buildMpiContainer(input);
      expect(fieldValue(container, "bpmpi_billto_name")).toBe("Jorge");
      expect(fieldValue(container, "bpmpi_billto_email")).toBe("j@x.com");
      expect(fieldValue(container, "bpmpi_billto_country")).toBe("BR");
    });

    it("shipping.sameAsBilling=true emite só o flag, sem shipto_*", () => {
      const input = {
        ...baseInput(),
        shipping: {
          sameAsBilling: true,
          name: "Jorge",
          email: "j@x.com",
          phone: "11999999999",
          street1: "Rua A",
          city: "SP",
          state: "SP",
          country: "BR",
          zipcode: "01000-000",
        },
      };
      const container = buildMpiContainer(input);
      expect(fieldValue(container, "bpmpi_shipto_sameasbillto")).toBe("true");
      expect(fieldValue(container, "bpmpi_shipto_name")).toBeUndefined();
    });

    it("shipping.sameAsBilling=false emite os campos shipto_* + shippingMethod", () => {
      const input = {
        ...baseInput(),
        shipping: {
          sameAsBilling: false,
          name: "Jorge",
          email: "j@x.com",
          phone: "11999999999",
          street1: "Rua B",
          city: "SP",
          state: "SP",
          country: "BR",
          zipcode: "02000-000",
          shippingMethod: "express",
        },
      };
      const container = buildMpiContainer(input);
      expect(fieldValue(container, "bpmpi_shipto_sameasbillto")).toBe("false");
      expect(fieldValue(container, "bpmpi_shipto_name")).toBe("Jorge");
      expect(fieldValue(container, "bpmpi_shipto_street1")).toBe("Rua B");
      expect(fieldValue(container, "bpmpi_shipto_shippingmethod")).toBe(
        "express",
      );
    });

    it("device adiciona ipaddress + fingerprint + provider", () => {
      const input = {
        ...baseInput(),
        device: {
          ipAddress: "10.0.0.1",
          fingerprint: "fp-x",
          provider: "starkbank",
        },
      };
      const container = buildMpiContainer(input);
      expect(fieldValue(container, "bpmpi_device_ipaddress")).toBe("10.0.0.1");
      expect(fieldValue(container, "bpmpi_device_1_fingerprint")).toBe("fp-x");
      expect(fieldValue(container, "bpmpi_device_1_provider")).toBe("starkbank");
    });

    it("cart com 2 itens gera campos cart_1_* e cart_2_*", () => {
      const input = {
        ...baseInput(),
        cart: [
          { name: "Item A", quantity: 1, unitPrice: 50 },
          { name: "Item B", quantity: 2, unitPrice: 25, sku: "SKU-B" },
        ],
      };
      const container = buildMpiContainer(input);
      expect(fieldValue(container, "bpmpi_cart_1_name")).toBe("Item A");
      expect(fieldValue(container, "bpmpi_cart_1_quantity")).toBe("1");
      expect(fieldValue(container, "bpmpi_cart_2_name")).toBe("Item B");
      expect(fieldValue(container, "bpmpi_cart_2_sku")).toBe("SKU-B");
    });

    it("não anexa ao document.body — só constrói o nó", () => {
      const container = buildMpiContainer(baseInput());
      expect(container.parentNode).toBeNull();
      expect(document.body.children.length).toBe(0);
    });

    it("campos undefined/null não viram <input>", () => {
      const container = buildMpiContainer(baseInput());
      expect(fieldValue(container, "bpmpi_cardalias")).toBeUndefined();
    });

    it("cardalias vira <input> quando presente", () => {
      const input = baseInput();
      input.card.alias = "main-card";
      const container = buildMpiContainer(input);
      expect(fieldValue(container, "bpmpi_cardalias")).toBe("main-card");
    });
  });

  describe("removeMpiContainer", () => {
    it("remove o nó do DOM", () => {
      const container = buildMpiContainer(baseInput());
      document.body.appendChild(container);
      expect(document.body.contains(container)).toBe(true);
      removeMpiContainer(container);
      expect(document.body.contains(container)).toBe(false);
    });

    it("é idempotente — null não throw", () => {
      expect(() => removeMpiContainer(null)).not.toThrow();
    });
  });
});
