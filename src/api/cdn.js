import { authenticate } from "../services/authenticate.js";
import { isLiabilityShiftToIssuer } from "../utils/eci.js";
import { isAuthenticated, toChallengeResult } from "./helpers.js";
import {
  Stark3DSError,
  Stark3DSValidationError,
  Stark3DSAuthenticateTimeoutError,
} from "../core/errors.js";

const Stark3DS = {
  authenticate,
  isLiabilityShiftToIssuer,
};

export default Object.assign(Stark3DS, {
  Error: Stark3DSError,
  ValidationError: Stark3DSValidationError,
  AuthenticateTimeoutError: Stark3DSAuthenticateTimeoutError,
  isLiabilityShiftToIssuer,
  isAuthenticated,
  toChallengeResult,
});
