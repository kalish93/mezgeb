import { describe, expect, it } from 'vitest'
import { ethiopianMonth, previousEthiopianMonth } from '@/lib/format'

const at = (s: string) => new Date(`${s}T09:00:00`)

describe('Ethiopian month bounds', () => {
  it('ጥቅምት 2019 runs 11 Oct – 9 Nov 2026', () => {
    expect(ethiopianMonth(at('2026-10-22'))).toMatchObject({ from: '2026-10-11', to: '2026-11-09', name_am: 'ጥቅምት' })
    expect(ethiopianMonth(at('2026-10-11')).from).toBe('2026-10-11') // first day
    expect(ethiopianMonth(at('2026-11-09')).to).toBe('2026-11-09')   // last day
    expect(ethiopianMonth(at('2026-11-10')).name_am).toBe('ኅዳር')     // next month starts
  })

  it('the previous month of ጥቅምት is መስከረም (11 Sep – 10 Oct 2026)', () => {
    expect(previousEthiopianMonth(at('2026-10-22'))).toMatchObject({ from: '2026-09-11', to: '2026-10-10', name_am: 'መስከረም' })
  })

  it('ጳጉሜን has 5 days, or 6 in a leap year', () => {
    expect(ethiopianMonth(at('2026-09-08'))).toMatchObject({ from: '2026-09-06', to: '2026-09-10' })
    expect(ethiopianMonth(at('2027-09-08'))).toMatchObject({ from: '2027-09-06', to: '2027-09-11' })
  })
})
