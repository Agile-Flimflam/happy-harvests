export function normalizeDtm(
  dsMinRaw: number | null | undefined,
  dsMaxRaw: number | null | undefined,
  tpMinRaw: number | null | undefined,
  tpMaxRaw: number | null | undefined,
): { dsMin: number; dsMax: number; tpMin: number; tpMax: number } {
  const dsm = dsMinRaw ?? 0
  const dMx = dsMaxRaw ?? 0
  const tpm = tpMinRaw ?? 0
  const tMx = tpMaxRaw ?? 0
  const dsMin = dsm > 0 ? dsm : (dMx > 0 ? dMx : 0)
  const tpMin = tpm > 0 ? tpm : (tMx > 0 ? tMx : 0)
  const dsMax = dMx > 0 ? dMx : dsMin
  const tpMax = tMx > 0 ? tMx : tpMin
  return { dsMin, dsMax, tpMin, tpMax }
}


