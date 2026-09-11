import { describe, expect, it } from 'vitest'
import {
  CHAPTER_CAP,
  QUIZ_LENGTH,
  type Progress,
  chapterPoints,
  completionRatio,
  isMastered,
  parseProgress,
  pointsForRun,
  recordRun,
  totalXp,
} from '../progress'

function blank(): Progress {
  return {
    version: 1,
    drills: {},
    completedLessons: [],
    quizzes: {},
    chapters: {},
    streak: { current: 0, best: 0, lastDay: '' },
  }
}

/** Runs `score` through the reducer `times` over, as repeated practice would. */
function afterRuns(chapterId: string, score: number, times: number): Progress {
  let progress = blank()
  for (let i = 0; i < times; i++) {
    progress = recordRun(progress, { chapterId, quizId: 'q', score })
  }
  return progress
}

describe('pointsForRun', () => {
  it('pays double for a perfect run and single for one mistake', () => {
    expect(pointsForRun(10)).toBe(2)
    expect(pointsForRun(9)).toBe(1)
  })

  it('pays nothing for two mistakes or more', () => {
    expect(pointsForRun(8)).toBe(0)
    expect(pointsForRun(5)).toBe(0)
    expect(pointsForRun(0)).toBe(0)
  })

  it('never returns a negative, so a bad run cannot cost progress', () => {
    for (let score = 0; score <= QUIZ_LENGTH; score++) {
      expect(pointsForRun(score)).toBeGreaterThanOrEqual(0)
    }
  })

  it('states the rule in terms of the total rather than a hard-coded ten', () => {
    expect(pointsForRun(5, 5)).toBe(2)
    expect(pointsForRun(4, 5)).toBe(1)
    expect(pointsForRun(3, 5)).toBe(0)
  })
})

describe('recordRun', () => {
  it('accumulates points across runs', () => {
    expect(chapterPoints(afterRuns('fu', 10, 2), 'fu')).toBe(4)
    expect(chapterPoints(afterRuns('fu', 9, 3), 'fu')).toBe(3)
  })

  it('reaches the cap in three perfect runs', () => {
    expect(isMastered(afterRuns('fu', 10, 2), 'fu')).toBe(false)
    expect(isMastered(afterRuns('fu', 10, 3), 'fu')).toBe(true)
  })

  it('takes six near-perfect runs to master, against three clean ones', () => {
    expect(isMastered(afterRuns('fu', 9, 5), 'fu')).toBe(false)
    expect(isMastered(afterRuns('fu', 9, 6), 'fu')).toBe(true)
  })

  it('clamps at the cap rather than overflowing', () => {
    expect(chapterPoints(afterRuns('fu', 10, 20), 'fu')).toBe(CHAPTER_CAP)
  })

  it('counts a scoreless run as a run even though it earns nothing', () => {
    const progress = afterRuns('fu', 4, 3)
    expect(chapterPoints(progress, 'fu')).toBe(0)
    expect(progress.chapters.fu.runs).toBe(3)
  })

  it('keeps the best quiz score alongside the chapter points', () => {
    let progress = recordRun(blank(), { chapterId: 'fu', quizId: 'fu.count', score: 7 })
    progress = recordRun(progress, { chapterId: 'fu', quizId: 'fu.count', score: 3 })
    expect(progress.quizzes['fu.count']).toEqual({ best: 7, runs: 2 })
  })

  it('credits one chapter from two different quizzes, as the score tracks do', () => {
    let progress = recordRun(blank(), { chapterId: 'score', quizId: 'score.pick', score: 10 })
    progress = recordRun(progress, { chapterId: 'score', quizId: 'score.total', score: 10 })
    expect(chapterPoints(progress, 'score')).toBe(4)
    // Separate bests, because the two tracks are not the same achievement.
    expect(Object.keys(progress.quizzes).sort()).toEqual(['score.pick', 'score.total'])
  })

  it('leaves other chapters untouched', () => {
    const progress = afterRuns('fu', 10, 2)
    expect(chapterPoints(progress, 'han')).toBe(0)
  })

  it('does not touch the streak, which the per-question attempts already did', () => {
    const progress = recordRun(blank(), { chapterId: 'fu', quizId: 'q', score: 10 })
    expect(progress.streak).toEqual({ current: 0, best: 0, lastDay: '' })
  })
})

describe('totals', () => {
  it('are zero on fresh progress', () => {
    expect(totalXp(blank())).toBe(0)
    expect(completionRatio(blank(), ['fu', 'han'])).toBe(0)
  })

  it('sum points across chapters', () => {
    let progress = afterRuns('fu', 10, 2)
    progress = recordRun(progress, { chapterId: 'han', quizId: 'q', score: 9 })
    expect(totalXp(progress)).toBe(5)
  })

  it('cap each chapter independently, so one cannot carry another', () => {
    const progress = afterRuns('fu', 10, 10)
    expect(totalXp(progress)).toBe(CHAPTER_CAP)
  })

  it('reach 1 only when every listed chapter is capped', () => {
    let progress = afterRuns('fu', 10, 3)
    expect(completionRatio(progress, ['fu', 'han'])).toBe(0.5)
    for (let i = 0; i < 3; i++) {
      progress = recordRun(progress, { chapterId: 'han', quizId: 'q', score: 10 })
    }
    expect(completionRatio(progress, ['fu', 'han'])).toBe(1)
  })

  it('count chapters never started against the total', () => {
    // Otherwise mastering one chapter and ignoring the rest would read as 100%.
    const progress = afterRuns('fu', 10, 3)
    expect(completionRatio(progress, ['fu', 'han', 'score'])).toBeCloseTo(1 / 3)
  })

  it('does not divide by zero on an empty chapter list', () => {
    expect(completionRatio(blank(), [])).toBe(0)
  })
})

describe('stored shape', () => {
  /**
   * Progress written before mastery existed must survive the upgrade.
   *
   * A parse failure falls back to empty progress, so a schema change that stale
   * data cannot satisfy would silently wipe a real user's streak and stats. This
   * is the test that stops that happening.
   */
  it('accepts a payload saved before chapters existed', () => {
    const stored = {
      version: 1,
      drills: { 'fu.count': { attempts: 12, correct: 9, lastSeen: 1_700_000_000_000 } },
      completedLessons: ['fu'],
      quizzes: { 'fu.count': { best: 8, runs: 4 } },
      streak: { current: 3, best: 7, lastDay: '2026-09-10' },
    }

    const parsed = parseProgress(stored)

    expect(parsed).not.toBeNull()
    expect(parsed?.chapters).toEqual({})
    expect(parsed?.streak).toEqual({ current: 3, best: 7, lastDay: '2026-09-10' })
    expect(parsed?.drills['fu.count'].attempts).toBe(12)
    expect(parsed?.quizzes['fu.count'].best).toBe(8)
  })

  it('round-trips a payload that already has chapters', () => {
    const progress = afterRuns('fu', 10, 2)
    expect(parseProgress(JSON.parse(JSON.stringify(progress)))).toEqual(progress)
  })

  it('rejects something that is not progress at all', () => {
    expect(parseProgress({ version: 2 })).toBeNull()
    expect(parseProgress(null)).toBeNull()
  })
})
