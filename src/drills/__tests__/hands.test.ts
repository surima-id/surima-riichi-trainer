import { describe, expect, it } from 'vitest'
import { buildRandomHand, buildScoringHand } from '../hands'
import { makeRng } from '../random'
import { scoreHandFull } from '../../engine/explain'
import { decompose } from '../../engine/parse'
import { isSimple, toCounts } from '../../engine/tiles'

describe('makeRng', () => {
  it('is deterministic for a given seed', () => {
    const a = makeRng(42)
    const b = makeRng(42)
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()])
  })

  it('produces different streams for different seeds', () => {
    expect(makeRng(1).next()).not.toBe(makeRng(2).next())
  })
})

describe('buildRandomHand', () => {
  it('always produces a decomposable hand', () => {
    for (let seed = 0; seed < 200; seed++) {
      const built = buildRandomHand(makeRng(seed))
      if (!built) continue
      expect(decompose(built.hand).length).toBeGreaterThan(0)
    }
  })

  /**
   * Three, not the legal four: a fourth copy splits across a triplet and a run
   * and gives the hand several readings, which is more than a drill should ask
   * of a beginner.
   */
  it('never uses more than three copies of a tile', () => {
    for (let seed = 0; seed < 200; seed++) {
      const built = buildRandomHand(makeRng(seed))
      if (!built) continue
      const all = [...built.hand.concealed, ...built.hand.calls.flatMap((c) => c.tiles)]
      expect(Math.max(...toCounts(all))).toBeLessThanOrEqual(3)
    }
  })

  it('allows the fourth copy when a caller asks for it', () => {
    let sawQuad = false
    for (let seed = 0; seed < 200 && !sawQuad; seed++) {
      const built = buildRandomHand(makeRng(seed), { maxCopies: 4 })
      if (!built) continue
      const all = [...built.hand.concealed, ...built.hand.calls.flatMap((c) => c.tiles)]
      const max = Math.max(...toCounts(all))
      expect(max).toBeLessThanOrEqual(4)
      if (max === 4) sawQuad = true
    }
    expect(sawQuad, 'maxCopies: 4 never actually dealt a fourth copy').toBe(true)
  })

  it('honours a tile filter', () => {
    for (let seed = 0; seed < 50; seed++) {
      const built = buildRandomHand(makeRng(seed), { tileFilter: isSimple })
      if (!built) continue
      const all = [...built.hand.concealed, ...built.hand.calls.flatMap((c) => c.tiles)]
      expect(all.every(isSimple)).toBe(true)
    }
  })

  it('exposes the requested number of called melds', () => {
    const built = buildRandomHand(makeRng(7), { openMelds: 2 })
    expect(built?.hand.calls).toHaveLength(2)
  })

  it('is reproducible from its seed', () => {
    const a = buildRandomHand(makeRng(123))
    const b = buildRandomHand(makeRng(123))
    expect(a?.hand.concealed).toEqual(b?.hand.concealed)
  })
})

describe('buildScoringHand', () => {
  it('only returns hands the engine will actually score', () => {
    for (let seed = 0; seed < 60; seed++) {
      const built = buildScoringHand(makeRng(seed))
      if (!built) continue
      const scored = scoreHandFull(built.hand, built.context, { dealer: built.dealer })
      expect(scored.valid).toBe(true)
      expect(scored.yaku.length).toBeGreaterThan(0)
    }
  })

  it('builds a scoring all-simples hand when constrained to simples', () => {
    const built = buildScoringHand(makeRng(11), { tileFilter: isSimple })
    expect(built).not.toBeNull()
    const scored = scoreHandFull(built!.hand, built!.context, { dealer: built!.dealer })
    expect(scored.yaku.map((y) => y.id)).toContain('tanyao')
  })
})
