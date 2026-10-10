// Numbers utilities: IEEE 754 precision safeguards

export function round3(val: number): number {
  return Math.round((val + Number.EPSILON) * 1000) / 1000;
}

export function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function toDecimal(val: number | string | { toNumber?: () => number } | null | undefined): number {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val) || 0;
  if (typeof val.toNumber === 'function') return val.toNumber();
  return Number(val) || 0;
}
