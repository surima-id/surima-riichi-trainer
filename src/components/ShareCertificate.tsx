/**
 * The share affordance: a button, and a panel to see the card before sending it.
 *
 * The preview exists because the alternative is posting something you have not
 * looked at. It also does the real work of the design: the card is generated the
 * moment the panel opens, so by the time the share button is tapped the blob is
 * ready and the tap reaches `navigator.share` with its user activation intact.
 * See `src/share/share.ts` for why that matters.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { type CertSize, type CertSubject, renderCertificate, shareFilename } from '../share/certificate'
import { canShareFiles, shareImage } from '../share/share'
import { useT } from '../i18n'
import { Button, Card } from './ui'

const SIZES: { id: CertSize; key: 'share.sizeSquare' | 'share.sizeStory' }[] = [
  { id: 'square', key: 'share.sizeSquare' },
  { id: 'story', key: 'share.sizeStory' },
]

export function ShareCertificate({
  subject,
  className = '',
}: {
  /** Built by the caller, which is what knows the milestone being shared. */
  subject: CertSubject
  className?: string
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [size, setSize] = useState<CertSize>('square')
  // Keyed by size so a result from the previous size is ignored rather than
  // shown: the render derives "still working" from the key not matching, which
  // is what lets the effect avoid resetting state on the way in.
  const [result, setResult] = useState<{ key: string; url: string | null } | null>(null)

  // Held as a promise rather than a blob so the click handler can await it
  // without spending the user activation: an already-settled promise resolves in
  // a microtask.
  const pending = useRef<Promise<Blob> | null>(null)
  const objectUrl = useRef<string | null>(null)

  const revoke = useCallback(() => {
    if (objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current)
      objectUrl.current = null
    }
  }, [])

  // Regenerated whenever the panel opens or the size changes, which is also what
  // keeps the preview honest about what would be shared.
  //
  // The result is one piece of state rather than a `url`/`failed` pair, so the
  // effect has nothing to reset on the way in: a stale preview cannot survive a
  // size change, because the render for the new size reads `null` until its own
  // job resolves.
  useEffect(() => {
    if (!open) return
    let cancelled = false

    const job = renderCertificate(subject, size)
    pending.current = job

    job
      .then((blob) => {
        if (cancelled) return
        revoke()
        const next = URL.createObjectURL(blob)
        objectUrl.current = next
        setResult({ key: `${size}`, url: next })
      })
      .catch(() => {
        if (!cancelled) setResult({ key: `${size}`, url: null })
      })

    return () => {
      cancelled = true
    }
  }, [open, size, subject, revoke])

  useEffect(() => revoke, [revoke])

  const current = result?.key === size ? result : null
  const url = current?.url ?? null
  const failed = current !== null && current.url === null
  const filename = shareFilename(subject, size)
  const sharable = canShareFiles()

  const onShare = async () => {
    const job = pending.current
    if (!job) return
    try {
      const blob = await job
      const outcome = await shareImage(blob, filename, {
        title: subject.caption,
        text: t.t('share.shareText', { site: t.t('app.site') }),
        url: t.t('app.siteUrl'),
      })
      // A cancelled sheet is the user's decision, not an error.
      if (outcome === 'failed') setResult({ key: size, url: null })
    } catch {
      setResult({ key: size, url: null })
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} className={className}>
        <span aria-hidden="true" className="mr-1.5">
          ↗
        </span>
        {t.t('share.button')}
      </Button>
    )
  }

  return (
    <Card className={`anim-slide-down w-full border-l-2 border-gold-400 ${className}`}>
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-black/45 dark:text-white/45">
          {t.t('share.title')}
        </h3>
        <div
          className="ml-auto flex gap-1.5 rounded-xl border border-black/10 bg-black/[0.03] p-1 dark:border-white/10 dark:bg-white/[0.04]"
          role="tablist"
        >
          {SIZES.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={size === option.id}
              onClick={() => setSize(option.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition duration-200 ${
                size === option.id
                  ? 'bg-white text-black shadow-sm dark:bg-felt-700 dark:text-white'
                  : 'text-black/55 hover:text-black dark:text-white/55 dark:hover:text-white'
              }`}
            >
              {t.t(option.key)}
            </button>
          ))}
        </div>
      </div>

      {/* The preview is a CSS-sized img of the blob, so the export stays at its
          own fixed pixel size and device pixel ratio never enters into it. */}
      <div className="mt-4 flex justify-center">
        {url ? (
          <img
            src={url}
            alt={subject.caption}
            className={`rounded-xl border border-black/10 shadow-sm dark:border-white/10 ${
              size === 'story' ? 'max-h-80' : 'max-h-64'
            }`}
          />
        ) : (
          <p className="py-10 text-sm text-black/55 dark:text-white/55">
            {failed ? t.t('share.failed') : t.t('share.preparing')}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {sharable && (
          <Button onClick={onShare} disabled={!url}>
            {t.t('share.button')}
          </Button>
        )}
        {/* A real anchor, not a scripted click: Safari blocks programmatic
            downloads that follow an await. */}
        {url && (
          <a
            href={url}
            download={filename}
            className="rounded-xl border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-black/80 transition duration-200 hover:-translate-y-0.5 hover:bg-black/5 dark:border-white/15 dark:bg-transparent dark:text-white/85 dark:hover:bg-white/10"
          >
            {t.t('share.save')}
          </a>
        )}
        <Button variant="ghost" onClick={() => setOpen(false)} className="ml-auto">
          {t.t('share.close')}
        </Button>
      </div>
    </Card>
  )
}
