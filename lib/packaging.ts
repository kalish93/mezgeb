/**
 * Packaging conversions. Finished stock is held in one base unit (TUBA); every selling unit
 * is "N base units per 1 unit". Equivalents shown for a stock balance are derived from the
 * current conversions — they are never stored as separate balances.
 *
 * Amounts that are saved (stock deductions, totals) are computed in Postgres NUMERIC by the
 * API; these helpers are for validation, previews and display.
 */

export const UNIT_CODES = ['MADABERIYA_TIDOSH', 'PACKET', 'PIECE'] as const
export type UnitCode = (typeof UNIT_CODES)[number]
/** The product's own stock unit (TUBA for finished products, kg for raw cone). Factor is always 1. */
export const BASE = 'BASE'

export type Conversion = { unit_code: string; base_per_unit: number; label_am?: string; label_en?: string }

export function isValidFactor(factor: unknown): factor is number {
  return typeof factor === 'number' && Number.isFinite(factor) && factor > 0
}

export function assertValidFactor(factor: unknown): asserts factor is number {
  if (!isValidFactor(factor)) throw new Error('Conversion factor must be a number greater than zero')
}

// Fixed-point helpers so previews match what NUMERIC stores (3 decimals for quantities, 2 for money)
const fix = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places

/** quantity in a selling unit → base units (e.g. 2 Madaberiya × 600 = 1,200 TUBA). */
export function toBase(quantity: number, factor: number): number {
  assertValidFactor(factor)
  if (!(Number.isFinite(quantity) && quantity >= 0)) throw new Error('Quantity must be zero or more')
  return fix(quantity * factor, 3)
}

/** base units → how many of a selling unit (e.g. 1,200 TUBA ÷ 600 = 2 Madaberiya). */
export function fromBase(baseQuantity: number, factor: number): number {
  assertValidFactor(factor)
  return fix(baseQuantity / factor, 3)
}

/** Line total = quantity × price, where the price is per the SAME unit the quantity is in. */
export function lineTotal(quantity: number, unitPrice: number): number {
  return Math.round(Math.round(quantity * 1000) * Math.round(unitPrice * 100) / 1000) / 100
}

/** Derived equivalents of a base-unit balance, largest unit first. */
export function equivalents<C extends Conversion>(baseQuantity: number, conversions: C[]): (C & { amount: number })[] {
  return conversions
    .filter((c) => isValidFactor(c.base_per_unit))
    .sort((a, b) => b.base_per_unit - a.base_per_unit)
    .map((c) => ({ ...c, amount: fromBase(baseQuantity, c.base_per_unit) }))
}