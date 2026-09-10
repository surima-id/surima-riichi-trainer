/**
 * The course map.
 *
 * Modules are listed in teaching order rather than alphabetically, because the
 * order is the pedagogy: you cannot count fu before you can read a hand.
 */

import { Link } from 'react-router-dom'
import { Badge, Button, Card } from '../components/ui'
import { ALL_GENERATORS } from '../drills/generators'
import { useT, type MessageKey } from '../i18n'
import { accuracy, weakestDrills } from '../store/progress'
import { useProgress } from '../store/useProgress'

const MODULES = [
  { id: 'tiles', path: '/tiles' },
  { id: 'shapes', path: '/shapes' },
  { id: 'yaku', path: '/yaku' },
  { id: 'han', path: '/han' },
  { id: 'fu', path: '/fu' },
  { id: 'score', path: '/score' },
  { id: 'efficiency', path: '/efficiency' },
] as const

/**
 * Drill names come from the generators themselves rather than a second list
 * here, so a renamed drill cannot end up with two different names on screen.
 */
const DRILL_TITLE_KEYS: Record<string, MessageKey> = Object.fromEntries(
  ALL_GENERATORS.map((g) => [g.id, g.titleKey]),
)

export function Home() {
  const t = useT()
  const { progress, reset } = useProgress()
  const weakest = weakestDrills(progress).slice(0, 3)
  const drillName = (id: string) => (DRILL_TITLE_KEYS[id] ? t.t(DRILL_TITLE_KEYS[id]) : id)
  const read = new Set(progress.completedLessons)

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t.t('app.name')}</h1>
        <p className="mt-2 max-w-2xl text-black/65 dark:text-white/65">{t.t('app.tagline')}</p>
      </header>

      {progress.streak.current > 0 && (
        <Card>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span>{t.t('home.streak', { n: progress.streak.current })}</span>
            <span className="text-black/55 dark:text-white/55">
              {t.t('home.bestStreak', { n: progress.streak.best })}
            </span>
            {weakest.length > 0 && (
              <span className="text-black/55 dark:text-white/55">
                {t.t('home.review', { list: weakest.map(drillName).join(', ') })}
              </span>
            )}
            <Button variant="ghost" onClick={reset} className="ml-auto">
              {t.t('home.reset')}
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {MODULES.map((module, index) => (
          <Link key={module.id} to={module.path} className="group">
            <Card className="h-full transition group-hover:border-felt-700/30 group-hover:shadow-md dark:group-hover:border-white/25">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-mono text-xs text-black/35 dark:text-white/35">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h2 className="font-semibold">
                  {t.t(`module.${module.id}.title` as MessageKey)}
                </h2>
                {read.has(module.id) && <Badge tone="good">{t.t('home.read')}</Badge>}
              </div>
              <p className="text-sm text-black/60 dark:text-white/60">
                {t.t(`module.${module.id}.blurb` as MessageKey)}
              </p>
            </Card>
          </Link>
        ))}

        <Link to="/sandbox" className="group">
          <Card className="h-full transition group-hover:border-felt-700/30 group-hover:shadow-md dark:group-hover:border-white/25">
            <div className="mb-1 flex items-center gap-2">
              <span className="font-mono text-xs text-black/35 dark:text-white/35">••</span>
              <h2 className="font-semibold">{t.t('home.sandbox')}</h2>
            </div>
            <p className="text-sm text-black/60 dark:text-white/60">{t.t('home.sandboxBlurb')}</p>
          </Card>
        </Link>
      </div>

      {Object.keys(progress.drills).length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">{t.t('home.accuracy')}</h2>
          <Card>
            {Object.entries(progress.drills).map(([id, stats]) => {
              const rate = accuracy(stats)
              return (
                <div
                  key={id}
                  className="flex items-center justify-between gap-4 border-b border-dashed border-black/10 py-2 last:border-0 dark:border-white/10"
                >
                  <span className="text-sm">{drillName(id)}</span>
                  <span className="font-mono text-sm tabular-nums text-black/60 dark:text-white/60">
                    {rate === null ? '—' : `${Math.round(rate * 100)}%`} ({stats.correct}/
                    {stats.attempts})
                  </span>
                </div>
              )
            })}
          </Card>
        </section>
      )}

      <footer className="border-t border-black/10 pt-6 text-sm text-black/50 dark:border-white/10 dark:text-white/50">
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
      </footer>
    </div>
  )
}
