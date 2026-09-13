import { useEffect } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { Home } from './routes/Home'
import { TilesLesson } from './routes/Tiles'
import { ShapesLesson } from './routes/Shapes'
import { YakuLesson } from './routes/Yaku'
import { HanLesson } from './routes/Han'
import { FuLesson } from './routes/Fu'
import { ScoreLesson } from './routes/Score'
import { EfficiencyLesson } from './routes/Efficiency'
import { GlossaryPage } from './routes/Glossary'
import { LANGS, LANG_LABELS, useI18n } from './i18n'
import { CHAPTERS, CHAPTER_IDS, OPTIONAL_CHAPTERS } from './content/chapters'
import { completionRatio, totalXp } from './store/progress'
import { useProgress } from './store/useProgress'
import { Meter } from './components/ui'

/**
 * Course-wide mastery, for the nav.
 *
 * Hidden until the first points are earned: an empty bar on a first visit is a
 * progress indicator for progress nobody has had a chance to make yet. It is also
 * held back on small screens, where the nav already wraps to two rows.
 */
function MasteryChip() {
  const { t } = useI18n()
  const { progress } = useProgress()
  const xp = totalXp(progress)
  if (xp === 0) return null

  const percent = Math.round(completionRatio(progress, CHAPTER_IDS) * 100)
  return (
    <div className="hidden items-center gap-2 sm:flex" title={t.t('progress.xp', { n: xp })}>
      <span className="font-mono text-xs font-medium tabular-nums text-black/55 dark:text-white/55">
        {percent}%
      </span>
      <Meter
        value={percent}
        max={100}
        label={t.t('progress.overallLabel', { n: percent })}
        className="h-1.5 w-16"
      />
    </div>
  )
}

function LanguageToggle() {
  const { lang, setLang, t } = useI18n()
  return (
    <div
      className="flex overflow-hidden rounded-lg border border-black/10 dark:border-white/15"
      role="group"
      aria-label={t.t('lang.switch')}
    >
      {LANGS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLang(option)}
          aria-pressed={lang === option}
          className={`px-3 py-1.5 text-xs font-semibold transition duration-200 ${
            lang === option
              ? 'bg-felt-700 text-white dark:bg-felt-100 dark:text-felt-900'
              : 'text-black/55 hover:bg-black/5 dark:text-white/55 dark:hover:bg-white/10'
          }`}
        >
          {LANG_LABELS[option]}
        </button>
      ))}
    </div>
  )
}

/**
 * The chapter links, as one row.
 *
 * Nine links wrapped to three rows on a phone, which is a third of a short
 * screen given over to navigation on every page. So below `sm` the row scrolls
 * sideways instead of wrapping: one line tall, with the whole ladder still
 * reachable by swiping it. `shrink-0` on each link is what stops flexbox from
 * squeezing nine items into the visible width instead of overflowing;
 * `snap-start` makes the swipe settle on a link rather than mid-word.
 *
 * The gradient at the right edge is the affordance — with a hidden scrollbar,
 * a row that simply ends looks like a row that has ended. It is `hidden` under
 * `sm:` because above that the links fit and nothing scrolls.
 */
function ChapterLinks() {
  const { t } = useI18n()
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative shrink-0 snap-start rounded-lg px-2.5 py-1.5 text-sm transition duration-200 sm:px-3 ${
      isActive
        ? 'bg-black/[0.07] font-semibold dark:bg-white/15'
        : 'text-black/60 hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white'
    }`

  return (
    <div className="relative min-w-0 flex-1">
      <div className="flex snap-x items-center gap-x-1 overflow-x-auto scroll-smooth [scrollbar-width:none] sm:flex-wrap sm:gap-y-1 sm:overflow-visible [&::-webkit-scrollbar]:hidden">
        {CHAPTERS.map((item) => (
          <NavLink key={item.path} to={item.path} className={linkClass}>
            {t.t(item.navKey)}
          </NavLink>
        ))}
        {/* The optional modules follow the ladder, behind a divider: they are
            reachable from the nav, but putting them in the same run would imply
            they are step eight of a seven-step course. */}
        {OPTIONAL_CHAPTERS.length > 0 && (
          <span
            aria-hidden="true"
            className="mx-1.5 h-4 w-px shrink-0 bg-black/15 dark:bg-white/20"
          />
        )}
        {OPTIONAL_CHAPTERS.map((item) => (
          <NavLink key={item.path} to={item.path} className={linkClass}>
            {t.t(item.navKey)}
          </NavLink>
        ))}
      </div>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-felt-900 to-transparent sm:hidden"
      />
    </div>
  )
}

function Nav() {
  const { t } = useI18n()
  return (
    <nav className="sticky top-0 z-20 border-b border-black/10 bg-felt-50/80 backdrop-blur-md dark:border-white/10 dark:bg-felt-900/80">
      <div className="mx-auto flex max-w-5xl items-center gap-x-2 px-3 py-2 sm:gap-x-1 sm:px-6 sm:py-2.5">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 text-base font-bold tracking-tight transition hover:opacity-80 sm:mr-4 sm:text-lg"
        >
          {/* A gold lozenge for a wordmark: the app has no logo, and the bare
              word read as just another nav item beside the eight that follow. */}
          <span
            aria-hidden="true"
            className="h-5 w-1.5 rounded-full bg-gradient-to-b from-gold-300 to-gold-500"
          />
          {/* On a phone the lozenge alone is the home link. The full wordmark was
              taking half the strip and leaving the nine chapter links about
              120px to scroll within — and the name is already on the page below
              it, where the hero states it at four times the size. */}
          <span className="hidden sm:inline">{t.t('app.name')}</span>
          <span className="sr-only sm:hidden">{t.t('app.name')}</span>
        </Link>
        <ChapterLinks />
        <div className="flex shrink-0 items-center gap-3">
          <MasteryChip />
          <LanguageToggle />
        </div>
      </div>
    </nav>
  )
}

export default function App() {
  const { pathname } = useLocation()

  // Scrolled to the top on navigation, because the router preserves scroll
  // position and a lesson opened from halfway down the home page would
  // otherwise start halfway down.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="min-h-full">
      <Nav />
      {/* Keyed on the path so each page fades in — with no transition, a route
          change is an instant repaint that gives the eye nothing to follow. */}
      <div key={pathname} className="anim-fade-in">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tiles" element={<TilesLesson />} />
          <Route path="/shapes" element={<ShapesLesson />} />
          <Route path="/yaku" element={<YakuLesson />} />
          <Route path="/han" element={<HanLesson />} />
          <Route path="/fu" element={<FuLesson />} />
          <Route path="/score" element={<ScoreLesson />} />
          <Route path="/efficiency" element={<EfficiencyLesson />} />
          <Route path="/glossary" element={<GlossaryPage />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </div>
    </div>
  )
}
