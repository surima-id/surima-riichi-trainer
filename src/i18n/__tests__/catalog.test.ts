import { describe, expect, it } from 'vitest'
import { messages as id } from '../catalog/id'
import { messages as en } from '../catalog/en'
import { YAKU_ROMAJI } from '../catalog/romaji'
import { createTranslator } from '../translator'
import { LANGS, isTermKey, termOf } from '../types'
import { EAST, parseTiles } from '../../engine/tiles'
import { YAKU_LIST } from '../../engine/yaku'

const catalogs: Record<string, Record<string, string>> = { id, en }
const idMap: Record<string, string> = id
const enMap: Record<string, string> = en

/** `{n}` style slots, so a translation cannot silently drop one. */
function placeholders(value: string): string[] {
  return (value.match(/\{(\w+)\}/g) ?? []).sort()
}

describe('message catalogs', () => {
  it('define the same keys in both languages', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(id).sort())
  })

  it.each(LANGS.map((l) => [l] as [string]))('%s has no accidentally blank strings', (lang) => {
    // `limit.none` is deliberately empty — a hand below mangan has no tier name.
    const blank = Object.entries(catalogs[lang])
      .filter(([key, value]) => value.trim() === '' && key !== 'limit.none' && key !== 'tile.of')
      .map(([key]) => key)
    expect(blank).toEqual([])
  })

  /**
   * A dropped interpolation slot renders as a literal "{n}" on the page, which
   * is the kind of thing that survives review and ships.
   */
  it('use the same placeholders in both languages', () => {
    const mismatched = Object.keys(idMap).filter(
      (key) => placeholders(idMap[key]).join() !== placeholders(enMap[key]).join(),
    )
    expect(mismatched, `placeholder mismatch in: ${mismatched.join(', ')}`).toEqual([])
  })

  /**
   * Terminology is shared, not translated. If someone renders "Semua Sederhana"
   * for tanyao again, this fails — which is the point: the decision is that
   * Indonesian prose surrounds English mahjong terms.
   */
  it('keeps terminology identical across languages', () => {
    // Only the term itself must match. A label like "Tsumo (Tarik Sendiri)"
    // deliberately translates the bracketed gloss.
    const translated = Object.keys(idMap).filter(
      (key) => isTermKey(key) && termOf(idMap[key]) !== termOf(enMap[key]),
    )
    expect(translated, `these terms should read the same in both languages: ${translated.join(', ')}`).toEqual([])
  })

  /**
   * The other half of the rule above, for the labels that lead with a Japanese
   * term and gloss it: the gloss is prose and must read in the reader's
   * language. (Wait labels bracket the other way round — an English term with
   * the romaji in brackets — so they are terminology end to end and excluded.)
   */
  it('translates the gloss beside a Japanese term', () => {
    const GLOSSED = ['fact.tsumo', 'fact.ron', 'fu.tsumo', 'lesson.fu.rowTsumo']
    for (const key of GLOSSED) {
      expect(idMap[key], `${key} should carry a bracketed gloss`).toContain(' (')
      expect(termOf(idMap[key]), `${key} term should match across languages`).toBe(
        termOf(enMap[key]),
      )
      expect(idMap[key], `${key} carries an untranslated gloss`).not.toBe(enMap[key])
    }
  })

  /**
   * The counterpart to the check above. Plenty of non-term keys are still
   * shared — format strings like "{n} fu", nav labels that are themselves terms
   * ("Fu", "Han", "Yaku"), and the fu-table rows that must match the breakdown
   * word for word. So this asserts the lesson prose specifically, where every
   * single string should read differently.
   */
  it('still translates the lesson prose', () => {
    const prose = Object.keys(idMap).filter(
      (key) => key.startsWith('lesson.') && !isTermKey(key) && idMap[key].length > 25,
    )
    const shared = prose.filter((key) => idMap[key] === enMap[key])
    expect(prose.length).toBeGreaterThan(50)
    expect(shared, `untranslated lesson prose: ${shared.join(', ')}`).toEqual([])
  })

  it('covers every yaku the engine knows, in both languages and romaji', () => {
    for (const { id: yakuId } of YAKU_LIST) {
      expect(idMap[`yaku.${yakuId}`], `missing id name for ${yakuId}`).toBeTruthy()
      expect(enMap[`yaku.${yakuId}`], `missing en name for ${yakuId}`).toBeTruthy()
      expect(YAKU_ROMAJI[yakuId], `missing romaji for ${yakuId}`).toBeTruthy()
    }
  })
})

describe('tile naming', () => {
  const en_ = createTranslator('en')
  const id_ = createTranslator('id')

  it('names tiles in English', () => {
    expect(en_.tile(parseTiles('5s')[0])).toBe('Five of Bamboo')
    expect(en_.tile(parseTiles('0s')[0])).toBe('Red Five of Bamboo')
    expect(en_.tile(EAST)).toBe('East')
  })

  /**
   * Tile names are prose, not terminology, so they read in the reader's
   * language. Word order is part of that: Indonesian trails the modifier and
   * drops the connector, so "Red Five of Bamboo" is "Lima Bambu Merah" rather
   * than a word-for-word transposition.
   */
  it('names tiles in Indonesian, with Indonesian word order', () => {
    expect(id_.tile(parseTiles('5s')[0])).toBe('Lima Bambu')
    expect(id_.tile(parseTiles('0s')[0])).toBe('Lima Bambu Merah')
    expect(id_.tile(EAST)).toBe('Timur')
  })

  it('gives every tile a different name in the two languages', () => {
    // Catches a rank, suit or honor left untranslated in one catalog — the
    // failure mode that put English tile names in the Indonesian UI.
    const shared: string[] = []
    for (let face = 0; face < 34; face++) {
      if (en_.tile(face) === id_.tile(face)) shared.push(en_.tile(face))
    }
    expect(shared, `these tile names read identically in both languages: ${shared.join(', ')}`).toEqual([])
  })

  it('names every tile in both languages', () => {
    for (let face = 0; face < 34; face++) {
      expect(en_.tile(face).trim()).toBeTruthy()
      expect(id_.tile(face).trim()).toBeTruthy()
    }
  })
})

describe('translator helpers', () => {
  const t = createTranslator('en')

  it('interpolates parameters', () => {
    expect(t.han(3)).toBe('3 han')
    expect(t.fu(40)).toBe('40 fu')
  })

  it('formats each payment shape', () => {
    expect(t.payment({ kind: 'ron', amount: 7700 })).toBe('7700')
    expect(t.payment({ kind: 'tsumo-dealer', each: 4000 })).toBe('4000 all')
    expect(t.payment({ kind: 'tsumo-nondealer', each: 2000, fromDealer: 3900 })).toBe('2000/3900')
  })

  it('names a fu item from its reason alone', () => {
    const item = t.fuItem({
      reason: { key: 'meld', meld: 'triplet', concealed: true, tileClass: 'terminal-honor', tile: 0 },
      fu: 8,
    })
    expect(item.label).toBe('Concealed triplet of terminals or honors')
    expect(item.detail).toBe('One of Characters')
  })
})
