/**
 * Turns stored progress into the card's contents.
 *
 * Split from the drawing so the mapping — which milestone, how many marks, which
 * caption — can be tested without a canvas. The tests run in a node environment,
 * where there is no DOM at all.
 */

import { type CertSubject } from './certificate'
import { CHAPTER_CAP, chapterPoints, completionRatio, totalXp } from '../store/progress'
import { type Progress } from '../store/progress'
import { type Tile } from '../engine/tiles'
import { parseTiles } from '../engine/tiles'

/** One mark per perfect run, matching the pips on the course map. */
export const MARKS_PER_CHAPTER = CHAPTER_CAP / 2

/** Marks on a course card, kept to a readable row rather than one per chapter. */
export const COURSE_MARKS = 7

/**
 * Tile art per chapter, chosen to suit the subject.
 *
 * A chapter about honors shows honors; one about shapes shows a run. It is
 * decoration, but decoration that agrees with the title reads as designed rather
 * than as filler.
 */
const CHAPTER_TILES: Record<string, string> = {
  tiles: '1m5p9s',
  shapes: '234s',
  yaku: '111z',
  han: '5m5p5s',
  fu: '789m',
  score: '1z5z',
  efficiency: '3456p',
}

const COURSE_TILE_NOTATION = '1m1p1s'

function tilesFor(chapterId: string): Tile[] {
  try {
    return parseTiles(CHAPTER_TILES[chapterId] ?? COURSE_TILE_NOTATION)
  } catch {
    // Decoration must never be the reason a card fails to draw.
    return []
  }
}

export interface SubjectStrings {
  /** "Bab ini terkuasai" */
  mastered: string
  /** "Seluruh kursus terkuasai" */
  course: string
  /** Already interpolated with the percentage. */
  progress: string
  appName: string
  site: string
  dateLabel: string
}

/** A card for one chapter: mastered, or as far as it has got. */
export function chapterSubject(
  progress: Progress,
  chapterId: string,
  title: string,
  strings: SubjectStrings,
): CertSubject {
  const points = chapterPoints(progress, chapterId)
  return {
    kind: 'chapter',
    title,
    caption: points >= CHAPTER_CAP ? strings.mastered : strings.progress,
    points,
    max: CHAPTER_CAP,
    // Floored, so a part-earned mark is not shown as earned.
    marks: Math.min(MARKS_PER_CHAPTER, Math.floor(points / 2)),
    markTotal: MARKS_PER_CHAPTER,
    dateLabel: strings.dateLabel,
    site: strings.site,
    tiles: tilesFor(chapterId),
  }
}

/** A card for the whole course. */
export function courseSubject(
  progress: Progress,
  chapterIds: readonly string[],
  strings: SubjectStrings,
): CertSubject {
  const ratio = completionRatio(progress, chapterIds)
  const complete = ratio >= 1
  return {
    kind: 'course',
    title: strings.appName,
    caption: complete ? strings.course : strings.progress,
    points: totalXp(progress),
    max: chapterIds.length * CHAPTER_CAP,
    marks: Math.min(COURSE_MARKS, Math.round(ratio * COURSE_MARKS)),
    markTotal: COURSE_MARKS,
    dateLabel: strings.dateLabel,
    site: strings.site,
    tiles: tilesFor('course'),
  }
}
