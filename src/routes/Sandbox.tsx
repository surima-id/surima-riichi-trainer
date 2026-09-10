/**
 * Type in any hand and see it scored.
 *
 * This is both a learning tool — try a change and watch the fu move — and the
 * app's own debugging surface, since it exposes the engine directly.
 */

import { useMemo, useState } from 'react'
import { Hand } from '../components/Hand'
import { Breakdown } from '../components/Breakdown'
import { Card, SectionTitle } from '../components/ui'
import { scoreHandFull } from '../engine/explain'
import {
  EAST,
  NORTH,
  NotationError,
  SOUTH,
  WEST,
  type Wind,
  doraFromIndicator,
  parseTiles,
} from '../engine/tiles'
import { defaultContext } from '../engine/yaku'
import { useT, type MessageKey } from '../i18n'

const WIND_OPTIONS: Wind[] = [EAST, SOUTH, WEST, NORTH]

const PRESETS: { key: MessageKey; hand: string; win: string }[] = [
  { key: 'sandbox.preset.pinfu', hand: '234m22p345567678s', win: '8s' },
  { key: 'sandbox.preset.chiitoi', hand: '1133m5577p2299s11z', win: '1z' },
  { key: 'sandbox.preset.kokushi', hand: '19m19p19s12345677z', win: '7z' },
  { key: 'sandbox.preset.tanyao', hand: '234m567m22p345678s', win: '8s' },
  { key: 'sandbox.preset.chinitsu', hand: '234567m345m99m111m', win: '7m' },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-black/60 dark:text-white/60">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'rounded-lg border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-felt-900'

export function Sandbox() {
  const t = useT()
  const [handText, setHandText] = useState('234m22p345567678s')
  const [winText, setWinText] = useState('8s')
  const [doraText, setDoraText] = useState('')
  const [seatWind, setSeatWind] = useState<Wind>(EAST)
  const [roundWind, setRoundWind] = useState<Wind>(EAST)
  const [tsumo, setTsumo] = useState(false)
  const [riichi, setRiichi] = useState(false)

  const parsed = useMemo(() => {
    try {
      const concealed = parseTiles(handText)
      const win = parseTiles(winText)
      const dora = doraText.trim() ? parseTiles(doraText) : []
      if (win.length !== 1) throw new NotationError('expected-one-tile')
      return { concealed, winTile: win[0], dora, error: null as string | null }
    } catch (error) {
      // Notation problems carry a code, so the message is in the reader's
      // language rather than baked into the engine.
      return {
        concealed: [],
        winTile: 0,
        dora: [],
        error:
          error instanceof NotationError
            ? t.notationError(error)
            : t.t('error.unexpected-char', { char: '?' }),
      }
    }
  }, [handText, winText, doraText, t])

  const scored = useMemo(() => {
    if (parsed.error) return null
    const context = defaultContext({
      seatWind,
      roundWind,
      tsumo,
      riichi,
      doraIndicators: parsed.dora,
    })
    return scoreHandFull(
      { concealed: parsed.concealed, calls: [], winTile: parsed.winTile },
      context,
      { dealer: seatWind === EAST },
    )
  }, [parsed, seatWind, roundWind, tsumo, riichi])

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.t('sandbox.title')}</h1>
        <p className="mt-1 text-black/60 dark:text-white/60">{t.t('sandbox.subtitle')}</p>
      </header>

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.t('sandbox.hand')}>
            <input
              value={handText}
              onChange={(e) => setHandText(e.target.value)}
              className={`${inputClass} font-mono`}
              placeholder="234m22p345567678s"
            />
          </Field>
          <Field label={t.t('sandbox.winTile')}>
            <input
              value={winText}
              onChange={(e) => setWinText(e.target.value)}
              className={`${inputClass} font-mono`}
              placeholder="8s"
            />
          </Field>
          <Field label={t.t('sandbox.dora')}>
            <input
              value={doraText}
              onChange={(e) => setDoraText(e.target.value)}
              className={`${inputClass} font-mono`}
              placeholder="3m"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t.t('sandbox.seatWind')}>
              <select
                value={seatWind}
                onChange={(e) => setSeatWind(Number(e.target.value) as Wind)}
                className={inputClass}
              >
                {WIND_OPTIONS.map((wind) => (
                  <option key={wind} value={wind}>
                    {t.tile(wind)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t.t('sandbox.roundWind')}>
              <select
                value={roundWind}
                onChange={(e) => setRoundWind(Number(e.target.value) as Wind)}
                className={inputClass}
              >
                {WIND_OPTIONS.map((wind) => (
                  <option key={wind} value={wind}>
                    {t.tile(wind)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={tsumo} onChange={(e) => setTsumo(e.target.checked)} />
            {t.t('sandbox.tsumo')}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={riichi} onChange={(e) => setRiichi(e.target.checked)} />
            {t.t('sandbox.riichi')}
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => {
                setHandText(preset.hand)
                setWinText(preset.win)
              }}
              className="rounded-lg bg-black/5 px-3 py-1.5 text-xs transition hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
            >
              {t.t(preset.key)}
            </button>
          ))}
        </div>
      </Card>

      {parsed.error ? (
        <Card>
          <p className="text-sm text-rose-600 dark:text-rose-400">{parsed.error}</p>
        </Card>
      ) : (
        <>
          <Card>
            <SectionTitle>{t.t('sandbox.handSection')}</SectionTitle>
            <div className="overflow-x-auto">
              <Hand
                tiles={parsed.concealed}
                winTile={undefined}
                highlightFaces={parsed.dora.map(doraFromIndicator)}
              />
            </div>
          </Card>

          {scored && (
            <Card>
              <Breakdown scored={scored} dealer={seatWind === EAST} />
            </Card>
          )}
        </>
      )}
    </div>
  )
}
