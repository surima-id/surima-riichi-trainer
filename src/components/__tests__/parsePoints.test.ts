import { describe, expect, it } from 'vitest'
import { parsePoints } from '../Quiz'

/**
 * The scoring drill is typed rather than multiple-choice, so this parser sits
 * directly on the grading path: a bug here marks a correct answer wrong.
 */
describe('parsePoints', () => {
  it('reads a full figure as itself', () => {
    expect(parsePoints('8000')).toBe(8000)
    expect(parsePoints('1300')).toBe(1300)
    expect(parsePoints('12000')).toBe(12000)
  })

  it('does not expand a bare number into the spoken shorthand', () => {
    // Players say "eight" for a mangan, but the drill teaches the figure, and
    // "8" reads equally as 800 or 8000 — so it is graded as the 8 it says.
    expect(parsePoints('8')).toBe(8)
    expect(parsePoints('13')).toBe(13)
    expect(parsePoints('99')).toBe(99)
    expect(parsePoints('100')).toBe(100)
  })

  it('tolerates spacing and thousands separators', () => {
    expect(parsePoints(' 8000 ')).toBe(8000)
    expect(parsePoints('12,000')).toBe(12000)
  })

  it('returns NaN for anything it cannot read, rather than a wrong number', () => {
    // NaN never equals the expected payment, so these grade as wrong.
    for (const input of ['', '   ', 'abc', '-100', '8000x']) {
      expect(parsePoints(input), input).toBeNaN()
    }
  })
})
