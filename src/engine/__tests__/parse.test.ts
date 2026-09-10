import { describe, expect, it } from 'vitest'
import { type Hand, decompose, isWinningHand, waitInterpretations } from '../parse'
import { parseTiles } from '../tiles'

function hand(concealed: string, winTile: string, calls: Hand['calls'] = []): Hand {
  return { concealed: parseTiles(concealed), calls, winTile: parseTiles(winTile)[0] }
}

describe('decompose', () => {
  it('finds the single reading of an unambiguous hand', () => {
    const results = decompose(hand('123555m456p789s11z', '2m'))
    expect(results).toHaveLength(1)
    expect(results[0].kind).toBe('standard')
    expect(results[0].melds).toHaveLength(4)
  })

  it('returns every reading when a hand is ambiguous', () => {
    // 111222333m reads as three triplets or as three identical runs.
    const results = decompose(hand('111222333m99p111z', '1z'))
    const standard = results.filter((r) => r.kind === 'standard')
    expect(standard.length).toBeGreaterThanOrEqual(2)
    expect(standard.some((r) => r.melds.filter((m) => m.kind === 'run').length === 3)).toBe(true)
    expect(standard.some((r) => r.melds.every((m) => m.kind === 'triplet'))).toBe(true)
  })

  it('detects chiitoitsu', () => {
    const results = decompose(hand('1133m5577p99s1122z', '2z'))
    expect(results.some((r) => r.kind === 'chiitoitsu')).toBe(true)
  })

  it('rejects four-of-a-kind as two chiitoitsu pairs', () => {
    const results = decompose(hand('1111m3355p7799s11z', '1z'))
    expect(results.some((r) => r.kind === 'chiitoitsu')).toBe(false)
  })

  it('detects kokushi musou', () => {
    const results = decompose(hand('19m19p19s12345677z', '7z'))
    expect(results.some((r) => r.kind === 'kokushi')).toBe(true)
  })

  it('folds called melds into the decomposition', () => {
    const h = hand('123m456p11z', '3m', [
      { kind: 'pon', tile: 26, tiles: parseTiles('999s') },
      { kind: 'chi', tile: 9, tiles: parseTiles('123p') },
    ])
    const results = decompose(h)
    expect(results).toHaveLength(1)
    expect(results[0].melds).toHaveLength(4)
    expect(results[0].melds.filter((m) => m.open)).toHaveLength(2)
  })

  it('rejects a non-winning shape', () => {
    expect(isWinningHand(hand('123m456p789s135z11m', '1m'))).toBe(false)
  })

  it('rejects a hand with the wrong tile count', () => {
    expect(decompose(hand('123m456p789s11z', '1z'))).toHaveLength(0)
  })
})

describe('waitInterpretations', () => {
  const waitTypes = (concealed: string, win: string) => {
    const [decomp] = decompose(hand(concealed, win))
    return waitInterpretations(decomp, parseTiles(win)[0]).map((w) => w.type)
  }

  it('finds a two-sided wait', () => {
    expect(waitTypes('234m55m456p789s111z', '4m')).toContain('ryanmen')
  })

  it('finds a closed wait', () => {
    expect(waitTypes('345m55m456p789s111z', '4m')).toContain('kanchan')
  })

  it('finds an edge wait on 3 completing 123', () => {
    expect(waitTypes('123m55m456p789s111z', '3m')).toContain('penchan')
  })

  it('finds a pair wait', () => {
    expect(waitTypes('123555m456p789s11z', '1z')).toContain('tanki')
  })

  it('finds a dual-triplet wait', () => {
    expect(waitTypes('111555m456p789s11z', '5m')).toContain('shanpon')
  })

  it('treats a seven-pairs win as a pair wait', () => {
    expect(waitTypes('1133m5577p99s1122z', '2z')).toEqual(['tanki'])
  })

  it('never treats a called meld as the wait', () => {
    const h = hand('123m456p11z', '3m', [
      { kind: 'chi', tile: 0, tiles: parseTiles('123m') },
      { kind: 'pon', tile: 26, tiles: parseTiles('999s') },
    ])
    const [decomp] = decompose(h)
    const waits = waitInterpretations(decomp, parseTiles('3m')[0])
    expect(waits.every((w) => w.meldIndex === -1 || !decomp.melds[w.meldIndex].called)).toBe(true)
  })
})
