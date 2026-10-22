import { describe, expect, it } from 'vitest'
import { equivalents, fromBase, isValidFactor, lineTotal, toBase } from '@/lib/packaging'
import { conversionsFor, seedData } from '../../scripts/seed-products.mjs'

const seed = (code: string) => {
  const p = seedData().products.find((x) => x.code === code)
  if (!p) throw new Error(`no seed product ${code}`)
  return conversionsFor(p)
}

describe('seeded packaging conversions (db/seeds/products.json)', () => {
  it('Menen: 1 packet = 30 TUBA, 1 Madaberiya/Tidosh = 600 TUBA, 150 pieces = 600 TUBA', () => {
    const c = seed('MENEN')
    expect(toBase(1, c.PACKET)).toBe(30)
    expect(toBase(1, c.MADABERIYA_TIDOSH)).toBe(600)
    expect(toBase(150, c.PIECE)).toBe(600)
    expect(fromBase(c.MADABERIYA_TIDOSH, c.PACKET)).toBe(20) // 20 packets per Madaberiya
  })

  it('PC and Black PC: 1 Madaberiya/Tidosh = 400 TUBA (= 100 pieces)', () => {
    for (const code of ['PC', 'BLACK_PC']) {
      const c = seed(code)
      expect(toBase(1, c.MADABERIYA_TIDOSH)).toBe(400)
      expect(toBase(1, c.PACKET)).toBe(20)
      expect(fromBase(c.MADABERIYA_TIDOSH, c.PIECE)).toBe(100)
    }
  })

  it('Cotton: 1 Madaberiya/Tidosh = 200 TUBA, 50 pieces = 200 TUBA, 10 packets per Madaberiya', () => {
    const c = seed('COTTON')
    expect(toBase(1, c.MADABERIYA_TIDOSH)).toBe(200)
    expect(toBase(50, c.PIECE)).toBe(200)
    expect(fromBase(c.MADABERIYA_TIDOSH, c.PACKET)).toBe(10)
  })

  it('the seed table rejects zero or negative values', () => {
    const bad = { code: 'X', name_am: 'x', name_en: 'x', tubaPerPacket: 0, packetsPerMadaberiya: 20, tubaPerPiece: 4 }
    expect(() => conversionsFor(bad)).toThrow()
    expect(() => conversionsFor({ ...bad, tubaPerPacket: 20, tubaPerPiece: -4 })).toThrow()
  })
})

describe('conversion helpers', () => {
  it('rejects invalid, zero and negative factors', () => {
    for (const f of [0, -1, -600, Number.NaN, Number.POSITIVE_INFINITY, '600' as unknown as number]) {
      expect(isValidFactor(f)).toBe(false)
      expect(() => toBase(1, f)).toThrow()
    }
    expect(isValidFactor(0.5)).toBe(true)
  })

  it('rejects negative quantities', () => {
    expect(() => toBase(-1, 600)).toThrow()
  })

  it('equivalents are derived from the TUBA balance (1,200 TUBA of Menen = 2 Madaberiya = 40 packets = 300 pieces)', () => {
    const c = seed('MENEN')
    const eq = equivalents(1200, [
      { unit_code: 'PIECE', base_per_unit: c.PIECE },
      { unit_code: 'MADABERIYA_TIDOSH', base_per_unit: c.MADABERIYA_TIDOSH },
      { unit_code: 'PACKET', base_per_unit: c.PACKET },
    ])
    expect(eq.map((e) => [e.unit_code, e.amount])).toEqual([['MADABERIYA_TIDOSH', 2], ['PACKET', 40], ['PIECE', 300]])
  })

  it('line totals use the price of the selected unit, with exact cents', () => {
    expect(lineTotal(2, 15000)).toBe(30000)  // 2 Madaberiya × 15,000 per Madaberiya
    expect(lineTotal(3, 0.1)).toBe(0.3)      // no 0.30000000000000004
    expect(lineTotal(1.5, 333.33)).toBe(500) // 499.995 → 500.00
  })
})
