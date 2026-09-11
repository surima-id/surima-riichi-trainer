import { describe, expect, it } from 'vitest'
import { EAST, HATSU, NUM_FACES, makeTile, parseTiles } from '../../engine/tiles'
import { tileTerm } from '../tileTerm'
import { createTranslator } from '../translator'

const id = createTranslator('id')
const en = createTranslator('en')

describe('tileTerm', () => {
  it('names the honors the way players do', () => {
    expect(tileTerm(EAST)).toBe('Ton')
    expect(tileTerm(HATSU)).toBe('Hatsu')
  })

  it('names suited tiles by rank and suit', () => {
    expect(tileTerm(parseTiles('9m')[0])).toBe('9-man')
    expect(tileTerm(parseTiles('5p')[0])).toBe('5-pin')
    expect(tileTerm(parseTiles('3s')[0])).toBe('3-sou')
  })

  it('distinguishes a red five from an ordinary one', () => {
    const red = parseTiles('0p')[0]
    const plain = parseTiles('5p')[0]
    expect(tileTerm(red)).not.toBe(tileTerm(plain))
    expect(tileTerm(red)).toContain('aka')
  })

  it('gives every face a term', () => {
    for (let face = 0; face < NUM_FACES; face++) {
      expect(tileTerm(makeTile(face)), `face ${face}`).not.toBe('')
    }
  })

  it('gives every face a distinct term', () => {
    const seen = new Set<string>()
    for (let face = 0; face < NUM_FACES; face++) seen.add(tileTerm(makeTile(face)))
    expect(seen.size).toBe(NUM_FACES)
  })

  it('reads the same in both languages, because it is terminology', () => {
    // The whole point: "Hatsu" is not translated, the name beside it is. Checked
    // through the translators, since those are what a caller actually uses.
    for (let face = 0; face < NUM_FACES; face++) {
      const tile = makeTile(face)
      const term = tileTerm(tile)
      expect(id.tileWithTerm(tile)).toContain(`(${term})`)
      expect(en.tileWithTerm(tile)).toContain(`(${term})`)
      // The names around it differ, which is what makes the term worth adding.
      expect(id.tileWithTerm(tile)).not.toBe(en.tileWithTerm(tile))
    }
  })
})

describe('tileWithTerm', () => {
  it('pairs the localized name with the Japanese term', () => {
    expect(id.tileWithTerm(HATSU)).toBe('Naga Hijau (Hatsu)')
    expect(en.tileWithTerm(HATSU)).toBe('Green Dragon (Hatsu)')
  })

  it('keeps each language its own word order', () => {
    expect(id.tileWithTerm(parseTiles('9m')[0])).toBe('Sembilan Karakter (9-man)')
    expect(en.tileWithTerm(parseTiles('9m')[0])).toBe('Nine of Characters (9-man)')
  })

  it('carries the red-five modifier on both halves', () => {
    const red = id.tileWithTerm(parseTiles('0s')[0])
    expect(red).toContain('Merah')
    expect(red).toContain('aka')
  })

  it('leaves the plain tile name alone', () => {
    // The label teaches the term; tooltips, winds and prose must not inherit it.
    for (let face = 0; face < NUM_FACES; face++) {
      const tile = makeTile(face)
      expect(id.tile(tile)).not.toContain('(')
      expect(en.tile(tile)).not.toContain('(')
    }
  })
})
