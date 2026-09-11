/**
 * The course map.
 *
 * Modules are listed in teaching order rather than alphabetically, because the
 * order is the pedagogy: you cannot count fu before you can read a hand.
 */

import { type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Tile } from '../components/Tile'
import { Badge, Button, Card, Meter, Pips, SectionTitle, stagger } from '../components/ui'
import { ALL_GENERATORS } from '../drills/generators'
import { parseTiles } from '../engine/tiles'
import { useT, type MessageKey } from '../i18n'
import { CHAPTERS, CHAPTER_IDS } from '../content/chapters'
import {
  CHAPTER_CAP,
  accuracy,
  chapterPoints,
  completionRatio,
  isMastered,
  totalXp,
  weakestDrills,
} from '../store/progress'
import { useProgress } from '../store/useProgress'

/** One tile from each suit, for the decorative drift behind the wordmark. */
const HERO_TILES = parseTiles('1s5p7m')

/**
 * Drill names come from the generators themselves rather than a second list
 * here, so a renamed drill cannot end up with two different names on screen.
 */
const DRILL_TITLE_KEYS: Record<string, MessageKey> = Object.fromEntries(
  ALL_GENERATORS.map((g) => [g.id, g.titleKey]),
)

/**
 * Mastery marks per card.
 *
 * One mark per perfect run rather than per point, because the marks should map to
 * something the player recognises doing — six clean runs — rather than to the
 * internal currency.
 */
const PIP_COUNT = CHAPTER_CAP / 2

export function Home() {
  const t = useT()
  const { progress, reset } = useProgress()
  const weakest = weakestDrills(progress).slice(0, 3)
  const drillName = (id: string) => (DRILL_TITLE_KEYS[id] ? t.t(DRILL_TITLE_KEYS[id]) : id)
  const read = new Set(progress.completedLessons)
  const points = (id: string) => chapterPoints(progress, id)
  const mastered = (id: string) => isMastered(progress, id)
  const xp = totalXp(progress)
  const percent = Math.round(completionRatio(progress, CHAPTER_IDS) * 100)

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-12 sm:px-6">
      {/* The hero. Three tiles drift behind the wordmark at low opacity — enough
          to say "mahjong" before the tagline does, faint enough not to compete
          with it for attention. */}
      <header className="anim-fade-up relative isolate">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-6 right-0 -z-10 hidden gap-2 opacity-[0.18] sm:flex dark:opacity-[0.13]"
        >
          {HERO_TILES.map((tile, i) => (
            <span
              key={tile}
              className="anim-float"
              style={{ '--stagger': `${i * 900}ms`, '--float-tilt': `${(i - 1) * 7}deg` } as CSSProperties}
            >
              <Tile tile={tile} size="lg" />
            </span>
          ))}
        </div>

        <h1 className="text-5xl font-extrabold tracking-tighter">
          <span className="bg-gradient-to-br from-felt-800 via-felt-600 to-felt-400 bg-clip-text text-transparent dark:from-white dark:via-felt-100 dark:to-gold-300">
            {t.t('app.name')}
          </span>
        </h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-black/65 dark:text-white/65">
          {t.t('app.tagline')}
        </p>
      </header>

      {progress.streak.current > 0 && (
        <Card className="anim-fade-up" style={stagger(1, 90)}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="flex items-center gap-2 font-semibold">
              <span aria-hidden="true" className="anim-glow text-lg leading-none text-gold-500">
                ●
              </span>
              {t.t('home.streak', { n: progress.streak.current })}
            </span>
            <span className="text-black/55 dark:text-white/55">
              {t.t('home.bestStreak', { n: progress.streak.best })}
            </span>
            {weakest.length > 0 && (
              <span className="text-black/55 dark:text-white/55">
                {t.t('home.review', { list: weakest.map(drillName).join(', ') })}
              </span>
            )}
            {xp > 0 && (
              <span
                className="flex items-center gap-2 text-black/55 dark:text-white/55"
                title={t.t('progress.xp', { n: xp })}
              >
                {t.t('progress.overall')}
                <Meter
                  value={percent}
                  max={100}
                  label={t.t('progress.overallLabel', { n: percent })}
                  className="h-1.5 w-20"
                />
                <span className="font-mono text-xs tabular-nums">{percent}%</span>
              </span>
            )}
            <Button variant="ghost" onClick={reset} className="ml-auto">
              {t.t('home.reset')}
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-3.5 sm:grid-cols-2">
        {CHAPTERS.map((module, index) => (
          <Link
            key={module.id}
            to={module.path}
            className="group anim-fade-up"
            style={stagger(index + 2, 55)}
          >
            <Card className="sheen sheen-hover relative h-full overflow-hidden group-hover:-translate-y-1 group-hover:border-felt-700/30 group-hover:shadow-lg dark:group-hover:border-white/25">
              <div className="mb-1.5 flex items-center gap-2.5">
                {/* The step number in gold: the modules are a ladder, and the
                    order is the pedagogy, so it is worth making legible. */}
                <span className="font-mono text-sm font-bold text-gold-500 dark:text-gold-400">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h2 className="text-lg font-semibold tracking-tight">
                  {t.t(`module.${module.id}.title` as MessageKey)}
                </h2>
                {mastered(module.id) ? (
                  <Badge tone="gold">{t.t('progress.mastered')}</Badge>
                ) : (
                  read.has(module.id) && <Badge tone="good">{t.t('home.read')}</Badge>
                )}
              </div>
              <p className="text-sm text-black/60 dark:text-white/60">
                {t.t(`module.${module.id}.blurb` as MessageKey)}
              </p>
              {points(module.id) > 0 && !mastered(module.id) && (
                <div className="mt-3">
                  <Pips
                    filled={Math.floor(points(module.id) / 2)}
                    total={PIP_COUNT}
                    label={t.t('progress.chapterLabel', {
                      n: points(module.id),
                      max: CHAPTER_CAP,
                    })}
                  />
                </div>
              )}
            </Card>
          </Link>
        ))}

      </div>

      {Object.keys(progress.drills).length > 0 && (
        <section className="anim-fade-up" style={stagger(CHAPTERS.length + 3, 55)}>
          <SectionTitle>{t.t('home.accuracy')}</SectionTitle>
          <Card>
            {Object.entries(progress.drills).map(([id, stats], i) => {
              const rate = accuracy(stats)
              return (
                <div
                  key={id}
                  className="anim-fade-up flex items-center gap-4 border-b border-dashed border-black/10 py-2.5 last:border-0 dark:border-white/10"
                  style={stagger(i, 45)}
                >
                  <span className="text-sm">{drillName(id)}</span>
                  {/* A bar as well as a number: a list of percentages is a table
                      to read, whereas the bars are a shape to glance at. */}
                  <Meter
                    value={Math.round((rate ?? 0) * 100)}
                    max={100}
                    label={drillName(id)}
                    className="ml-auto hidden h-1.5 w-24 shrink-0 sm:block"
                  />
                  <span className="ml-auto shrink-0 font-mono text-sm font-medium tabular-nums text-black/60 sm:ml-0 dark:text-white/60">
                    {rate === null ? '—' : `${Math.round(rate * 100)}%`} ({stats.correct}/
                    {stats.attempts})
                  </span>
                </div>
              )
            })}
          </Card>
        </section>
      )}

      <footer className="border-t border-black/10 pt-6 text-xs text-black/50 dark:border-white/10 dark:text-white/50">
        <p>
          <a
            href="https://github.com/FluffyStuff/riichi-mahjong-tiles"
            className="underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            {t.t('home.credit')}
          </a>
        </p>
        <p className="mt-1">{t.t('home.ruleset')}</p>
        <p className="mt-1">{t.t('home.privacy')}</p>
        <p className="mt-1">
          <a
            href={t.t('app.siteUrl')}
            className="underline underline-offset-2 transition hover:text-black dark:hover:text-white"
            target="_blank"
            rel="noreferrer"
          >
            {t.t('home.siteLink', { site: t.t('app.site') })}
          </a>
        </p>
      </footer>
    </div>
  )
}
