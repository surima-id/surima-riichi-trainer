import { describe, expect, it } from 'vitest'
import { ALL_GENERATORS } from '../generators'
import { type Question } from '../types'
import { LANGS, createTranslator } from '../../i18n'

/**
 * Generators run in the browser, but they are pure functions of `(seed, t)`, so
 * sweeping seeds here catches the failures that matter: a question with no
 * gradeable answer, which marks every user wrong no matter what they pick, and
 * grading that differs between languages, which is the same bug wearing a hat.
 */
const SEEDS = Array.from({ length: 120 }, (_, i) => i * 977 + 1)

const TRANSLATORS = LANGS.map((lang) => [lang, createTranslator(lang)] as const)

function hasAnswer(q: Question): boolean {
  switch (q.kind) {
    case 'choice':
      return (q.choices ?? []).filter((c) => c.correct).length === 1
    case 'multi':
      return (q.choices ?? []).some((c) => c.correct)
    case 'number':
      return typeof q.answer === 'number' && Number.isFinite(q.answer)
    case 'tile-select':
      return (q.correctIndices ?? []).length > 0
  }
}

describe.each(ALL_GENERATORS.map((g) => [g.id, g] as const))('%s', (_id, generator) => {
  // Label collisions and empty strings are language-dependent, so the
  // per-language checks run under each translator rather than just one.
  describe.each(TRANSLATORS)('in %s', (_lang, t) => {
    it('produces a well-formed question for every seed', () => {
      for (const seed of SEEDS) {
        const q = generator.generate(seed, t)
        expect(q.prompt, `seed ${seed}`).toBeTruthy()
        expect(q.explanation, `seed ${seed}`).toBeTruthy()
        expect(hasAnswer(q), `seed ${seed} has no gradeable answer`).toBe(true)
      }
    })

    it('never offers a duplicate or empty choice label', () => {
      for (const seed of SEEDS) {
        const q = generator.generate(seed, t)
        if (!q.choices) continue
        const labels = q.choices.map((c) => c.label)
        expect(labels.every((l) => l.trim().length > 0), `seed ${seed} has a blank label`).toBe(true)
        expect(new Set(labels).size, `seed ${seed}: ${labels.join(', ')}`).toBe(labels.length)
      }
    })

    it('keeps tile-select indices inside the displayed hand', () => {
      for (const seed of SEEDS) {
        const q = generator.generate(seed, t)
        if (q.kind !== 'tile-select') continue
        const size = q.tiles?.length ?? 0
        expect(q.correctIndices!.every((i) => i >= 0 && i < size), `seed ${seed}`).toBe(true)
      }
    })

    it('is reproducible from its seed', () => {
      const a = generator.generate(4242, t)
      const b = generator.generate(4242, t)
      expect(a.prompt).toBe(b.prompt)
      expect(a.tiles).toEqual(b.tiles)
      expect(a.choices?.map((c) => c.label)).toEqual(b.choices?.map((c) => c.label))
    })
  })

  /**
   * The regression test for the original hazard: grading used to compare
   * display strings, so translating the app would have silently marked every
   * answer wrong. If that ever creeps back, the `correct` flags diverge between
   * languages and these seeds catch it immediately.
   */
  it('grades identically in every language', () => {
    const [id, en] = [createTranslator('id'), createTranslator('en')]
    for (const seed of SEEDS) {
      const a = generator.generate(seed, id)
      const b = generator.generate(seed, en)
      expect(a.choices?.map((c) => c.correct), `seed ${seed}`).toEqual(
        b.choices?.map((c) => c.correct),
      )
      expect(a.answer, `seed ${seed}`).toBe(b.answer)
      expect(a.correctIndices, `seed ${seed}`).toEqual(b.correctIndices)
      expect(a.tiles, `seed ${seed}`).toEqual(b.tiles)
    }
  })

  /**
   * Prompts and hints are prose and must differ between languages. Choice
   * labels are often terminology — yaku names, tile names — which stays English
   * on both sides deliberately, so they are not asserted to differ here.
   */
  it('translates its prompt', () => {
    const [id, en] = [createTranslator('id'), createTranslator('en')]
    const differs = SEEDS.some((seed) => {
      const a = generator.generate(seed, id)
      const b = generator.generate(seed, en)
      return a.prompt !== b.prompt || (a.hint ?? '') !== (b.hint ?? '')
    })
    expect(differs, 'this generator reads identically in both languages').toBe(true)
  })
})
