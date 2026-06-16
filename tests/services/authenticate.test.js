import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticate } from "../../src/services/authenticate.js";
import {
  __setAdapterFactory,
  __resetAdapterFactory,
} from "../../src/services/adapter-factory.js";
import { __resetConfigForTests, __configure } from "../../src/services/config-store.js";
import { resetAuthenticateQueueForTests } from "../../src/utils/auth-queue.js";
import * as scriptLoader from "../../src/adapters/mpi/script-loader.js";
import { MPI_SCRIPT_ELEMENT_ID } from "../../src/core/constants.js";
import { createFakeMpiAdapter } from "../_helpers/fake-mpi-adapter.js";
import {
  Stark3DSError,
  Stark3DSValidationError,
  Stark3DSAuthenticateTimeoutError,
} from "../../src/core/errors.js";

const validInput = () => ({
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

const authenticatedResult = {
  status: "authenticated",
  cavv: "cavv-x",
  eci: "05",
  xid: "xid-1",
  version: "2.2.0",
  referenceId: "ref-1",
};

beforeEach(() => {
  __resetConfigForTests();
  __resetAdapterFactory();
  resetAuthenticateQueueForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("services/authenticate", () => {
  it("happy path: input válido + status authenticated devolve output com challenge", async () => {
    const fake = createFakeMpiAdapter({ result: authenticatedResult });
    __setAdapterFactory(() => fake);

    const output = await authenticate(validInput());

    expect(output.authentication.status).toBe("authenticated");
    expect(output.challenge).toEqual({
      cavv: "cavv-x",
      eci: "05",
      version: "2.2.0",
      xid: "xid-1",
      referenceId: "ref-1",
    });
    expect(fake.calls).toHaveLength(1);
  });

  it("status failed: output sem challenge", async () => {
    const fake = createFakeMpiAdapter({
      result: { status: "failed", eci: "07" },
    });
    __setAdapterFactory(() => fake);

    const output = await authenticate(validInput());

    expect(output.authentication.status).toBe("failed");
    expect(output.challenge).toBeUndefined();
  });

  it("input inválido: validação falha antes do adapter", async () => {
    const fake = createFakeMpiAdapter({ result: authenticatedResult });
    __setAdapterFactory(() => fake);

    const invalid = { ...validInput(), accessToken: "" };
    await expect(authenticate(invalid)).rejects.toBeInstanceOf(
      Stark3DSValidationError,
    );
    expect(fake.calls).toHaveLength(0);
  });

  it("adapter rejeita: erro propagado", async () => {
    const boom = new Stark3DSError("boom", "ADAPTER_FAILURE");
    __setAdapterFactory(() => createFakeMpiAdapter({ throw: boom }));

    await expect(authenticate(validInput())).rejects.toBe(boom);
  });

  it("timeout: rejeita com Stark3DSAuthenticateTimeoutError", async () => {
    vi.useFakeTimers();
    __configure({ authenticateTimeoutMs: 50 });
    __setAdapterFactory(() => createFakeMpiAdapter({ delayMs: 5000 }));

    const promise = authenticate(validInput());
    const assertion = expect(promise).rejects.toBeInstanceOf(
      Stark3DSAuthenticateTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(60);
    await assertion;
  });

  it("fila serializa: 2 chamadas concorrentes não invocam adapter em paralelo", async () => {
    let inflight = 0;
    let maxInflight = 0;
    __setAdapterFactory(() => ({
      authenticate: async () => {
        inflight++;
        maxInflight = Math.max(maxInflight, inflight);
        await new Promise((r) => setTimeout(r, 10));
        inflight--;
        return { status: "failed" };
      },
    }));

    await Promise.all([authenticate(validInput()), authenticate(validInput())]);

    expect(maxInflight).toBe(1);
  });

  it("fila resiliente: erro numa chamada não trava a próxima", async () => {
    let call = 0;
    __setAdapterFactory(() => ({
      authenticate: async () => {
        call++;
        if (call === 1) throw new Stark3DSError("first fails", "X");
        return { status: "failed" };
      },
    }));

    await expect(authenticate(validInput())).rejects.toThrow("first fails");
    const second = await authenticate(validInput());
    expect(second.authentication.status).toBe("failed");
  });

  it("input.environment tem prioridade sobre config", async () => {
    __configure({ environment: "sandbox" });
    let received;
    __setAdapterFactory((cfg) => {
      received = cfg;
      return createFakeMpiAdapter({ result: { status: "failed" } });
    });

    await authenticate({ ...validInput(), environment: "production" });

    expect(received.environment).toBe("production");
  });

  it("sem __setAdapterFactory: cadeia E2E usa BrowserMpiAdapter (factory default)", async () => {
    const loadSpy = vi
      .spyOn(scriptLoader, "loadThreeDsScript")
      .mockImplementation(async (_env, options = {}) => {
        const target = options.target ?? { document, window };
        target.window.bpmpi_authenticate = () => {};
        queueMicrotask(() => target.window.bpmpi_config?.().onDisabled?.());
      });

    try {
      const output = await authenticate(validInput());

      expect(loadSpy).toHaveBeenCalled();
      expect(output.authentication.status).toBe("disabled");
      expect(document.getElementById(MPI_SCRIPT_ELEMENT_ID)).toBeNull();
      expect(window.bpmpi_authenticate).toBeUndefined();
      expect(window.bpmpi_config).toBeUndefined();
    } finally {
      vi.restoreAllMocks();
      scriptLoader.resetScriptLoaderForTests();
      document.body.innerHTML = "";
      delete window.bpmpi_authenticate;
      delete window.bpmpi_config;
    }
  });
});
