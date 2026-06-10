export class Stark3DSError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "Stark3DSError";
    this.code = code;
  }
}

export class Stark3DSValidationError extends Stark3DSError {
  constructor(message) {
    super(message, "VALIDATION_ERROR");
    this.name = "Stark3DSValidationError";
  }
}

export class Stark3DSAuthenticateTimeoutError extends Stark3DSError {
  constructor(message) {
    super(message, "AUTHENTICATE_TIMEOUT");
    this.name = "Stark3DSAuthenticateTimeoutError";
  }
}
