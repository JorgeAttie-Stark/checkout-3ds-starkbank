const LIABILITY_SHIFT_ECIS = new Set(["01", "02", "05"]);

export function isLiabilityShiftToIssuer(eci) {
  if (!eci) return false;
  const normalized = String(eci).padStart(2, "0");
  return LIABILITY_SHIFT_ECIS.has(normalized);
}
