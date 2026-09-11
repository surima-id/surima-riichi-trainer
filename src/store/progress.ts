/**
 * Per-browser progress, kept in localStorage.
 *
 * Nothing leaves the machine and there are no accounts. The stored shape is
 * versioned and validated on read, so a future change to the schema degrades to
 * a fresh start instead of throwing on someone's stale data.
 */

import { z } from 'zod'

const STORAGE_KEY = 'surima.progress.v1'

/** Questions in one quiz run. Lives here because the mastery rules are stated in terms of it. */
export const QUIZ_LENGTH = 10

/**
 * Points a chapter needs to count as mastered.
 *
 * Twelve is six perfect runs, or up to twelve near-perfect ones. Repetition is
 * the point: one good run proves you can do it once, not that it has stuck.
 */
export const CHAPTER_CAP = 12

const DrillStatsSchema = z.object({
  attempts: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  /** Epoch millis of the last attempt, for the review queue. */
  lastSeen: z.number().int().nonnegative(),
})

const QuizStatsSchema = z.object({
  best: z.number().int().nonnegative(),
  runs: z.number().int().nonnegative(),
})

const ChapterStatsSchema = z.object({
  /** Mastery points earned, capped at `CHAPTER_CAP`. */
  points: z.number().int().nonnegative(),
  /** Finished runs, counted whether or not they scored any points. */
  runs: z.number().int().nonnegative(),
})

const ProgressSchema = z.object({
  version: z.literal(1),
  /** Keyed by drill id, e.g. `fu.count` or `yaku.identify`. */
  drills: z.record(z.string(), DrillStatsSchema),
  /** Lesson ids the user has read through. */
  completedLessons: z.array(z.string()),
  /** Best score per quiz, keyed by the generators it draws from. */
  quizzes: z.record(z.string(), QuizStatsSchema).default({}),
  /**
   * Mastery per chapter, keyed by chapter id.
   *
   * Defaulted rather than required, so progress stored before mastery existed
   * still parses and keeps its streak instead of being discarded as invalid.
   */
  chapters: z.record(z.string(), ChapterStatsSchema).default({}),
  streak: z.object({
    current: z.number().int().nonnegative(),
    best: z.number().int().nonnegative(),
    /** ISO date (yyyy-mm-dd) of the last day with any activity. */
    lastDay: z.string(),
  }),
})

export type DrillStats = z.infer<typeof DrillStatsSchema>
export type QuizStats = z.infer<typeof QuizStatsSchema>
export type ChapterStats = z.infer<typeof ChapterStatsSchema>
export type Progress = z.infer<typeof ProgressSchema>

function emptyProgress(): Progress {
  return {
    version: 1,
    drills: {},
    completedLessons: [],
    quizzes: {},
    chapters: {},
    streak: { current: 0, best: 0, lastDay: '' },
  }
}

/**
 * Validates a decoded payload, returning `null` if it is not progress.
 *
 * Separate from `loadProgress` so the stored shape can be tested without a
 * browser: the rule that matters — old data keeps parsing — is about the schema,
 * not about storage.
 */
export function parseProgress(value: unknown): Progress | null {
  const parsed = ProgressSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyProgress()
    return parseProgress(JSON.parse(raw)) ?? emptyProgress()
  } catch {
    // Private browsing, disabled storage, corrupt JSON — all mean "start fresh".
    return emptyProgress()
  }
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // Storage full or blocked; progress is a convenience, never a requirement.
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function dayBefore(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

/** Advances the daily streak; same-day activity leaves it untouched. */
export function touchStreak(progress: Progress): Progress {
  const day = today()
  if (progress.streak.lastDay === day) return progress

  const continued = progress.streak.lastDay === dayBefore(day)
  const current = continued ? progress.streak.current + 1 : 1
  return {
    ...progress,
    streak: { current, best: Math.max(current, progress.streak.best), lastDay: day },
  }
}

export function recordAttempt(progress: Progress, drillId: string, correct: boolean): Progress {
  const previous = progress.drills[drillId] ?? { attempts: 0, correct: 0, lastSeen: 0 }
  const updated = touchStreak(progress)
  return {
    ...updated,
    drills: {
      ...updated.drills,
      [drillId]: {
        attempts: previous.attempts + 1,
        correct: previous.correct + (correct ? 1 : 0),
        lastSeen: Date.now(),
      },
    },
  }
}

/**
 * Mastery points a finished run is worth.
 *
 * A perfect run counts double, one mistake counts single, and anything looser
 * counts nothing. Nothing is ever deducted: this is a study tool, and a bar that
 * can fall punishes the very thing it should encourage — drilling a weak chapter
 * until it sticks. So the bar records work done rather than form held.
 */
export function pointsForRun(score: number, total = QUIZ_LENGTH): number {
  if (score >= total) return 2
  if (score === total - 1) return 1
  return 0
}

/**
 * Records one finished run against both the quiz that was taken and the chapter
 * it belongs to.
 *
 * Both in a single pass, because they are one event. Two reducers called from the
 * same handler would each rebuild the object from its own view of the previous
 * state, which is the kind of thing that works until it is the last write that
 * lands. The streak is deliberately left alone: `recordAttempt` already touched it
 * ten questions ago, and a run cannot happen on a day with no attempts.
 */
export function recordRun(
  progress: Progress,
  { chapterId, quizId, score }: { chapterId: string; quizId: string; score: number },
): Progress {
  const quiz = progress.quizzes[quizId] ?? { best: 0, runs: 0 }
  const chapter = progress.chapters[chapterId] ?? { points: 0, runs: 0 }
  return {
    ...progress,
    quizzes: {
      ...progress.quizzes,
      [quizId]: { best: Math.max(quiz.best, score), runs: quiz.runs + 1 },
    },
    chapters: {
      ...progress.chapters,
      [chapterId]: {
        points: Math.min(CHAPTER_CAP, chapter.points + pointsForRun(score)),
        runs: chapter.runs + 1,
      },
    },
  }
}

export function chapterPoints(progress: Progress, chapterId: string): number {
  return progress.chapters[chapterId]?.points ?? 0
}

export function isMastered(progress: Progress, chapterId: string): boolean {
  return chapterPoints(progress, chapterId) >= CHAPTER_CAP
}

/** Every mastery point earned, across every chapter. */
export function totalXp(progress: Progress): number {
  return Object.values(progress.chapters).reduce((sum, c) => sum + c.points, 0)
}

/**
 * Share of the whole course mastered, 0–1.
 *
 * Driven by the caller's chapter list rather than by the stored keys, so a
 * chapter never started still counts against the total — otherwise finishing one
 * chapter and ignoring the rest would read as 100%.
 */
export function completionRatio(progress: Progress, chapterIds: readonly string[]): number {
  if (chapterIds.length === 0) return 0
  const earned = chapterIds.reduce((sum, id) => sum + chapterPoints(progress, id), 0)
  return earned / (chapterIds.length * CHAPTER_CAP)
}

export function markLessonRead(progress: Progress, lessonId: string): Progress {
  if (progress.completedLessons.includes(lessonId)) return progress
  return { ...progress, completedLessons: [...progress.completedLessons, lessonId] }
}

export function accuracy(stats: DrillStats | undefined): number | null {
  if (!stats || stats.attempts === 0) return null
  return stats.correct / stats.attempts
}

/**
 * Drill ids ordered worst-first, so the home page can point the user at what
 * they are actually weak on. Drills with too few attempts are excluded — three
 * tries is not evidence of anything.
 */
export function weakestDrills(progress: Progress, minAttempts = 3): string[] {
  return Object.entries(progress.drills)
    .filter(([, stats]) => stats.attempts >= minAttempts)
    .sort(([, a], [, b]) => a.correct / a.attempts - b.correct / b.attempts)
    .map(([id]) => id)
}

export function resetProgress(): Progress {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do; the in-memory reset below is what matters.
  }
  return emptyProgress()
}
