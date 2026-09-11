/**
 * The translated strings a card needs, assembled once.
 *
 * Four call sites share this so the copy and the date format cannot drift
 * between them.
 */

import { useMemo } from 'react'
import { type SubjectStrings } from './subject'
import { useI18n } from '../i18n'

/** Dates are formatted here: the catalogs carry no month names, deliberately. */
const LOCALES = { id: 'id-ID', en: 'en-GB' } as const

export function useSubjectStrings(percent: number): SubjectStrings {
  const { lang, t } = useI18n()
  return useMemo(
    () => ({
      mastered: t.t('share.certMastered'),
      course: t.t('share.certCourse'),
      progress: t.t('share.certProgress', { n: percent }),
      appName: t.t('app.name'),
      site: t.t('app.site'),
      dateLabel: new Date().toLocaleDateString(LOCALES[lang], {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    }),
    [t, lang, percent],
  )
}
