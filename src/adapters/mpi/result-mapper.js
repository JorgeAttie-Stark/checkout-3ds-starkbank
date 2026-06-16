/**
 * @param {object} payload
 * @returns {{ status: "authenticated", cavv: string, eci: string, xid: string | null, version: string, referenceId: string }}
 */
export function mapSuccess(payload) {
  return {
    status: "authenticated",
    cavv: payload.Cavv ?? "",
    eci: payload.Eci ?? "",
    xid: payload.Xid ?? null,
    version: payload.Version ?? "",
    referenceId: payload.ReferenceId ?? "",
  };
}

/**
 * @param {"failed" | "unenrolled" | "error" | "unsupported_brand"} status
 * @param {object} payload
 * @returns {object}
 */
export function mapFailure(status, payload) {
  return {
    status,
    eci: payload.Eci,
    xid: payload.Xid ?? null,
    version: payload.Version,
    referenceId: payload.ReferenceId ?? null,
    returnCode: payload.ReturnCode,
    returnMessage: payload.ReturnMessage,
  };
}

/**
 * @returns {{ status: "disabled" }}
 */
export function mapDisabled() {
  return { status: "disabled" };
}
