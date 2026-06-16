import {
  MPI_SCRIPT_ELEMENT_ID,
  getMpiScriptUrl,
} from "../../core/constants.js";

export const DEFAULT_SCRIPT_LOAD_ATTEMPTS = 3;
export const DEFAULT_SCRIPT_RETRY_DELAY_MS = 500;
const SCRIPT_READY_TIMEOUT_MS = 15000;

let loadPromise = null;
let activeTargetKey = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveTarget(target) {
  if (target) return target;
  if (typeof document === "undefined" || typeof window === "undefined") {
    throw new Error("3DS script can only load in a browser");
  }
  return { document, window };
}

function targetKey(target) {
  return typeof document !== "undefined" && target.document === document
    ? "host"
    : "isolated";
}

function clearScriptGlobal(win, name) {
  if (Reflect.deleteProperty(win, name)) return;
  try {
    win[name] = undefined;
  } catch {
    // global é não-configurável — não há como remover, mantém referência
  }
}

/**
 * Reset completo após cada authenticate (ou retry): remove o <script>, zera o
 * cache do loader e apaga os globals do provider. Sem isso, a próxima chamada
 * a `authenticate()` trava silenciosamente (script Braspag é single-session).
 *
 * @param {{ document: Document, window: Window }} [target]
 */
export function clearScriptLoadState(target) {
  loadPromise = null;
  activeTargetKey = null;
  const { document: doc, window: win } = resolveTarget(target);
  doc.getElementById(MPI_SCRIPT_ELEMENT_ID)?.remove();
  clearScriptGlobal(win, "bpmpi_authenticate");
  clearScriptGlobal(win, "bpmpi_config");
}

function waitForScriptReady(win, timeoutMs = SCRIPT_READY_TIMEOUT_MS) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (typeof win.bpmpi_authenticate === "function") {
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error("Stark 3DS authentication script is not ready"));
        return;
      }
      if (typeof win.requestAnimationFrame === "function") {
        win.requestAnimationFrame(tick);
      } else {
        setTimeout(tick, 16);
      }
    };
    tick();
  });
}

function loadScriptOnce(environment, options) {
  const target = resolveTarget(options.target);
  const key = targetKey(target);
  const scriptUrl = options.scriptUrl ?? getMpiScriptUrl(environment);

  if (target.document.getElementById(MPI_SCRIPT_ELEMENT_ID)) {
    if (typeof target.window.bpmpi_authenticate === "function") {
      return Promise.resolve();
    }
    return waitForScriptReady(target.window);
  }

  if (loadPromise && activeTargetKey === key) {
    return loadPromise;
  }

  activeTargetKey = key;
  loadPromise = new Promise((resolve, reject) => {
    const script = target.document.createElement("script");
    script.id = MPI_SCRIPT_ELEMENT_ID;
    script.src = scriptUrl;
    script.type = "text/javascript";
    script.async = true;
    script.onload = () => {
      waitForScriptReady(target.window).then(resolve).catch(reject);
    };
    script.onerror = () => {
      loadPromise = null;
      activeTargetKey = null;
      reject(
        new Error(
          `Failed to load 3DS authentication script from ${scriptUrl}. Check network, CSP script-src, and environment.`,
        ),
      );
    };
    target.document.body.appendChild(script);
  });

  return loadPromise;
}

/**
 * @param {"sandbox" | "production"} environment
 * @param {{ attempts?: number, retryDelayMs?: number, scriptUrl?: string, target?: { document: Document, window: Window } }} [options]
 * @returns {Promise<void>}
 */
export async function loadThreeDsScript(environment, options = {}) {
  const attempts = options.attempts ?? DEFAULT_SCRIPT_LOAD_ATTEMPTS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_SCRIPT_RETRY_DELAY_MS;

  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await loadScriptOnce(environment, options);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      clearScriptLoadState(options.target);
      if (attempt < attempts - 1 && retryDelayMs > 0) {
        await sleep(retryDelayMs);
      }
    }
  }

  throw (
    lastError ??
    new Error("Failed to load 3DS authentication script after all retry attempts")
  );
}

/** @internal */
export function resetScriptLoaderForTests() {
  clearScriptLoadState();
}
