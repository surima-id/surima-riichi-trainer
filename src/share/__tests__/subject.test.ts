import { describe, expect, it } from 'vitest'
import { CHAPTER_CAP, type Progress, recordRun } from '../../store/progress'
import { COURSE_MARKS, MARKS_PER_CHAPTER, chapterSubject, courseSubject } from '../subject'
import { certFonts, certLayout, shareFilename } from '../certificate'

const STRINGS = {
  mastered: 'Bab ini terkuasai',
  course: 'Seluruh kursus terkuasai',
  progress: '50% dikuasai',
  appName: 'SURIMA Academy',
  site: 'surima.id',
  dateLabel: '11 September 2026',
}

const CHAPTERS = ['tiles', 'shapes', 'yaku', 'han', 'fu', 'score', 'efficiency']

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

function afterPerfectRuns(chapterId: string, times: number): Progress {
  let progress = blank()
  for (let i = 0; i < times; i++) {
    progress = recordRun(progress, { chapterId, quizId: 'q', score: 10 })
  }
  return progress
}

describe('chapterSubject', () => {
  it('reads as mastered once the chapter is capped', () => {
    const subject = chapterSubject(afterPerfectRuns('fu', 3), 'fu', 'Menghitung Fu', STRINGS)
    expect(subject.caption).toBe(STRINGS.mastered)
    expect(subject.points).toBe(CHAPTER_CAP)
    expect(subject.marks).toBe(MARKS_PER_CHAPTER)
    expect(subject.title).toBe('Menghitung Fu')
    expect(subject.kind).toBe('chapter')
  })

  it('reads as progress while the chapter is part done', () => {
    const subject = chapterSubject(afterPerfectRuns('fu', 1), 'fu', 'Menghitung Fu', STRINGS)
    expect(subject.caption).toBe(STRINGS.progress)
    expect(subject.points).toBe(2)
    expect(subject.marks).toBe(1)
  })

  it('floors a part-earned mark rather than showing it as earned', () => {
    // One point is half a mark; half a mark is not a mark.
    const progress = recordRun(blank(), { chapterId: 'fu', quizId: 'q', score: 9 })
    expect(chapterSubject(progress, 'fu', 'Fu', STRINGS).marks).toBe(0)
  })

  it('handles a chapter never touched', () => {
    const subject = chapterSubject(blank(), 'fu', 'Menghitung Fu', STRINGS)
    expect(subject.points).toBe(0)
    expect(subject.marks).toBe(0)
  })

  it('never shows more marks than the total', () => {
    const subject = chapterSubject(afterPerfectRuns('fu', 20), 'fu', 'Fu', STRINGS)
    expect(subject.marks).toBeLessThanOrEqual(subject.markTotal)
  })

  it('carries tile art, and survives a chapter id it has no art for', () => {
    expect(chapterSubject(blank(), 'fu', 'Fu', STRINGS).tiles.length).toBeGreaterThan(0)
    expect(chapterSubject(blank(), 'nonexistent', 'X', STRINGS).tiles.length).toBeGreaterThan(0)
  })
})

describe('courseSubject', () => {
  it('reads as complete only when every chapter is capped', () => {
    let progress = blank()
    for (const id of CHAPTERS) {
      for (let i = 0; i < 3; i++) {
        progress = recordRun(progress, { chapterId: id, quizId: 'q', score: 10 })
      }
    }
    const subject = courseSubject(progress, CHAPTERS, STRINGS)
    expect(subject.caption).toBe(STRINGS.course)
    expect(subject.marks).toBe(COURSE_MARKS)
    expect(subject.points).toBe(CHAPTERS.length * CHAPTER_CAP)
    expect(subject.max).toBe(CHAPTERS.length * CHAPTER_CAP)
  })

  it('reads as progress with one chapter done', () => {
    const subject = courseSubject(afterPerfectRuns('fu', 3), CHAPTERS, STRINGS)
    expect(subject.caption).toBe(STRINGS.progress)
    expect(subject.marks).toBeLessThan(COURSE_MARKS)
    expect(subject.title).toBe(STRINGS.appName)
  })

  it('is empty but valid on fresh progress', () => {
    const subject = courseSubject(blank(), CHAPTERS, STRINGS)
    expect(subject.points).toBe(0)
    expect(subject.marks).toBe(0)
    expect(subject.markTotal).toBe(COURSE_MARKS)
  })

  it('never shows more marks than the total', () => {
    let progress = blank()
    for (const id of CHAPTERS) {
      for (let i = 0; i < 5; i++) {
        progress = recordRun(progress, { chapterId: id, quizId: 'q', score: 10 })
      }
    }
    const subject = courseSubject(progress, CHAPTERS, STRINGS)
    expect(subject.marks).toBeLessThanOrEqual(subject.markTotal)
  })
})

describe('certLayout', () => {
  it('sizes the two formats as Instagram expects', () => {
    expect(certLayout('square')).toMatchObject({ width: 1080, height: 1080 })
    expect(certLayout('story')).toMatchObject({ width: 1080, height: 1920 })
  })

  it('keeps every band inside the canvas', () => {
    for (const size of ['square', 'story'] as const) {
      const l = certLayout(size)
      for (const y of [l.captionY, l.titleY, l.marksY, l.tilesY, l.footerY]) {
        expect(y).toBeGreaterThan(0)
        expect(y).toBeLessThan(l.height)
      }
      // The footer prints a second line below itself, and the tiles are tall.
      expect(l.footerY + 52).toBeLessThan(l.height)
      expect(l.tilesY + l.tileWidth * (400 / 300)).toBeLessThan(l.height)
      expect(l.pad * 2).toBeLessThan(l.width)
    }
  })

  it('orders the bands down the card', () => {
    for (const size of ['square', 'story'] as const) {
      const l = certLayout(size)
      expect(l.captionY).toBeLessThan(l.titleY)
      expect(l.titleY).toBeLessThan(l.marksY)
      expect(l.marksY).toBeLessThan(l.tilesY)
      expect(l.tilesY).toBeLessThan(l.footerY)
    }
  })
})

describe('certFonts', () => {
  it('quotes a family whose name contains a space', () => {
    // An unquoted "JetBrains Mono" is not a valid CSS font shorthand, and the
    // load would silently do nothing.
    const mono = certFonts(certLayout('square')).filter((f) => f.includes('JetBrains'))
    expect(mono.length).toBeGreaterThan(0)
    for (const font of mono) expect(font).toContain('"JetBrains Mono"')
  })

  it('gives every font a size, which the shorthand requires', () => {
    for (const font of certFonts(certLayout('story'))) {
      expect(font).toMatch(/\d+px/)
    }
  })
})

describe('shareFilename', () => {
  it('names a png, with nothing a filesystem would object to', () => {
    const chapter = chapterSubject(blank(), 'fu', 'Menghitung Fu', STRINGS)
    for (const size of ['square', 'story'] as const) {
      const name = shareFilename(chapter, size)
      expect(name).toMatch(/\.png$/)
      expect(name).not.toMatch(/[\s/\\]/)
    }
  })

  it('distinguishes a course card from a chapter one', () => {
    const chapter = chapterSubject(blank(), 'fu', 'Fu', STRINGS)
    const course = courseSubject(blank(), CHAPTERS, STRINGS)
    expect(shareFilename(chapter, 'square')).not.toBe(shareFilename(course, 'square'))
  })
})
