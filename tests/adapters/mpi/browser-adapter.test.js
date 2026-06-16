import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserMpiAdapter } from "../../../src/adapters/mpi/browser-adapter.js";
import * as scriptLoader from "../../../src/adapters/mpi/script-loader.js";
import { MPI_SCRIPT_ELEMENT_ID } from "../../../src/core/constants.js";
import { Stark3DSAuthenticateTimeoutError } from "../../../src/core/errors.js";

const baseInput = () => ({
  accessToken: "jwt-fake",
  order: {
    number: "order-1",
    amount: 1000,
    currency: "BRL",
    installments: 1,
    paymentMethod: "credit",
  },
  card: {
    number: "4000000000001091",
    expirationMonth: "01",
    expirationYear: "2030",
  },
});

function installScriptLoaderStub(outcome) {
  vi.spyOn(scriptLoader, "loadThreeDsScript").mockImplementation(async () => {
    const el = document.createElement("script");
    el.id = MPI_SCRIPT_ELEMENT_ID;
    document.body.appendChild(el);

    window.bpmpi_authenticate = () => {
      const handlers = window.bpmpi_config?.();
      if (!handlers) return;
      switch (outcome) {
        case "success":
          handlers.onSuccess?.({
            Cavv: "fake-cavv",
            Eci: "05",
            Xid: null,
            Version: "2.2.0",
            ReferenceId: "ref-1",
          });
          break;
        case "failure":
          handlers.onFailure?.({
            Eci: "07",
            ReturnCode: "X",
            ReturnMessage: "fail",
            ReferenceId: "ref-1",
          });
          break;
        case "unenrolled":
          handlers.onUnenrolled?.({ Eci: "00" });
          break;
        case "disabled":
          handlers.onDisabled?.();
          break;
        case "error":
          handlers.onError?.({ ReturnCode: "99" });
          break;
        case "unsupported_brand":
          handlers.onUnsupportedBrand?.({});
          break;
      }
    };

    queueMicrotask(() => {
      const handlers = window.bpmpi_config?.();
      handlers?.onReady?.();
    });
  });
}

function adapterOpts(overrides = {}) {
  return { environment: "sandbox", ...overrides };
}

beforeEach(() => {
  scriptLoader.resetScriptLoaderForTests();
  document.body.innerHTML = "";
  delete window.bpmpi_authenticate;
  delete window.bpmpi_config;
});

afterEach(() => {
  vi.restoreAllMocks();
  scriptLoader.resetScriptLoaderForTests();
  document.body.innerHTML = "";
  delete window.bpmpi_authenticate;
  delete window.bpmpi_config;
});

describe("adapters/mpi/browser-adapter — cleanup", () => {
  it("SUCESSO: cleanup roda — <script>, container e globals removidos", async () => {
    installScriptLoaderStub("success");
    const adapter = new BrowserMpiAdapter(adapterOpts());

    const result = await adapter.authenticate(baseInput());

    expect(result.status).toBe("authenticated");
    expect(document.getElementById(MPI_SCRIPT_ELEMENT_ID)).toBeNull();
    expect(document.querySelector('[data-stark-3ds="payment-fields"]')).toBeNull();
    expect(window.bpmpi_authenticate).toBeUndefined();
    expect(window.bpmpi_config).toBeUndefined();
  });

  it("FALHA (onFailure): cleanup roda", async () => {
    installScriptLoaderStub("failure");
    const adapter = new BrowserMpiAdapter(adapterOpts());

    const result = await adapter.authenticate(baseInput());

    expect(result.status).toBe("failed");
    expect(document.getElementById(MPI_SCRIPT_ELEMENT_ID)).toBeNull();
    expect(window.bpmpi_authenticate).toBeUndefined();
    expect(window.bpmpi_config).toBeUndefined();
  });

  it.each(["unenrolled", "disabled", "error", "unsupported_brand"])(
    "callback %s: cleanup roda",
    async (outcome) => {
      installScriptLoaderStub(outcome);
      const adapter = new BrowserMpiAdapter(adapterOpts());

      const result = await adapter.authenticate(baseInput());

      expect(result.status).toBe(outcome);
      expect(document.getElementById(MPI_SCRIPT_ELEMENT_ID)).toBeNull();
      expect(window.bpmpi_authenticate).toBeUndefined();
      expect(window.bpmpi_config).toBeUndefined();
    },
  );

  it("ERRO de load: rejeita E cleanup roda", async () => {
    vi.spyOn(scriptLoader, "loadThreeDsScript").mockRejectedValue(
      new Error("Failed to load Stark 3DS authentication script"),
    );
    const adapter = new BrowserMpiAdapter(adapterOpts());

    await expect(adapter.authenticate(baseInput())).rejects.toThrow(/Stark 3DS/);
    expect(document.getElementById(MPI_SCRIPT_ELEMENT_ID)).toBeNull();
    expect(document.querySelector('[data-stark-3ds="payment-fields"]')).toBeNull();
    expect(window.bpmpi_authenticate).toBeUndefined();
    expect(window.bpmpi_config).toBeUndefined();
  });

  it("cleanup é idempotente — onSuccess + load.catch posterior não duplica efeito", async () => {
    let releaseLoad;
    vi.spyOn(scriptLoader, "loadThreeDsScript").mockImplementation(
      () =>
        new Promise((_, reject) => {
          releaseLoad = reject;
        }),
    );

    const adapter = new BrowserMpiAdapter(adapterOpts());
    const promise = adapter.authenticate(baseInput());

    // dispara onSuccess manualmente — finish/cleanup roda
    window.bpmpi_config?.().onSuccess?.({
      Cavv: "c",
      Eci: "05",
      Xid: null,
      Version: "2",
      ReferenceId: "r",
    });

    await expect(promise).resolves.toMatchObject({ status: "authenticated" });
    expect(document.getElementById(MPI_SCRIPT_ELEMENT_ID)).toBeNull();

    // depois disso, loadThreeDsScript rejeita — fail tenta rodar cleanup de novo
    releaseLoad?.(new Error("load too late"));
    await new Promise((r) => setTimeout(r, 0));

    // estado segue limpo (cleanup foi noop na 2ª chamada graças ao settled flag)
    expect(document.getElementById(MPI_SCRIPT_ELEMENT_ID)).toBeNull();
    expect(window.bpmpi_config).toBeUndefined();
  });
});

describe("adapters/mpi/browser-adapter — TIMEOUT interno", () => {
  it("dispara após authenticateTimeoutMs sem callback: rejeita E cleanup roda", async () => {
    vi.useFakeTimers();
    // load resolve mas Braspag nunca chama callback
    vi.spyOn(scriptLoader, "loadThreeDsScript").mockImplementation(async () => {
      window.bpmpi_authenticate = () => {
        /* nunca chama callback — simula Braspag mudo */
      };
      queueMicrotask(() => window.bpmpi_config?.().onReady?.());
    });

    const adapter = new BrowserMpiAdapter({
      environment: "sandbox",
      authenticateTimeoutMs: 100,
    });

    const promise = adapter.authenticate(baseInput());
    const assertion = expect(promise).rejects.toBeInstanceOf(
      Stark3DSAuthenticateTimeoutError,
    );

    await vi.advanceTimersByTimeAsync(120);
    await assertion;

    // estado limpo após timeout
    expect(document.getElementById(MPI_SCRIPT_ELEMENT_ID)).toBeNull();
    expect(document.querySelector('[data-stark-3ds="payment-fields"]')).toBeNull();
    expect(window.bpmpi_authenticate).toBeUndefined();
    expect(window.bpmpi_config).toBeUndefined();

    vi.useRealTimers();
  });

  it("callback chegando DEPOIS do timeout é ignorado (idempotência)", async () => {
    vi.useFakeTimers();
    let lateOnSuccess;
    vi.spyOn(scriptLoader, "loadThreeDsScript").mockImplementation(async () => {
      lateOnSuccess = () =>
        window.bpmpi_config?.().onSuccess?.({
          Cavv: "late",
          Eci: "05",
          Xid: null,
          Version: "2",
          ReferenceId: "r",
        });
      window.bpmpi_authenticate = () => {};
      queueMicrotask(() => window.bpmpi_config?.().onReady?.());
    });

    const adapter = new BrowserMpiAdapter({
      environment: "sandbox",
      authenticateTimeoutMs: 50,
    });
    const promise = adapter.authenticate(baseInput());
    const assertion = expect(promise).rejects.toBeInstanceOf(
      Stark3DSAuthenticateTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(60);
    await assertion;

    // depois do timeout, callback "atrasado" do Braspag não bagunça nada
    // (bpmpi_config já foi apagado pelo cleanup; chamar lateOnSuccess é noop seguro)
    expect(() => lateOnSuccess?.()).not.toThrow();
    expect(document.getElementById(MPI_SCRIPT_ELEMENT_ID)).toBeNull();

    vi.useRealTimers();
  });

  it("sucesso antes do timeout: timer é limpo e não dispara depois", async () => {
    vi.useFakeTimers();
    installScriptLoaderStub("success");

    const adapter = new BrowserMpiAdapter({
      environment: "sandbox",
      authenticateTimeoutMs: 5000,
    });
    const promise = adapter.authenticate(baseInput());

    // deixa o microtask do onReady rodar e callback disparar
    await vi.advanceTimersByTimeAsync(0);
    const result = await promise;

    expect(result.status).toBe("authenticated");

    // avança bem além do timeout — não deve disparar
    await vi.advanceTimersByTimeAsync(10000);
    // estado segue limpo (timer não disparou, não houve double-cleanup ruim)
    expect(document.getElementById(MPI_SCRIPT_ELEMENT_ID)).toBeNull();
    expect(window.bpmpi_config).toBeUndefined();

    vi.useRealTimers();
  });

  it("timeoutMs = 0 desliga o timer (sem timeout interno)", async () => {
    vi.useFakeTimers();
    installScriptLoaderStub("success");

    const adapter = new BrowserMpiAdapter({
      environment: "sandbox",
      authenticateTimeoutMs: 0,
    });
    const promise = adapter.authenticate(baseInput());
    await vi.advanceTimersByTimeAsync(0);
    const result = await promise;

    expect(result.status).toBe("authenticated");
    vi.useRealTimers();
  });
});

describe("adapters/mpi/browser-adapter — error paths síncronos", () => {
  it("buildMpiContainer joga (currency inválida): rejeita E cleanup roda", async () => {
    const loadSpy = vi.spyOn(scriptLoader, "loadThreeDsScript");
    const adapter = new BrowserMpiAdapter(adapterOpts());
    const invalid = baseInput();
    invalid.order.currency = "XYZ";

    await expect(adapter.authenticate(invalid)).rejects.toThrow(
      /Unsupported currency/,
    );

    // loadThreeDsScript NÃO foi chamado (falhou antes)
    expect(loadSpy).not.toHaveBeenCalled();
    // estado limpo: nenhum container vazado, nenhum global vazado
    expect(document.querySelector('[data-stark-3ds="payment-fields"]')).toBeNull();
    expect(window.bpmpi_config).toBeUndefined();
    expect(window.bpmpi_authenticate).toBeUndefined();
  });

  it("onReady com bpmpi_authenticate jogando síncrono: rejeita E cleanup roda", async () => {
    vi.spyOn(scriptLoader, "loadThreeDsScript").mockImplementation(async () => {
      window.bpmpi_authenticate = () => {
        throw new Error("braspag broke");
      };
      queueMicrotask(() => {
        window.bpmpi_config?.().onReady?.();
      });
    });

    const adapter = new BrowserMpiAdapter(adapterOpts());
    await expect(adapter.authenticate(baseInput())).rejects.toThrow(
      /braspag broke/,
    );
    expect(document.getElementById(MPI_SCRIPT_ELEMENT_ID)).toBeNull();
    expect(window.bpmpi_authenticate).toBeUndefined();
    expect(window.bpmpi_config).toBeUndefined();
  });
});

describe("adapters/mpi/browser-adapter — CANARY (CLAUDE.md)", () => {
  it("🚨 CANARY OBRIGATÓRIO: duas authenticate() sequenciais ambas completam", async () => {
    installScriptLoaderStub("success");
    const adapter = new BrowserMpiAdapter(adapterOpts());

    const first = await adapter.authenticate(baseInput());
    expect(first.status).toBe("authenticated");

    // antes da 2ª chamada, garantir que DOM/globals estão limpos
    expect(document.getElementById(MPI_SCRIPT_ELEMENT_ID)).toBeNull();
    expect(window.bpmpi_authenticate).toBeUndefined();
    expect(window.bpmpi_config).toBeUndefined();

    const second = await adapter.authenticate(baseInput());
    expect(second.status).toBe("authenticated");
  });

  it("🚨 CANARY: 3 authenticate() em sequência completam (long-haul)", async () => {
    installScriptLoaderStub("success");
    const adapter = new BrowserMpiAdapter(adapterOpts());

    for (let i = 0; i < 3; i++) {
      const result = await adapter.authenticate(baseInput());
      expect(result.status).toBe("authenticated");
    }
  });

  it("🚨 CANARY: 1ª falha + 2ª sucesso (cleanup roda mesmo em falha)", async () => {
    installScriptLoaderStub("failure");
    const adapter = new BrowserMpiAdapter(adapterOpts());

    const first = await adapter.authenticate(baseInput());
    expect(first.status).toBe("failed");

    vi.restoreAllMocks();
    installScriptLoaderStub("success");

    const second = await adapter.authenticate(baseInput());
    expect(second.status).toBe("authenticated");
  });
});

describe("adapters/mpi/browser-adapter — configuração", () => {
  it("mapeia sandbox → SDB nos handlers do bpmpi_config", async () => {
    let captured;
    vi.spyOn(scriptLoader, "loadThreeDsScript").mockImplementation(async () => {
      captured = window.bpmpi_config?.();
      const handlers = captured;
      handlers?.onDisabled?.();
    });

    const adapter = new BrowserMpiAdapter(adapterOpts({ environment: "sandbox" }));
    await adapter.authenticate(baseInput());

    expect(captured.Environment).toBe("SDB");
  });

  it("mapeia production → PRD nos handlers do bpmpi_config", async () => {
    let captured;
    vi.spyOn(scriptLoader, "loadThreeDsScript").mockImplementation(async () => {
      captured = window.bpmpi_config?.();
      captured?.onDisabled?.();
    });

    const adapter = new BrowserMpiAdapter(adapterOpts({ environment: "production" }));
    await adapter.authenticate(baseInput());

    expect(captured.Environment).toBe("PRD");
  });

  it("propaga options pro loadThreeDsScript", async () => {
    const loadSpy = vi
      .spyOn(scriptLoader, "loadThreeDsScript")
      .mockImplementation(async () => {
        const handlers = window.bpmpi_config?.();
        handlers?.onDisabled?.();
      });

    const adapter = new BrowserMpiAdapter(
      adapterOpts({
        scriptLoadAttempts: 5,
        scriptRetryDelayMs: 200,
        threeDsScriptUrl: "https://custom.example/mpi.js",
      }),
    );
    await adapter.authenticate(baseInput());

    expect(loadSpy).toHaveBeenCalledWith("sandbox", {
      attempts: 5,
      retryDelayMs: 200,
      scriptUrl: "https://custom.example/mpi.js",
    });
  });
});

describe("adapters/mpi/browser-adapter — DOM container", () => {
  it("anexa <div data-stark-3ds=payment-fields> no body antes do load", async () => {
    let containerAtLoadTime;
    vi.spyOn(scriptLoader, "loadThreeDsScript").mockImplementation(async () => {
      containerAtLoadTime = document.querySelector(
        '[data-stark-3ds="payment-fields"]',
      );
      const handlers = window.bpmpi_config?.();
      handlers?.onDisabled?.();
    });

    const adapter = new BrowserMpiAdapter(adapterOpts());
    await adapter.authenticate(baseInput());

    expect(containerAtLoadTime).toBeTruthy();
    // após cleanup, o container some
    expect(document.querySelector('[data-stark-3ds="payment-fields"]')).toBeNull();
  });
});
