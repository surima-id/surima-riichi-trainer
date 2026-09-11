import { describe, expect, it } from 'vitest'
import { ALL_GENERATORS } from '../generators'
import { type Question } from '../types'
import { LANGS, createTranslator } from '../../i18n'
import { EAST, SOUTH, face } from '../../engine/tiles'

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
    case 'payment':
      return q.payment !== undefined
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

    it('never offers an indistinguishable or duplicate choice', () => {
      for (const seed of SEEDS) {
        const q = generator.generate(seed, t)
        if (!q.choices) continue

        /**
         * An option has to carry something the player can read: text, or the
         * tiles it draws. The wait drill deliberately ships an empty label
         * because its options are tile rows, and repeating the notation beside
         * the picture would only restate it.
         */
        const shown = q.choices.map((c) =>
          c.label.trim() || (c.tiles ?? []).map((tile) => `#${tile}`).join(''),
        )
        expect(
          shown.every((s) => s.length > 0),
          `seed ${seed} has an option showing nothing`,
        ).toBe(true)
        expect(new Set(shown).size, `seed ${seed}: ${shown.join(', ')}`).toBe(shown.length)
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
      expect(a.payment, `seed ${seed}`).toEqual(b.payment)
      expect(a.tiles, `seed ${seed}`).toEqual(b.tiles)
    }
  })

  /**
   * A fourth copy of a tile is legal but is the hardest shape a beginner meets:
   * it splits across a triplet and a run, leaving the hand with several
   * readings that score differently. Drills teach the ordinary case, so no
   * question poses one — which also rules out the five-copy hand that cannot
   * exist at all.
   *
   * A kan is the deliberate exception, and not the same problem: its four tiles
   * are declared on the table as one meld, so they are never ambiguous about
   * which shape they belong to. Its face is exempted rather than the check
   * being dropped, so a fourth loose copy elsewhere in a kan hand still fails.
   */
  it('never deals four loose copies of a tile', () => {
    const t = createTranslator('en')
    for (const seed of SEEDS) {
      const q = generator.generate(seed, t)
      const counts = new Map<number, number>()
      const declared = new Set<number>()
      for (const tile of q.tiles ?? []) counts.set(face(tile), (counts.get(face(tile)) ?? 0) + 1)
      for (const call of q.calls ?? []) {
        if (call.kind === 'ankan' || call.kind === 'minkan') {
          declared.add(face(call.tiles[0]))
          continue
        }
        for (const tile of call.tiles) counts.set(face(tile), (counts.get(face(tile)) ?? 0) + 1)
      }
      const over = [...counts.entries()].filter(([f, n]) => n > 3 && !declared.has(f))
      expect(over, `seed ${seed} deals ${over.map(([f, n]) => `${n}x face ${f}`).join(', ')}`).toEqual([])
    }
  })

  /**
   * A kan quadruples a triplet's fu rather than doubling it, so a concealed kan
   * of terminals is 32 fu where the triplet is 8 — a difference big enough to
   * move a hand two rows up the payment table. Both kinds have to show up: the
   * closed one is declared from the hand, the open one called off a discard,
   * and they differ from each other by a factor of two.
   */
  it('poses both kinds of kan, if it poses kans at all', () => {
    if (generator.id !== 'fu.count') return
    const t = createTranslator('en')
    const kinds = new Set<string>()
    for (const seed of SEEDS) {
      for (const call of generator.generate(seed, t).calls ?? []) {
        if (call.kind === 'ankan' || call.kind === 'minkan') kinds.add(call.kind)
      }
    }
    expect([...kinds].sort()).toEqual(['ankan', 'minkan'])
  })

  /**
   * Riichi buys the bottom row of the dead wall, and those ura dora count. A
   * question that declares riichi without flipping an ura is scoring the hand
   * short of what it pays; one that flips an ura without a riichi is showing
   * the player tiles nobody at the table would have turned over.
   */
  it('flips an ura indicator exactly when the hand declared riichi', () => {
    const t = createTranslator('en')
    for (const seed of SEEDS) {
      const q = generator.generate(seed, t)
      const context = q.context
      if (!context) continue
      // Read off the boolean rather than by matching a translated label: the
      // strip draws riichi as a stick, so there is no longer a word to match,
      // and a test that compared display text would only have to change again.
      const declared = (context.riichi ?? false) || (context.doubleRiichi ?? false)
      const ura = (context.uraIndicators ?? []).length
      expect(ura > 0, `seed ${seed}: riichi=${declared} but ${ura} ura indicator(s)`).toBe(declared)
    }
  })

  /**
   * A wind triplet is yakuhai only when the wind matches the player's seat or
   * the round, so a question whose answer includes one has to say what those
   * winds are. Otherwise the answer key rests on a fact the player was never
   * shown — the same defect that had the han drill scoring an unstated riichi.
   */
  it('states the winds whenever the answer depends on them', () => {
    const t = createTranslator('en')
    const WIND_YAKU = [t.yaku('yakuhai-seat'), t.yaku('yakuhai-round')]
    for (const seed of SEEDS) {
      const q = generator.generate(seed, t)
      const answers = (q.choices ?? []).filter((c) => c.correct).map((c) => c.label)
      const needsWinds = answers.some((label) => WIND_YAKU.some((y) => label.includes(y)))
      if (!needsWinds) continue
      expect(q.context?.seatWind, `seed ${seed} scores a wind yaku without naming the seat wind`)
        .toBeDefined()
      expect(q.context?.roundWind, `seed ${seed} scores a wind yaku without naming the round wind`)
        .toBeDefined()
    }
  })

  /**
   * A hanchan runs East then South and stops. West is the rare sudden-death
   * extension and North is never a round at all, so posing either asks the
   * player to judge a wind yakuhai in a round they will not sit in.
   */
  it('only poses an East or South round', () => {
    const t = createTranslator('en')
    for (const seed of SEEDS) {
      const q = generator.generate(seed, t)
      const round = q.context?.roundWind
      if (round === undefined) continue
      expect([EAST, SOUTH], `seed ${seed} used ${t.tile(round)} as the round wind`).toContain(round)
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
