import { describe, expect, it } from 'vitest'
import { parseHand } from '../Ukeire'
import { discardOptions } from '../../engine/shanten'
import { formatTiles, parseTiles } from '../../engine/tiles'

/**
 * The calculator is the one place a player's own text reaches the engine, so
 * this is the boundary that has to reject an impossible hand rather than
 * analyse it and print a confident wrong answer.
 */
describe('parseHand', () => {
  it('accepts a fourteen-tile hand and sorts it', () => {
    const parsed = parseHand('34477s3456m34567p')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.tiles).toHaveLength(14)
    expect(formatTiles(parsed.tiles)).toBe('3456m34567p34477s')
  })

  it('ignores surrounding whitespace', () => {
    expect(parseHand('  3456m34567p34477s  ').ok).toBe(true)
  })

  it('rejects a hand that is not a discard decision', () => {
    // Thirteen tiles is a legal hand, but nothing has been drawn to throw.
    const parsed = parseHand('3456m34567p3477s')
    expect(parsed.ok).toBe(false)
    if (parsed.ok || 'notation' in parsed) throw new Error('expected a count error')
    expect(parsed.error).toBe('ukeire.errorCount')
    expect(parsed.params).toEqual({ n: 13 })
  })

  it('rejects a fifth copy of a tile, which does not exist', () => {
    const parsed = parseHand('11111m456p789s234s')
    expect(parsed.ok).toBe(false)
    if (parsed.ok || 'notation' in parsed) throw new Error('expected a copies error')
    expect(parsed.error).toBe('ukeire.errorFive')
  })

  it('reports empty input as its own case rather than as bad notation', () => {
    const parsed = parseHand('   ')
    expect(parsed.ok).toBe(false)
    if (parsed.ok || 'notation' in parsed) throw new Error('expected an empty error')
    expect(parsed.error).toBe('ukeire.errorEmpty')
  })

  it('passes malformed notation back with the engine error that explains it', () => {
    const parsed = parseHand('123x')
    expect(parsed.ok).toBe(false)
    if (parsed.ok || !('notation' in parsed)) throw new Error('expected a notation error')
    expect(parsed.notation.code).toBe('unexpected-char')
  })
})

/**
 * The panel's headline sentence names `options[0]`, so that row has to be one
 * of the genuinely best discards rather than merely the first the sort emitted.
 */
describe('the ranking the calculator displays', () => {
  it('leads with a discard no other discard beats', () => {
    for (const hand of ['3456m34567p34477s', '1235m456p789s111z9p', '19m19p19s1234567z1m']) {
      const options = discardOptions(parseTiles(hand))
      const [best] = options
      for (const option of options) {
        const better =
          option.shanten < best.shanten ||
          (option.shanten === best.shanten && option.tilesLeft > best.tilesLeft)
        expect(better, `${hand}: ${formatTiles([option.tile])} beats the first row`).toBe(false)
      }
    }
  })
})
