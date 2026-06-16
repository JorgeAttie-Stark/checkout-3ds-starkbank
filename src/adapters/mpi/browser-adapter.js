import { buildMpiContainer, removeMpiContainer } from "./class-mapper.js";
import {
  clearScriptLoadState,
  loadThreeDsScript,
} from "./script-loader.js";
import { mapDisabled, mapFailure, mapSuccess } from "./result-mapper.js";
import { createIsolatedRuntime } from "./isolated-runtime.js";
import { Stark3DSAuthenticateTimeoutError } from "../../core/errors.js";
import { DEFAULT_AUTHENTICATE_TIMEOUT_MS } from "../../core/constants.js";

function toProviderEnvironment(environment) {
  return environment === "sandbox" ? "SDB" : "PRD";
}

/**
 * Adapter Braspag MPI. Uso destinado a chamadas serializadas (via service +
 * authenticate-queue) — chamadas paralelas conflitam em `window.bpmpi_config`.
 */
export class BrowserMpiAdapter {
  constructor(options) {
    this.options = options;
  }

  /**
   * @param {object} input
   * @returns {Promise<{status: string, [key: string]: unknown}>}
   */
  authenticate(input) {
    const {
      environment,
      debug,
      authenticateTimeoutMs,
      scriptLoadAttempts,
      scriptRetryDelayMs,
      threeDsScriptUrl,
      isolateRuntime,
    } = this.options;

    const timeoutMs = authenticateTimeoutMs ?? DEFAULT_AUTHENTICATE_TIMEOUT_MS;
    const useIsolation = isolateRuntime !== false;

    let container = null;
    let runtime = null;
    let settled = false;
    let timeoutTimer = null;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      if (timeoutTimer !== null) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
      removeMpiContainer(container);
      clearScriptLoadState(
        runtime ? { document: runtime.document, window: runtime.window } : undefined,
      );
      runtime?.destroy();
      runtime = null;
    };

    return new Promise((resolve, reject) => {
      const finish = (result) => {
        cleanup();
        resolve(result);
      };

      const fail = (err) => {
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err)));
      };

      let doc = document;
      let win = window;

      try {
        if (useIsolation) {
          runtime = createIsolatedRuntime();
          doc = runtime.document;
          win = runtime.window;
        }
      } catch (err) {
        fail(err);
        return;
      }

      const handlers = {
        Environment: toProviderEnvironment(environment),
        Debug: debug ?? false,
        onReady: () => {
          try {
            win.bpmpi_authenticate?.();
          } catch (err) {
            fail(err);
          }
        },
        onSuccess: (e) => finish(mapSuccess(e)),
        onFailure: (e) => finish(mapFailure("failed", e)),
        onUnenrolled: (e) => finish(mapFailure("unenrolled", e)),
        onDisabled: () => finish(mapDisabled()),
        onError: (e) => finish(mapFailure("error", e)),
        onUnsupportedBrand: (e) => finish(mapFailure("unsupported_brand", e)),
      };

      try {
        container = buildMpiContainer(input, doc);
        doc.body.appendChild(container);
        win.bpmpi_config = () => handlers;
      } catch (err) {
        fail(err);
        return;
      }

      if (timeoutMs > 0) {
        timeoutTimer = setTimeout(() => {
          fail(
            new Stark3DSAuthenticateTimeoutError(
              `3DS authentication timed out after ${timeoutMs}ms`,
            ),
          );
        }, timeoutMs);
      }

      loadThreeDsScript(environment, {
        attempts: scriptLoadAttempts,
        retryDelayMs: scriptRetryDelayMs,
        scriptUrl: threeDsScriptUrl,
        target: useIsolation ? { document: doc, window: win } : undefined,
      }).catch(fail);
    });
  }
}
