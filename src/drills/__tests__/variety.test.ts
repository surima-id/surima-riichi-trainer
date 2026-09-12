import { describe, expect, it } from 'vitest'
import { ALL_GENERATORS } from '../generators'
import { createTranslator } from '../../i18n'
import { paymentTable } from '../../engine/score'

/**
 * The counting drills have to cover the scoring table, not just its cheap
 * corner.
 *
 * Before the recipes existed the han drill answered "1 or 2 han" nearly three
 * quarters of the time and never once posed a yakuman, so a learner drilling
 * han counting practised the same three hands over and over. Nothing failed —
 * every question was correct, well-formed and gradeable — which is exactly why
 * this is asserted rather than left to be noticed.
 */

const t = createTranslator('en')
const SEEDS = Array.from({ length: 600 }, (_, i) => i * 7919 + 1)

function answers(drillId: string): string[] {
  const generator = ALL_GENERATORS.find((g) => g.id === drillId)!
  const out: string[] = []
  for (const seed of SEEDS) {
    const question = generator.generate(seed, t)
    // A generator that cannot build its hand falls back to another drill.
    if (question.drillId !== drillId) continue
    const correct = (question.choices ?? []).find((choice) => choice.correct)
    if (correct) out.push(correct.label)
  }
  return out
}

describe('han.count', () => {
  const labels = answers('han.count')

  it('spans the table from one han to a yakuman', () => {
    const han = (n: number) => labels.filter((l) => l === t.han(n)).length / labels.length
    // A cheap hand is still the common case, as it is at a real table.
    expect(han(1) + han(2), 'no cheap hands').toBeGreaterThan(0.15)
    // The bands either side of mangan, which is where the han chapter lives.
    expect(han(3) + han(4), '3-4 han').toBeGreaterThan(0.15)
    expect(han(5) + han(6), '5-6 han').toBeGreaterThan(0.08)
    // Above mangan, where the named tiers take over.
    const big = labels.filter((l) => [7, 8, 9, 10, 11, 12, 13].some((n) => l === t.han(n)))
    expect(big.length / labels.length, 'haneman and up').toBeGreaterThan(0.04)
  })

  it('poses a yakuman sometimes, but only sometimes', () => {
    const yakuman = labels.filter((l) => l.startsWith(t.t('unit.yakuman')))
    const share = yakuman.length / labels.length
    expect(share, 'never poses a yakuman').toBeGreaterThan(0.01)
    expect(share, 'poses yakuman too often to be a treat').toBeLessThan(0.2)
  })

  it('does not lean on any single answer', () => {
    const counts = new Map<string, number>()
    for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1)
    expect(Math.max(...counts.values()) / labels.length).toBeLessThan(0.3)
    expect(counts.size, 'too few distinct answers').toBeGreaterThan(8)
  })
})

describe('fu.count', () => {
  it('covers more than the two commonest steps', () => {
    const labels = answers('fu.count')
    const counts = new Map<string, number>()
    for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1)
    expect(counts.size, 'too few distinct fu totals').toBeGreaterThan(5)
  })

  it('never poses a yakuman, which has no fu to count', () => {
    const generator = ALL_GENERATORS.find((g) => g.id === 'fu.count')!
    for (const seed of SEEDS) {
      const question = generator.generate(seed, t)
      if (question.drillId !== 'fu.count') continue
      expect(question.prompt).toBe(t.t('drill.fu.count.prompt'))
    }
  })
})

describe('score.pick', () => {
  const generator = ALL_GENERATORS.find((g) => g.id === 'score.pick')!

  /**
   * The bug this pins down: options were built by scaling the right answer by
   * 0.25, 0.5, 1.5, 2 and 4 and rounding to the nearest 100, which produced
   * payments no hand has ever made — "200/300", "100/100", "300/400". A player
   * could rule those out without reading the hand, so the question graded
   * recognition of nonsense rather than scoring.
   */
  it('only ever offers payments that exist on the scoring table', () => {
    const real = new Set<string>()
    for (const dealer of [true, false]) {
      for (const tsumo of [true, false]) {
        for (const payment of paymentTable(dealer, tsumo)) real.add(t.payment(payment))
      }
    }

    const offenders: string[] = []
    for (const seed of SEEDS) {
      const question = generator.generate(seed, t)
      if (question.drillId !== 'score.pick') continue
      for (const choice of question.choices ?? []) {
        // Options are rendered text, so they are checked against the rendered
        // form of every real table row rather than parsed back into numbers.
        if (!real.has(choice.label)) offenders.push(`seed ${seed}: ${choice.label}`)
      }
    }
    expect(offenders.slice(0, 10), 'offered a payment no hand can make').toEqual([])
  })

  it('spans small hands through to a yakuman', () => {
    const labels = answers('score.pick')
    const counts = new Map<string, number>()
    for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1)
    expect(counts.size, 'too few distinct payments').toBeGreaterThan(20)
    expect(Math.max(...counts.values()) / labels.length).toBeLessThan(0.2)
  })
})
