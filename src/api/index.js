import { authenticate } from "../services/authenticate.js";
import { isLiabilityShiftToIssuer } from "../utils/eci.js";
import { isAuthenticated, toChallengeResult } from "./helpers.js";

export const Stark3DS = {
  authenticate,
  isLiabilityShiftToIssuer,
};

export {
  isAuthenticated,
  toChallengeResult,
  isLiabilityShiftToIssuer,
};

export {
  Stark3DSError,
  Stark3DSValidationError,
  Stark3DSAuthenticateTimeoutError,
} from "../core/errors.js";
