/**
 * Per-browser progress, kept in localStorage.
 *
 * Nothing leaves the machine and there are no accounts. The stored shape is
 * versioned and validated on read, so a future change to the schema degrades to
 * a fresh start instead of throwing on someone's stale data.
 */

import { z } from 'zod'

const STORAGE_KEY = 'surima.progress.v1'

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

const ProgressSchema = z.object({
  version: z.literal(1),
  /** Keyed by drill id, e.g. `fu.count` or `yaku.identify`. */
  drills: z.record(z.string(), DrillStatsSchema),
  /** Lesson ids the user has read through. */
  completedLessons: z.array(z.string()),
  /** Best score per quiz, keyed by the generators it draws from. */
  quizzes: z.record(z.string(), QuizStatsSchema).default({}),
  streak: z.object({
    current: z.number().int().nonnegative(),
    best: z.number().int().nonnegative(),
    /** ISO date (yyyy-mm-dd) of the last day with any activity. */
    lastDay: z.string(),
  }),
})

export type DrillStats = z.infer<typeof DrillStatsSchema>
export type QuizStats = z.infer<typeof QuizStatsSchema>
export type Progress = z.infer<typeof ProgressSchema>

function emptyProgress(): Progress {
  return {
    version: 1,
    drills: {},
    completedLessons: [],
    quizzes: {},
    streak: { current: 0, best: 0, lastDay: '' },
  }
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyProgress()
    const parsed = ProgressSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : emptyProgress()
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

/** Records a finished quiz run, keeping the best score seen. */
export function recordQuizRun(progress: Progress, quizId: string, score: number): Progress {
  const previous = progress.quizzes[quizId] ?? { best: 0, runs: 0 }
  return {
    ...progress,
    quizzes: {
      ...progress.quizzes,
      [quizId]: { best: Math.max(previous.best, score), runs: previous.runs + 1 },
    },
  }
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
