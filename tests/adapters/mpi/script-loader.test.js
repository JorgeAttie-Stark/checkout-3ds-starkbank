import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SCRIPT_LOAD_ATTEMPTS,
  DEFAULT_SCRIPT_RETRY_DELAY_MS,
  clearScriptLoadState,
  loadThreeDsScript,
  resetScriptLoaderForTests,
} from "../../../src/adapters/mpi/script-loader.js";
import { MPI_SCRIPT_ELEMENT_ID } from "../../../src/core/constants.js";

function defineBpmpiAuthenticate() {
  window.bpmpi_authenticate = function bpmpi_authenticate() {};
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function attachOnloadAndDefineBpmpi(scriptEl) {
  defineBpmpiAuthenticate();
  scriptEl.onload?.();
}

function spyAppendChildToTriggerOnload() {
  const original = document.body.appendChild.bind(document.body);
  vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
    const result = original(node);
    if (node.tagName === "SCRIPT" && node.id === MPI_SCRIPT_ELEMENT_ID) {
      queueMicrotask(() => attachOnloadAndDefineBpmpi(node));
    }
    return result;
  });
}

function spyAppendChildToTriggerError() {
  const original = document.body.appendChild.bind(document.body);
  vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
    const result = original(node);
    if (node.tagName === "SCRIPT" && node.id === MPI_SCRIPT_ELEMENT_ID) {
      queueMicrotask(() => node.onerror?.());
    }
    return result;
  });
}

beforeEach(() => {
  resetScriptLoaderForTests();
  document.body.innerHTML = "";
  delete window.bpmpi_authenticate;
  delete window.bpmpi_config;
});

afterEach(() => {
  vi.restoreAllMocks();
  resetScriptLoaderForTests();
  document.body.innerHTML = "";
  delete window.bpmpi_authenticate;
  delete window.bpmpi_config;
});

describe("adapters/mpi/script-loader — constantes", () => {
  it("defaults expostos", () => {
    expect(DEFAULT_SCRIPT_LOAD_ATTEMPTS).toBe(3);
    expect(DEFAULT_SCRIPT_RETRY_DELAY_MS).toBe(500);
  });
});

describe("adapters/mpi/script-loader — clearScriptLoadState (INVARIANTE)", () => {
  it("remove o <script> do DOM", () => {
    const script = document.createElement("script");
    script.id = MPI_SCRIPT_ELEMENT_ID;
    document.body.appendChild(script);
    expect(document.getElementById(MPI_SCRIPT_ELEMENT_ID)).toBeTruthy();

    clearScriptLoadState();

    expect(document.getElementById(MPI_SCRIPT_ELEMENT_ID)).toBeNull();
  });

  it("apaga window.bpmpi_authenticate e window.bpmpi_config", () => {
    window.bpmpi_authenticate = function () {};
    window.bpmpi_config = () => ({});

    clearScriptLoadState();

    expect(window.bpmpi_authenticate).toBeUndefined();
    expect(window.bpmpi_config).toBeUndefined();
  });

  it("em DOM limpo não throw (idempotente)", () => {
    expect(() => clearScriptLoadState()).not.toThrow();
    expect(() => clearScriptLoadState()).not.toThrow();
  });

  it("respeita target custom (isolated runtime)", () => {
    const fakeWindow = { bpmpi_authenticate: () => {}, bpmpi_config: () => ({}) };
    const fakeDoc = {
      getElementById: vi.fn(() => null),
    };

    clearScriptLoadState({ document: fakeDoc, window: fakeWindow });

    expect(fakeDoc.getElementById).toHaveBeenCalledWith(MPI_SCRIPT_ELEMENT_ID);
    expect(fakeWindow.bpmpi_authenticate).toBeUndefined();
    expect(fakeWindow.bpmpi_config).toBeUndefined();
  });

  it("zera cache: próximo load cria <script> novo", async () => {
    spyAppendChildToTriggerOnload();

    await loadThreeDsScript("sandbox");
    expect(document.getElementById(MPI_SCRIPT_ELEMENT_ID)).toBeTruthy();

    clearScriptLoadState();
    expect(document.getElementById(MPI_SCRIPT_ELEMENT_ID)).toBeNull();

    await loadThreeDsScript("sandbox");
    expect(document.getElementById(MPI_SCRIPT_ELEMENT_ID)).toBeTruthy();
  });
});

describe("adapters/mpi/script-loader — loadThreeDsScript", () => {
  it("resolve quando <script> carrega e bpmpi_authenticate aparece", async () => {
    spyAppendChildToTriggerOnload();

    await expect(loadThreeDsScript("sandbox")).resolves.toBeUndefined();
    expect(document.getElementById(MPI_SCRIPT_ELEMENT_ID)).toBeTruthy();
  });

  it("usa a URL de sandbox por padrão", async () => {
    spyAppendChildToTriggerOnload();
    await loadThreeDsScript("sandbox");
    const script = document.getElementById(MPI_SCRIPT_ELEMENT_ID);
    expect(script.src).toContain("mpisandbox.braspag.com.br");
  });

  it("usa a URL de production quando environment=production", async () => {
    spyAppendChildToTriggerOnload();
    await loadThreeDsScript("production");
    const script = document.getElementById(MPI_SCRIPT_ELEMENT_ID);
    expect(script.src).toContain("mpi.braspag.com.br");
    expect(script.src).not.toContain("sandbox");
  });

  it("scriptUrl custom sobrepõe o default", async () => {
    spyAppendChildToTriggerOnload();
    await loadThreeDsScript("sandbox", {
      scriptUrl: "https://custom.example.com/mpi.js",
    });
    const script = document.getElementById(MPI_SCRIPT_ELEMENT_ID);
    expect(script.src).toBe("https://custom.example.com/mpi.js");
  });

  it("retorna early se <script> já existe e bpmpi_authenticate já é função", async () => {
    const script = document.createElement("script");
    script.id = MPI_SCRIPT_ELEMENT_ID;
    document.body.appendChild(script);
    defineBpmpiAuthenticate();
    const spy = vi.spyOn(document.body, "appendChild");

    await loadThreeDsScript("sandbox");

    expect(spy).not.toHaveBeenCalled();
  });

  it("rejeita após N attempts quando onerror dispara em todos", async () => {
    spyAppendChildToTriggerError();

    await expect(
      loadThreeDsScript("sandbox", { attempts: 2, retryDelayMs: 0 }),
    ).rejects.toThrow(/Failed to load 3DS authentication script/);
  });

  it("entre falhas, chama clearScriptLoadState (FALHA → cleanup)", async () => {
    spyAppendChildToTriggerError();

    await loadThreeDsScript("sandbox", {
      attempts: 3,
      retryDelayMs: 0,
    }).catch(() => undefined);

    // após retries esgotados, DOM permanece limpo
    expect(document.getElementById(MPI_SCRIPT_ELEMENT_ID)).toBeNull();
  });

  it("retry: sucede no 2º attempt quando o 1º falha", async () => {
    let attempt = 0;
    const original = document.body.appendChild.bind(document.body);
    vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
      const result = original(node);
      if (node.tagName === "SCRIPT" && node.id === MPI_SCRIPT_ELEMENT_ID) {
        attempt++;
        if (attempt === 1) {
          queueMicrotask(() => node.onerror?.());
        } else {
          queueMicrotask(() => attachOnloadAndDefineBpmpi(node));
        }
      }
      return result;
    });

    await expect(
      loadThreeDsScript("sandbox", { attempts: 3, retryDelayMs: 0 }),
    ).resolves.toBeUndefined();
    expect(attempt).toBe(2);
  });

  it("2 chamadas concorrentes reaproveitam a mesma promise (não duplicam <script>)", async () => {
    spyAppendChildToTriggerOnload();
    const appendSpy = document.body.appendChild;

    const [r1, r2] = await Promise.all([
      loadThreeDsScript("sandbox"),
      loadThreeDsScript("sandbox"),
    ]);

    expect(r1).toBeUndefined();
    expect(r2).toBeUndefined();
    const scriptAppends = appendSpy.mock.calls.filter(
      ([node]) => node.tagName === "SCRIPT" && node.id === MPI_SCRIPT_ELEMENT_ID,
    );
    expect(scriptAppends).toHaveLength(1);
  });

  it("TIMEOUT: rejeita se bpmpi_authenticate nunca aparece após onload", async () => {
    vi.useFakeTimers();
    const original = document.body.appendChild.bind(document.body);
    vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
      const result = original(node);
      if (node.tagName === "SCRIPT" && node.id === MPI_SCRIPT_ELEMENT_ID) {
        // dispara onload mas NÃO define bpmpi_authenticate
        queueMicrotask(() => node.onload?.());
      }
      return result;
    });

    const promise = loadThreeDsScript("sandbox", {
      attempts: 1,
      retryDelayMs: 0,
    });
    const assertion = expect(promise).rejects.toThrow(/is not ready/);

    await vi.advanceTimersByTimeAsync(16000);
    await assertion;
    // após timeout, DOM limpo (cleanup foi chamado)
    expect(document.getElementById(MPI_SCRIPT_ELEMENT_ID)).toBeNull();
    vi.useRealTimers();
  });
});
