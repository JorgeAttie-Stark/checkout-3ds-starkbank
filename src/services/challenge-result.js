/**
 * @param {object} authentication
 * @param {string} orderNumber
 * @returns {{ cavv: string, eci: string, version: string, xid: string | null, referenceId: string }}
 */
export function buildChallengeResult(authentication, orderNumber) {
  return {
    cavv: authentication.cavv,
    eci: authentication.eci,
    version: authentication.version,
    xid: authentication.xid ?? null,
    referenceId: authentication.referenceId?.trim() || orderNumber,
  };
}
