/**
 * @param {{ environment?: "sandbox" | "production" }} config
 * @param {"sandbox" | "production"} [inputEnvironment]
 * @returns {"sandbox" | "production"}
 */
export function resolveEnvironment(config, inputEnvironment) {
  if (inputEnvironment) return inputEnvironment;
  if (config.environment) return config.environment;
  return "sandbox";
}

/**
 * @param {object} config
 * @param {"sandbox" | "production"} [inputEnvironment]
 */
export function withResolvedEnvironment(config, inputEnvironment) {
  return {
    ...config,
    environment: resolveEnvironment(config, inputEnvironment),
  };
}
