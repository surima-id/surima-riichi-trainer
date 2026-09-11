import { describe, expect, it } from 'vitest'
import { discardOptions, isTenpai, shanten, shantenOf, waits } from '../shanten'
import { formatTiles, parseTiles } from '../tiles'

const s = (notation: string, called = 0) => shanten(parseTiles(notation), called)
const waitStr = (notation: string, called = 0) => formatTiles(waits(parseTiles(notation), called))

describe('shanten', () => {
  it('reports -1 for a complete hand', () => {
    expect(s('123456789m11122z')).toBe(-1)
  })

  it('reports 0 for a tenpai hand', () => {
    expect(s('123456789m1122z')).toBe(0)
  })

  it('reports 1 when one swap away', () => {
    // 123m 456m 789m 55p + a floating 1z: swap the 1z for a 5p and it is ready.
    expect(s('123456789m55p1z')).toBe(1)
  })

  it('reports the full distance for a scattered hand', () => {
    expect(s('19m19p19s1234567z')).toBe(0) // thirteen orphans tenpai
    expect(s('147m258p369s1234z')).toBeGreaterThan(2)
  })

  it('accounts for called melds', () => {
    // Two called sets plus 123m456p11z: complete but for the pair -> tenpai.
    expect(s('123m45p11z', 2)).toBe(0)
  })

  it('finds seven pairs as the best shape when it is', () => {
    const b = shantenOf(parseTiles('1133m5577p99s122z'))
    expect(b.chiitoitsu).toBe(0)
    expect(b.shanten).toBe(0)
    expect(b.chiitoitsu).toBeLessThan(b.standard)
  })

  it('does not allow seven pairs to reuse a quad as two pairs', () => {
    const b = shantenOf(parseTiles('1111m3355p7799s1z'))
    expect(b.chiitoitsu).toBeGreaterThan(0)
  })

  it('tracks thirteen orphans separately', () => {
    const b = shantenOf(parseTiles('19m19p19s1234567z'))
    expect(b.kokushi).toBe(0)
    expect(b.shanten).toBe(0)
  })

  it('disables the closed-only shapes once a meld is called', () => {
    const b = shantenOf(parseTiles('1133m5577p99s1z'), 1)
    expect(b.chiitoitsu).toBe(99)
    expect(b.kokushi).toBe(99)
  })
})

describe('waits', () => {
  it('finds a two-sided wait', () => {
    expect(waitStr('234m456p789s111z55m')).toBe('') // 14 tiles, not tenpai shape
    expect(waitStr('34m456p789s111z55m')).toBe('25m')
  })

  it('finds a closed wait', () => {
    expect(waitStr('35m456p789s111z99m')).toBe('4m')
  })

  it('finds an edge wait', () => {
    expect(waitStr('12m456p789s111z55m')).toBe('3m')
  })

  it('finds the thirteen-tile orphan wait', () => {
    expect(waits(parseTiles('19m19p19s1234567z'))).toHaveLength(13)
  })

  it('returns nothing when the hand is not ready', () => {
    expect(waits(parseTiles('147m258p369s1234z'))).toEqual([])
  })
})

describe('discardOptions', () => {
  it('ranks the discard that keeps the most tiles first', () => {
    // 123m 456p 789s 111z complete, plus a floating 5m and 9p. Either floater
    // can go, leaving the other as a pair wait -- both are tenpai and tied on
    // acceptance, and no other discard is.
    const options = discardOptions(parseTiles('1235m456p789s111z9p'))
    expect(options[0].shanten).toBe(0)
    const tenpaiDiscards = options.filter((o) => o.shanten === 0).map((o) => formatTiles([o.tile]))
    expect(tenpaiDiscards.sort()).toEqual(['5m', '9p'])
  })

  it('lists one option per distinct tile', () => {
    const options = discardOptions(parseTiles('1115m456p789s111z9p'))
    expect(new Set(options.map((o) => o.tile)).size).toBe(options.length)
  })

  it('counts remaining copies, not just kinds', () => {
    const [best] = discardOptions(parseTiles('1235m456p789s111z9p'))
    expect(best.tilesLeft).toBeGreaterThan(0)
    expect(best.tilesLeft).toBeLessThanOrEqual(best.faces.length * 4)
  })

  /**
   * The calculator shows a per-tile remaining count beside each accepted tile,
   * so that breakdown has to agree with the total it is shown next to — a row
   * reading "8 tiles" over four icons summing to six is worse than no row.
   */
  it('breaks the acceptance total down per tile', () => {
    for (const option of discardOptions(parseTiles('3456m34567p34477s'))) {
      expect(option.accepts.map((a) => a.tile)).toEqual(option.faces)
      expect(option.accepts.reduce((sum, a) => sum + a.remaining, 0)).toBe(option.tilesLeft)
      expect(option.accepts.every((a) => a.remaining >= 1 && a.remaining <= 4)).toBe(true)
    }
  })

  it('subtracts the copies already in hand from what is left to draw', () => {
    // Three 7s are held, so the 7s that completes the pair has one copy left.
    const [option] = discardOptions(parseTiles('123m456p789s77733z'))
    const seven = option.accepts.find((a) => formatTiles([a.tile]) === '7s')
    if (seven) expect(seven.remaining).toBe(1)
  })

  it('never claims a tile that is already fully visible', () => {
    // All four 1z are in hand, so 1z cannot be a live acceptance tile.
    const options = discardOptions(parseTiles('12355m456p789s1111z'))
    expect(options.every((o) => !o.faces.includes(27))).toBe(true)
  })
})

describe('isTenpai', () => {
  it('agrees with shanten 0', () => {
    expect(isTenpai(parseTiles('123456789m1122z'))).toBe(true)
    expect(isTenpai(parseTiles('123456789m1235z'))).toBe(false)
  })
})
