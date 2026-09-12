/**
 * The glossary: a reference page, not a lesson.
 *
 * It deliberately does not use `Lesson`. That shell carries mastery, a quiz and
 * a progress meter, none of which a reference has — and wiring it up with an
 * empty drill list would put a "0 of 6 points" bar on a page nobody can earn
 * points on. So this is a plain page, and the chapter is listed as optional.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Card, SectionTitle, stagger } from '../components/ui'
import { GLOSSARY, GLOSSARY_TERMS, matchesQuery } from '../content/glossary'
import { CHAPTERS } from '../content/chapters'
import { useT, type MessageKey } from '../i18n'
import { useProgress } from '../store/useProgress'

/** Chapter path -> nav label, so a cross-reference names the module as the nav does. */
const CHAPTER_LABELS: Record<string, MessageKey> = Object.fromEntries(
  CHAPTERS.map((c) => [c.path, c.navKey]),
)

export function GlossaryPage() {
  const t = useT()
  const { readLesson } = useProgress()
  const [query, setQuery] = useState('')

  // Marked read like any lesson, which is what puts the "Read" badge on its card.
  // It earns no mastery points either way: the glossary is not in CHAPTER_IDS.
  useEffect(() => {
    readLesson('glossary')
  }, [readLesson])

  /**
   * Filtering keeps the groups rather than flattening to a hit list: the group
   * a term sits in is part of what the page teaches, and a bare list of matches
   * throws that away just when a searcher is least oriented.
   */
  const groups = useMemo(
    () =>
      GLOSSARY.map((group) => ({
        ...group,
        terms: group.terms.filter((term) =>
          matchesQuery(term, t.t(`glossary.${term.slug}` as MessageKey), query),
        ),
      })).filter((group) => group.terms.length > 0),
    [query, t],
  )

  const shown = groups.reduce((n, group) => n + group.terms.length, 0)
  const searching = query.trim() !== ''

  return (
    <article className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
      <header className="anim-fade-up">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-balance">
            {t.t('module.glossary.title')}
          </h1>
          <Badge>{t.t('glossary.optional')}</Badge>
        </div>
        <p className="mt-2 max-w-2xl text-lg text-black/60 dark:text-white/60">
          {t.t('glossary.subtitle')}
        </p>
      </header>

      <Card className="anim-fade-up" style={stagger(1, 90)}>
        <p className="text-base leading-relaxed text-black/75 dark:text-white/75">
          {t.t('glossary.intro')}
        </p>
      </Card>

      <div className="anim-fade-up flex flex-wrap items-center gap-3" style={stagger(2, 90)}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.t('glossary.search')}
          aria-label={t.t('glossary.search')}
          className="w-full max-w-sm rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-base transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25 dark:border-white/15 dark:bg-felt-900"
        />
        <span className="font-mono text-xs tabular-nums text-black/50 dark:text-white/50">
          {searching
            ? t.t('glossary.matches', { n: shown, total: GLOSSARY_TERMS.length })
            : t.t('glossary.count', { n: GLOSSARY_TERMS.length })}
        </span>
      </div>

      {groups.length === 0 && (
        <Card className="anim-fade-up">
          <p className="text-black/65 dark:text-white/65">{t.t('glossary.empty', { q: query })}</p>
          <button
            type="button"
            onClick={() => setQuery('')}
            className="mt-3 text-sm font-semibold underline underline-offset-2"
          >
            {t.t('glossary.clear')}
          </button>
        </Card>
      )}

      {groups.map((group, groupIndex) => (
        <section key={group.id} className="anim-fade-up" style={stagger(groupIndex + 3, 55)}>
          <SectionTitle>{t.t(group.titleKey)}</SectionTitle>
          <Card>
            <dl>
              {group.terms.map((term, i) => (
                <div
                  key={term.slug}
                  className="border-b border-dashed border-black/10 py-3 first:pt-0 last:border-0 last:pb-0 dark:border-white/10"
                  style={stagger(i, 30)}
                >
                  <dt className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="font-semibold text-black dark:text-white">{term.term}</span>
                    {/* The Japanese is lang-tagged so a screen reader hands it to
                        a Japanese voice rather than spelling it out in the page's
                        own language. */}
                    {term.jp && (
                      <span lang="ja" className="text-sm text-black/45 dark:text-white/45">
                        {term.jp}
                      </span>
                    )}
                    {term.chapter && (
                      <Link
                        to={term.chapter}
                        title={t.t('glossary.taughtIn')}
                        className="ml-auto shrink-0 text-xs font-semibold text-felt-700 underline underline-offset-2 transition hover:text-black dark:text-gold-300 dark:hover:text-white"
                      >
                        {t.t(CHAPTER_LABELS[term.chapter])}
                      </Link>
                    )}
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-black/65 dark:text-white/65">
                    {t.t(`glossary.${term.slug}` as MessageKey)}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </section>
      ))}
    </article>
  )
}
