import { buildFullMpiFieldMap } from "./mpi-fields.js";

function createHiddenInput(targetDocument, className, value) {
  const input = targetDocument.createElement("input");
  input.type = "hidden";
  input.className = className;
  input.value = value;
  return input;
}

function appendFields(targetDocument, container, fields) {
  for (const [className, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    container.appendChild(createHiddenInput(targetDocument, className, String(value)));
  }
}

function addressFields(prefix, address) {
  const p = `bpmpi_${prefix}_`;
  return {
    [`${p}customerid`]: address.customerId,
    [`${p}name`]: address.name,
    [`${p}email`]: address.email,
    [`${p}phonenumber`]: address.phone,
    [`${p}street1`]: address.street1,
    [`${p}street2`]: address.street2,
    [`${p}city`]: address.city,
    [`${p}state`]: address.state,
    [`${p}country`]: address.country,
    [`${p}zipcode`]: address.zipcode,
  };
}

function cartFields(cart) {
  const fields = {};
  cart.forEach((item, index) => {
    const i = index + 1;
    fields[`bpmpi_cart_${i}_name`] = item.name;
    fields[`bpmpi_cart_${i}_description`] = item.description;
    fields[`bpmpi_cart_${i}_sku`] = item.sku;
    fields[`bpmpi_cart_${i}_quantity`] = String(item.quantity);
    fields[`bpmpi_cart_${i}_unitprice`] = String(item.unitPrice);
  });
  return fields;
}

/**
 * @param {object} input
 * @param {Document} [targetDocument]
 * @returns {HTMLElement}
 */
export function buildMpiContainer(input, targetDocument = document) {
  const container = targetDocument.createElement("div");
  container.setAttribute("data-stark-3ds", "payment-fields");
  container.style.display = "none";
  container.setAttribute("aria-hidden", "true");

  const fields = {
    ...buildFullMpiFieldMap(input),
    bpmpi_merchant_url:
      input.merchantUrl ?? targetDocument.defaultView?.location.origin,
  };

  if (input.billing) {
    Object.assign(fields, addressFields("billto", input.billing));
  }

  if (input.shipping) {
    if (input.shipping.sameAsBilling) {
      fields.bpmpi_shipto_sameasbillto = "true";
    } else {
      fields.bpmpi_shipto_sameasbillto = "false";
      Object.assign(fields, addressFields("shipto", input.shipping));
      if (input.shipping.shippingMethod) {
        fields.bpmpi_shipto_shippingmethod = input.shipping.shippingMethod;
      }
    }
  }

  if (input.device) {
    fields.bpmpi_device_ipaddress = input.device.ipAddress;
    if (input.device.fingerprint) {
      fields.bpmpi_device_1_fingerprint = input.device.fingerprint;
    }
    if (input.device.provider) {
      fields.bpmpi_device_1_provider = input.device.provider;
    }
  }

  if (input.cart?.length) {
    Object.assign(fields, cartFields(input.cart));
  }

  appendFields(targetDocument, container, fields);
  return container;
}

/**
 * @param {HTMLElement | null} container
 */
export function removeMpiContainer(container) {
  container?.remove();
}
