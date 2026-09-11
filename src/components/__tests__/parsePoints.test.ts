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

  it('expands the trailing-zero shorthand players actually speak', () => {
    // "eight" for a mangan, "thirteen" for 1300 all.
    expect(parsePoints('8')).toBe(800)
    expect(parsePoints('13')).toBe(1300)
    expect(parsePoints('2')).toBe(200)
    expect(parsePoints('39')).toBe(3900)
  })

  it('takes 100 as the boundary, not the shorthand', () => {
    expect(parsePoints('99')).toBe(9900)
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
