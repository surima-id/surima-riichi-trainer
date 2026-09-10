import { describe, expect, it } from 'vitest'
import {
  CHUN,
  EAST,
  HAKU,
  doraFromIndicator,
  formatTiles,
  isGreen,
  isRed,
  isTerminalOrHonor,
  describeTile,
  parseTiles,
  rankOf,
  sortTiles,
  suitOf,
  toCounts,
} from '../tiles'

describe('notation', () => {
  it('round-trips a mixed hand', () => {
    const notation = '123m456p789s11z'
    expect(formatTiles(parseTiles(notation))).toBe(notation)
  })

  it('reads 0 as the red five', () => {
    const [tile] = parseTiles('0m')
    expect(isRed(tile)).toBe(true)
    expect(rankOf(tile)).toBe(5)
    expect(suitOf(tile)).toBe('m')
    expect(formatTiles([tile])).toBe('0m')
  })

  it('counts a red five in the same slot as a normal five', () => {
    const counts = toCounts(parseTiles('05m'))
    expect(counts[4]).toBe(2)
  })

  it('rejects malformed input with a coded error', () => {
    // Asserting the code rather than a message keeps this test honest in any
    // language, and is a stronger claim than "it threw something".
    expect(() => parseTiles('123')).toThrow(expect.objectContaining({ code: 'trailing-digits' }))
    expect(() => parseTiles('m123')).toThrow(
      expect.objectContaining({ code: 'suit-without-digits' }),
    )
    expect(() => parseTiles('8z')).toThrow(
      expect.objectContaining({ code: 'honor-out-of-range' }),
    )
    expect(() => parseTiles('12x')).toThrow(expect.objectContaining({ code: 'unexpected-char' }))
  })
})

describe('tile classification', () => {
  it('treats honors and 1/9 as terminal-or-honor, but not 2..8', () => {
    expect(parseTiles('19m19p19s1234567z').every(isTerminalOrHonor)).toBe(true)
    expect(parseTiles('2345678m').some(isTerminalOrHonor)).toBe(false)
  })

  it('identifies green tiles for ryuuiisou', () => {
    expect(parseTiles('23468s6z').every(isGreen)).toBe(true)
    expect(parseTiles('157s5z').some(isGreen)).toBe(false)
  })

  it('describes a tile as naming parts, leaving the words to the UI', () => {
    expect(describeTile(parseTiles('0s')[0])).toEqual({
      kind: 'suited',
      suit: 's',
      rank: 5,
      red: true,
    })
    expect(describeTile(EAST)).toEqual({ kind: 'honor', honor: 'east' })
  })
})

describe('dora indicators', () => {
  it('advances within a suit', () => {
    expect(doraFromIndicator(parseTiles('3m')[0])).toBe(parseTiles('4m')[0])
  })

  it('wraps 9 back to 1', () => {
    expect(doraFromIndicator(parseTiles('9p')[0])).toBe(parseTiles('1p')[0])
  })

  it('wraps North back to East and Chun back to Haku', () => {
    expect(doraFromIndicator(parseTiles('4z')[0])).toBe(EAST)
    expect(doraFromIndicator(CHUN)).toBe(HAKU)
  })
})

describe('sortTiles', () => {
  it('orders by face and puts the red five first', () => {
    expect(formatTiles(sortTiles(parseTiles('9m1z5m0m')))).toBe('059m1z')
  })
})
