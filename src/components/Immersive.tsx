/**
 * Immersive mode: the quiz alone, filling the screen.
 *
 * A phone browser spends a third of a short screen on its own chrome, and the
 * app spends more of it on a sticky nav — so a drill that is a context strip, a
 * fourteen-tile hand and four answers arrives already scrolled. This hands the
 * whole viewport to the quiz for the duration of a run.
 *
 * It is two layers, because no single mechanism works everywhere:
 *
 * 1. A CSS layer — `position: fixed` over the page — which works in every
 *    browser and is the entire feature on an iPhone.
 * 2. The Fullscreen API on top, when the browser has it, which also takes the
 *    browser's own chrome; and `screen.orientation.lock('landscape')` on top of
 *    *that*, which turns the phone sideways so a hand gets the long edge.
 *
 * Each layer is strictly an improvement on the one below, and each is attempted
 * and allowed to fail silently, so the feature degrades rather than breaking:
 *
 * | Browser            | Fills viewport | Hides browser chrome | Forces landscape |
 * | ------------------ | -------------- | -------------------- | ---------------- |
 * | Android Chrome     | yes            | yes                  | yes              |
 * | Desktop            | yes            | yes                  | n/a              |
 * | iPadOS Safari      | yes            | yes                  | no               |
 * | iPhone Safari      | yes            | no                   | no               |
 *
 * The bottom row is why `RotateHint` exists: where the page cannot turn the
 * phone it asks the reader to, and says nothing at all once they have.
 */

import { type RefObject, useCallback, useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Button } from './ui'

/** Safari still ships the prefixed spelling; iPadOS is a real target. */
interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void
}

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

/**
 * `ScreenOrientation.lock` is absent from the DOM typings in some TS releases
 * and present in others, so it is reached through a narrow shape of our own
 * rather than a cast that would break whenever that changes.
 */
interface Lockable {
  lock?: (orientation: string) => Promise<void>
  unlock?: () => void
}

function currentFullscreenElement(): Element | null {
  const doc = document as FullscreenDocument
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null
}

function orientationApi(): Lockable | undefined {
  if (typeof screen === 'undefined') return undefined
  return screen.orientation as unknown as Lockable | undefined
}

export interface Immersive {
  active: boolean
  enter: () => void
  exit: () => void
  toggle: () => void
}

export function useImmersive(ref: RefObject<HTMLElement | null>): Immersive {
  const [active, setActive] = useState(false)

  const enter = useCallback(() => {
    // Set first and unconditionally: the CSS layer is the part that always
    // works, and the two calls below are enhancements on top of it.
    setActive(true)

    const el = ref.current as FullscreenElement | null
    if (!el) return

    const request = el.requestFullscreen
      ? () => el.requestFullscreen({ navigationUI: 'hide' })
      : el.webkitRequestFullscreen
        ? () => el.webkitRequestFullscreen?.()
        : undefined
    if (!request) return

    // Chained rather than fired together: the orientation lock is rejected
    // outright unless the document is already fullscreen. Both rejections are
    // swallowed — a browser that refuses either is not an error case, it is the
    // table above.
    Promise.resolve(request())
      .then(() => orientationApi()?.lock?.('landscape'))
      .catch(() => {})
  }, [ref])

  const exit = useCallback(() => {
    setActive(false)

    // Unlocking is what lets the phone follow its rotation setting again. It
    // throws synchronously on platforms with no lock to release.
    try {
      orientationApi()?.unlock?.()
    } catch {
      /* nothing was locked */
    }

    if (!currentFullscreenElement()) return
    const doc = document as FullscreenDocument
    const leave = document.exitFullscreen
      ? () => document.exitFullscreen()
      : doc.webkitExitFullscreen
        ? () => doc.webkitExitFullscreen?.()
        : undefined
    Promise.resolve(leave?.()).catch(() => {})
  }, [])

  const toggle = useCallback(() => {
    if (active) exit()
    else enter()
  }, [active, enter, exit])

  useEffect(() => {
    if (!active) return

    // The browser can leave fullscreen without us: Escape, the Android back
    // gesture, a system dialog. When it does, the CSS layer has to come off too
    // or the page is left in a half-immersive state with no way out.
    const onFullscreenChange = () => {
      if (!currentFullscreenElement()) setActive(false)
    }
    // Escape is handled by the browser in real fullscreen, but on the CSS-only
    // path — an iPhone, or a browser that refused the request — nothing else
    // would dismiss it from a keyboard.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exit()
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('webkitfullscreenchange', onFullscreenChange)
    document.addEventListener('keydown', onKeyDown)
    // Stops the page behind the overlay from scrolling under a touch that runs
    // past the end of the quiz.
    document.body.classList.add('immersive-open')

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('immersive-open')
    }
  }, [active, exit])

  return { active, enter, exit, toggle }
}

/** Tracks a media query, re-rendering when it starts or stops matching. */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}

export function ImmersiveButton({ immersive }: { immersive: Immersive }) {
  const t = useT()
  return (
    <Button
      variant="secondary"
      onClick={immersive.toggle}
      className="shrink-0 px-3 py-2 text-xs sm:px-4 sm:text-sm short:py-1.5 short:text-xs"
    >
      {/* Arrows out of a box, and back into one: the same pair every video
          player uses, so the button reads before its label does. */}
      <span aria-hidden="true" className="mr-1.5">
        {immersive.active ? '⤡' : '⤢'}
      </span>
      {t.t(immersive.active ? 'quiz.immersiveExit' : 'quiz.immersive')}
    </Button>
  )
}

/**
 * The nudge shown when the page could not turn the phone itself.
 *
 * Portrait *and* narrow, so it never appears on a desktop window that happens
 * to be taller than it is wide. It carries no dismiss control on purpose: the
 * action it asks for is the one that dismisses it.
 */
export function RotateHint() {
  const t = useT()
  const show = useMediaQuery('(orientation: portrait) and (max-width: 767px)')
  if (!show) return null

  return (
    <p className="anim-fade-in mb-2 flex items-center justify-center gap-2 rounded-lg bg-gold-400/15 px-3 py-1.5 text-center text-xs font-medium text-gold-300">
      <span aria-hidden="true">⟳</span>
      {t.t('quiz.rotate')}
    </p>
  )
}
