import { describe, expect, it } from 'vitest'
import { GLOSSARY, GLOSSARY_TERMS, matchesQuery } from '../glossary'
import { CHAPTERS, CHAPTER_IDS, OPTIONAL_CHAPTERS } from '../chapters'
import { messages as id } from '../../i18n/catalog/id'
import { messages as en } from '../../i18n/catalog/en'

const idMap: Record<string, string> = id
const enMap: Record<string, string> = en

describe('glossary', () => {
  it('defines every term in both languages', () => {
    for (const term of GLOSSARY_TERMS) {
      const key = `glossary.${term.slug}`
      expect(idMap[key], `missing Indonesian definition for ${term.slug}`).toBeTruthy()
      expect(enMap[key], `missing English definition for ${term.slug}`).toBeTruthy()
    }
  })

  it('names every group in both languages', () => {
    for (const group of GLOSSARY) {
      expect(idMap[group.titleKey], `missing Indonesian title for ${group.id}`).toBeTruthy()
      expect(enMap[group.titleKey], `missing English title for ${group.id}`).toBeTruthy()
    }
  })

  /**
   * The definitions are prose, so they must actually read differently. This is
   * the glossary's half of the catalog-wide rule, checked here because the
   * shared-prose guard only looks at `lesson.*` keys.
   */
  it('translates every definition', () => {
    const shared = GLOSSARY_TERMS.filter(
      (term) => idMap[`glossary.${term.slug}`] === enMap[`glossary.${term.slug}`],
    ).map((term) => term.slug)
    expect(shared, `untranslated glossary definitions: ${shared.join(', ')}`).toEqual([])
  })

  it('uses a unique slug per term', () => {
    const slugs = GLOSSARY_TERMS.map((term) => term.slug)
    expect(slugs).toEqual([...new Set(slugs)])
  })

  /** A cross-reference to a path the router does not serve is a dead link. */
  it('only cross-references real chapters', () => {
    const paths = new Set(CHAPTERS.map((c) => c.path))
    for (const term of GLOSSARY_TERMS) {
      if (term.chapter) expect(paths, `${term.slug} points at ${term.chapter}`).toContain(term.chapter)
    }
  })

  /**
   * The load-bearing part of "optional": mastery percentages divide by
   * CHAPTER_IDS, so a quizless module in there would put 100% out of reach.
   */
  it('keeps optional modules out of the mastery denominator', () => {
    for (const optional of OPTIONAL_CHAPTERS) {
      expect(CHAPTER_IDS).not.toContain(optional.id)
      expect(CHAPTERS.map((c) => c.id)).not.toContain(optional.id)
    }
  })

  it('gives every optional module a title, blurb and nav label', () => {
    for (const optional of OPTIONAL_CHAPTERS) {
      for (const map of [idMap, enMap]) {
        expect(map[`module.${optional.id}.title`]).toBeTruthy()
        expect(map[`module.${optional.id}.blurb`]).toBeTruthy()
        expect(map[optional.navKey]).toBeTruthy()
      }
    }
  })
})

describe('glossary search', () => {
  const furiten = GLOSSARY_TERMS.find((term) => term.slug === 'furiten')!

  it('matches everything on an empty query', () => {
    expect(matchesQuery(furiten, 'anything', '')).toBe(true)
    expect(matchesQuery(furiten, 'anything', '   ')).toBe(true)
  })

  it('matches the term regardless of case', () => {
    expect(matchesQuery(furiten, '', 'FURI')).toBe(true)
  })

  /** Searching the definition is what lets someone find a word they do not know. */
  it('matches the definition', () => {
    expect(matchesQuery(furiten, 'You may not win by ron', 'may not win')).toBe(true)
  })

  it('matches the Japanese', () => {
    expect(matchesQuery(furiten, '', '振聴')).toBe(true)
  })

  it('rejects a term it does not contain', () => {
    expect(matchesQuery(furiten, 'a definition', 'kokushi')).toBe(false)
  })
})
