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
import { LANGS, LANG_LABELS, useI18n, type MessageKey } from './i18n'

const NAV: { to: string; key: MessageKey }[] = [
  { to: '/tiles', key: 'nav.tiles' },
  { to: '/shapes', key: 'nav.shapes' },
  { to: '/yaku', key: 'nav.yaku' },
  { to: '/han', key: 'nav.han' },
  { to: '/fu', key: 'nav.fu' },
  { to: '/score', key: 'nav.score' },
  { to: '/efficiency', key: 'nav.efficiency' },
]

function LanguageToggle() {
  const { lang, setLang, t } = useI18n()
  return (
    <div
      className="ml-auto flex overflow-hidden rounded-lg border border-black/10 dark:border-white/15"
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

function Nav() {
  const { t } = useI18n()
  return (
    <nav className="sticky top-0 z-20 border-b border-black/10 bg-felt-50/80 backdrop-blur-md dark:border-white/10 dark:bg-felt-900/80">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-1 gap-y-1 px-4 py-2.5 sm:px-6">
        <Link
          to="/"
          className="mr-4 flex items-center gap-2 text-lg font-bold tracking-tight transition hover:opacity-80"
        >
          {/* A gold lozenge for a wordmark: the app has no logo, and the bare
              word read as just another nav item beside the eight that follow. */}
          <span
            aria-hidden="true"
            className="h-5 w-1.5 rounded-full bg-gradient-to-b from-gold-300 to-gold-500"
          />
          {t.t('app.name')}
        </Link>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `relative rounded-lg px-3 py-1.5 text-sm transition duration-200 ${
                isActive
                  ? 'bg-black/[0.07] font-semibold dark:bg-white/15'
                  : 'text-black/60 hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white'
              }`
            }
          >
            {t.t(item.key)}
          </NavLink>
        ))}
        <LanguageToggle />
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
          <Route path="*" element={<Home />} />
        </Routes>
      </div>
    </div>
  )
}
