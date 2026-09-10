/**
 * Language state for the React tree.
 *
 * The choice persists per browser, following the same pattern as the progress
 * store. Nothing about it reaches the engine — only display text changes.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { z } from 'zod'
import { type Translator, createTranslator } from './translator'
import { DEFAULT_LANG, LANGS, type Lang } from './types'

const STORAGE_KEY = 'surima.lang.v1'
const LangSchema = z.enum(LANGS)

function loadLang(): Lang {
  try {
    const parsed = LangSchema.safeParse(localStorage.getItem(STORAGE_KEY))
    return parsed.success ? parsed.data : DEFAULT_LANG
  } catch {
    // Private browsing or blocked storage — the default is a fine answer.
    return DEFAULT_LANG
  }
}

interface LanguageValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Translator
}

const LanguageContext = createContext<LanguageValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(loadLang)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // Storage is a convenience here, never a requirement.
    }
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Lang) => setLangState(next), [])
  const t = useMemo(() => createTranslator(lang), [lang])
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useI18n(): LanguageValue {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useI18n must be used inside a LanguageProvider')
  return value
}

/** Shorthand for components that only need the translator. */
export function useT(): Translator {
  return useI18n().t
}
