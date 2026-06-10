import { Stark3DSValidationError } from "../core/errors.js";

export function isAuthenticated(output) {
  return (
    output?.authentication?.status === "authenticated" &&
    output.challenge !== undefined
  );
}

export function toChallengeResult(output) {
  if (!output?.challenge) {
    throw new Stark3DSValidationError(
      `Cannot extract challenge: authentication status is ${output?.authentication?.status}`,
    );
  }
  return output.challenge;
}
