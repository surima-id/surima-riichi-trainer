import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { scoreHandFull } from '../explain'
import { YAKU_LIST } from '../yaku'
import { buildScoringHand } from '../../drills/hands'
import { makeRng } from '../../drills/random'

/**
 * The engine must not emit human-readable prose.
 *
 * Every string a player reads is assembled in `src/i18n/`; the engine returns
 * ids, enums and numbers. This matters beyond tidiness: drill grading compares
 * answers, and when the engine produced English the grading compared English,
 * which would have broken silently the moment the app was translated.
 *
 * Two scans, because either alone has a blind spot. The static one reads the
 * source and cannot see a string built at runtime; the runtime one walks real
 * results and cannot see a string on a branch it never took.
 */

const ENGINE_DIR = join(import.meta.dirname, '..')

/** Notation atoms, ids, and enum values are all fine. */
const NEUTRAL = /^[a-z0-9][a-z0-9._/-]*$/
const ALLOWED = new Set(['', ' ', ',', '-', '/', '+', 'm', 'p', 's', 'z', 'NotationError'])

/** Two or more words with a space between them is prose. */
const LOOKS_LIKE_PROSE = /[A-Za-z]{2,}[\s,][A-Za-z]{2,}/

function stripCommentsAndTemplates(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    // Module specifiers are paths, not text anyone reads.
    .replace(/\bfrom\s+'[^']*'/g, "from ''")
    // Template literals interpolate values; their static parts are checked as
    // literals below, and dropping the expressions avoids false positives.
    .replace(/`[^`]*`/g, '``')
}

function stringLiteralsIn(source: string): string[] {
  const stripped = stripCommentsAndTemplates(source)
  const matches = stripped.match(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g) ?? []
  return matches.map((literal) => literal.slice(1, -1))
}

describe('the engine emits no prose', () => {
  const files: string[] = readdirSync(ENGINE_DIR).filter((name: string) => name.endsWith('.ts'))

  it('has engine files to scan', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('contains no prose literals in any engine file', () => {
    const offenders: string[] = []
    for (const file of files) {
      const source = readFileSync(join(ENGINE_DIR, file), 'utf8')
      for (const literal of stringLiteralsIn(source)) {
        if (!ALLOWED.has(literal) && !NEUTRAL.test(literal)) {
          offenders.push(`${file}: "${literal}"`)
        }
      }
    }
    expect(offenders, `engine source has display text in it:\n${offenders.join('\n')}`).toEqual([])
  })

  /**
   * The value-level check. Concatenation like the old
   * `${openness} triplet of ${tileClass}s` is a template literal, so the static
   * scan above cannot see it — but it shows up plainly in the result.
   */
  it('produces no prose in any scored result', () => {
    const found: string[] = []

    const walk = (value: unknown, path: string): void => {
      if (typeof value === 'string') {
        if (LOOKS_LIKE_PROSE.test(value)) found.push(`${path}: "${value}"`)
        return
      }
      if (Array.isArray(value)) {
        value.forEach((item, i) => walk(item, `${path}[${i}]`))
        return
      }
      if (value && typeof value === 'object') {
        for (const [key, inner] of Object.entries(value)) walk(inner, `${path}.${key}`)
      }
    }

    for (let seed = 0; seed < 50; seed++) {
      const built = buildScoringHand(makeRng(seed))
      if (!built) continue
      walk(scoreHandFull(built.hand, built.context, { dealer: built.dealer }), `seed${seed}`)
    }
    walk(YAKU_LIST, 'YAKU_LIST')

    expect(found, `engine results contain display text:\n${found.join('\n')}`).toEqual([])
  })
})
