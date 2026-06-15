import { validateAuthenticateInput } from "../validation/input.js";
import { withResolvedEnvironment } from "../config/environment.js";
import { withAuthenticateTimeout } from "../utils/timeout.js";
import { enqueueAuthenticate } from "../utils/auth-queue.js";
import { DEFAULT_AUTHENTICATE_TIMEOUT_MS } from "../core/constants.js";
import { getEffectiveConfig } from "./config-store.js";
import { getAdapterFactory } from "./adapter-factory.js";
import { buildChallengeResult } from "./challenge-result.js";

/**
 * @param {object} input
 * @returns {Promise<{ authentication: object, challenge?: object }>}
 */
export async function authenticate(input) {
  const config = getEffectiveConfig();

  return enqueueAuthenticate(async () => {
    validateAuthenticateInput(input);

    const runtimeConfig = withResolvedEnvironment(config, input.environment);
    const adapter = getAdapterFactory()(runtimeConfig);

    const authentication = await withAuthenticateTimeout(
      adapter.authenticate(input),
      config.authenticateTimeoutMs ?? DEFAULT_AUTHENTICATE_TIMEOUT_MS,
    );

    const output = { authentication };
    if (authentication.status === "authenticated") {
      output.challenge = buildChallengeResult(authentication, input.order.number);
    }
    return output;
  });
}
