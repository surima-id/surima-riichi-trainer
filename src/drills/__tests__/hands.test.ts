import { describe, expect, it } from 'vitest'
import { buildRandomHand, buildScoringHand, buildThirteenOrphans } from '../hands'
import { makeRng } from '../random'
import { scoreHandFull } from '../../engine/explain'
import { decompose } from '../../engine/parse'
import { face, isRed, isSimple, isTerminalOrHonor, rankOf, toCounts } from '../../engine/tiles'

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

  /**
   * A kan is four copies of one tile, so it is the one shape that legitimately
   * needs the fourth copy the three-copy cap otherwise withholds.
   */
  it('builds a kan as four copies of a tile', () => {
    let built = null
    for (let seed = 0; seed < 200 && !built; seed++) {
      built = buildRandomHand(makeRng(seed), { kans: 1 })
    }
    expect(built).not.toBeNull()
    const kan = built!.hand.calls.find((c) => c.kind === 'ankan' || c.kind === 'minkan')
    expect(kan, 'asked for a kan and got none').toBeDefined()
    expect(kan!.tiles).toHaveLength(4)
    expect(new Set(kan!.tiles.map(face)).size, 'a kan must be four of one face').toBe(1)
  })

  /**
   * A closed kan is declared on the table but does not open the hand — riichi
   * and the other closed-only yaku survive it. Deriving `menzen` from the calls
   * rather than from their count is what keeps that true.
   */
  it('keeps a hand closed around a closed kan, and open around an open one', () => {
    for (let seed = 0; seed < 200; seed++) {
      const closed = buildRandomHand(makeRng(seed), { kans: 1 })
      if (closed) {
        expect(closed.hand.calls.every((c) => c.kind === 'ankan')).toBe(true)
        expect(closed.context.menzen, `seed ${seed}: a closed kan opened the hand`).toBe(true)
      }
      const open = buildRandomHand(makeRng(seed), { kans: 1, openMelds: 1 })
      if (open) {
        expect(open.hand.calls.some((c) => c.kind === 'minkan')).toBe(true)
        expect(open.context.menzen, `seed ${seed}: an open kan left the hand closed`).toBe(false)
      }
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

describe('buildRandomHand slot options', () => {
  it('places every named triplet', () => {
    // Daisuushii: all four winds, which is also the case that forced the
    // reservation pass — a random triplet spending a wind first leaves the
    // recipe unbuildable under a three-copy cap.
    const built = buildRandomHand(makeRng(5), { fixedTriplets: [27, 28, 29, 30], triplets: 4 })
    expect(built).not.toBeNull()
    const counts = toCounts([...built!.hand.concealed, ...built!.hand.calls.flatMap((c) => c.tiles)])
    for (const wind of [27, 28, 29, 30]) expect(counts[wind]).toBeGreaterThanOrEqual(3)
  })

  it('places every named run, repeats included', () => {
    // Iipeiko: the same run twice, which a filter cannot express.
    const built = buildRandomHand(makeRng(9), { fixedRuns: [3, 3], triplets: 0 })
    expect(built).not.toBeNull()
    const counts = toCounts(built!.hand.concealed)
    for (const offset of [0, 1, 2]) expect(counts[3 + offset]).toBeGreaterThanOrEqual(2)
  })

  it('honours the named pair', () => {
    const built = buildRandomHand(makeRng(3), { fixedPair: 31, triplets: 1 })
    expect(built).not.toBeNull()
    const counts = toCounts(built!.hand.concealed)
    expect(counts[31]).toBeGreaterThanOrEqual(2)
  })

  it('constrains runs by their start, so chanta can still hold runs', () => {
    // The bug this guards: a terminal-or-honor `tileFilter` rejects the 2 in
    // the middle of 123 and so bans runs outright, turning chanta into
    // honroutou every time.
    let sawRun = false
    for (let seed = 0; seed < 60 && !sawRun; seed++) {
      const built = buildRandomHand(makeRng(seed), {
        triplets: 2,
        runStartFilter: (s) => s % 9 === 0 || s % 9 === 6,
        tripletFilter: isTerminalOrHonor,
        pairFilter: isTerminalOrHonor,
      })
      if (!built) continue
      const counts = toCounts(built.hand.concealed)
      // A run is present when three consecutive ranks each appear.
      for (let f = 0; f < 25 && !sawRun; f++) {
        if (f % 9 > 6) continue
        if (counts[f] > 0 && counts[f + 1] > 0 && counts[f + 2] > 0) sawRun = true
      }
    }
    expect(sawRun, 'a run-start filter never produced a run').toBe(true)
  })

  it('deals at most one red five per suit', () => {
    for (let seed = 0; seed < 120; seed++) {
      const built = buildRandomHand(makeRng(seed), { redFives: 3 })
      if (!built) continue
      const all = [...built.hand.concealed, ...built.hand.calls.flatMap((c) => c.tiles)]
      const reds = all.filter(isRed)
      // Only three red fives exist, one per numbered suit.
      expect(reds.length).toBeLessThanOrEqual(3)
      expect(new Set(reds.map(face)).size).toBe(reds.length)
      for (const tile of reds) expect(rankOf(tile)).toBe(5)
    }
  })

  it('keeps a called meld parseable when it holds a red five', () => {
    // `call.tile` is a face index; the red bit leaking into it would make the
    // meld parse as a face that does not exist.
    for (let seed = 0; seed < 120; seed++) {
      const built = buildRandomHand(makeRng(seed), { redFives: 1, openMelds: 2 })
      if (!built) continue
      for (const call of built.hand.calls) expect(call.tile).toBeLessThan(34)
      expect(decompose(built.hand).length).toBeGreaterThan(0)
    }
  })
})

describe('buildThirteenOrphans', () => {
  it('scores as a yakuman', () => {
    for (let seed = 0; seed < 30; seed++) {
      const built = buildThirteenOrphans(makeRng(seed))
      const scored = scoreHandFull(built.hand, built.context, { dealer: built.dealer })
      expect(scored.valid).toBe(true)
      expect(scored.yakuman).toBeGreaterThan(0)
      expect(scored.yaku.some((y) => y.id === 'kokushi')).toBe(true)
    }
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
