import { Hand } from '../components/Hand'
import { Example, Lesson } from '../components/Lesson'
import { Tile } from '../components/Tile'
import { Card, LessonHeading, LineItem } from '../components/ui'
import { GENERATORS } from '../drills/generators'
import { type Call } from '../engine/parse'
import { parseTiles } from '../engine/tiles'
import { useT } from '../i18n'
import { type MessageKey } from '../i18n'

/**
 * The triplet fu table.
 *
 * Rows are keyed by the same catalog entries the scorer's own breakdown uses,
 * so what a learner memorizes here is word-for-word what they see in a result.
 *
 * Each row carries a sample meld as well as its label. The eight rows are four
 * distinctions crossed two ways — triplet or kan, concealed or open, simple or
 * terminal — and a reader working from the labels alone has to hold all three
 * axes in their head while scanning. Drawn melds make two of the three visible:
 * a sideways tile is a claimed one, four tiles is a kan, and the tile faces say
 * whether it is a simple or a terminal.
 */
const TRIPLET_ROWS: { key: MessageKey; fu: number; tiles: string; concealed: boolean }[] = [
  { key: 'fu.meld.triplet.open.simple', fu: 2, tiles: '555p', concealed: false },
  { key: 'fu.meld.triplet.concealed.simple', fu: 4, tiles: '555p', concealed: true },
  { key: 'fu.meld.triplet.open.terminal-honor', fu: 4, tiles: '999s', concealed: false },
  { key: 'fu.meld.triplet.concealed.terminal-honor', fu: 8, tiles: '999s', concealed: true },
  { key: 'fu.meld.kan.open.simple', fu: 8, tiles: '5555p', concealed: false },
  { key: 'fu.meld.kan.concealed.simple', fu: 16, tiles: '5555p', concealed: true },
  { key: 'fu.meld.kan.open.terminal-honor', fu: 16, tiles: '9999s', concealed: false },
  { key: 'fu.meld.kan.concealed.terminal-honor', fu: 32, tiles: '9999s', concealed: true },
]

/**
 * One meld from the table, drawn.
 *
 * Deliberately not `Hand`: this is a meld on its own rather than a hand, and
 * `Hand` would want a concealed run and a winning tile to sit it beside.
 *
 * The two conventions it borrows from `Hand` are the ones a player already reads
 * at a table — a claimed tile is laid sideways, and a concealed kan hides its
 * outer two tiles — which is what makes the concealed/open distinction legible
 * without a label.
 */
function MeldFigure({ tiles, concealed }: { tiles: string; concealed: boolean }) {
  const parsed = parseTiles(tiles)
  const isKan = parsed.length === 4

  return (
    <span className="flex items-end gap-px">
      {parsed.map((tile, i) => {
        const rotated = !concealed && i === 0
        return (
          // A rotated tile is turned with a CSS transform, which does not change
          // the width it reserves — so a sideways tile lays itself over its
          // neighbour unless its slot is widened to the height it now occupies.
          // A tile is 3:4, so a quarter turn needs four thirds of its width.
          <span key={i} className={rotated ? 'inline-flex w-[133%] items-end' : 'inline-flex'}>
            <Tile
              tile={tile}
              size="xs"
              // A concealed kan shows its two middle tiles only; an open meld
              // lays the claimed tile sideways. A concealed triplet is three
              // upright tiles with nothing to mark, which is itself the point.
              faceDown={concealed && isKan && (i === 0 || i === 3)}
              rotated={rotated}
            />
          </span>
        )
      })}
    </span>
  )
}

/**
 * The same hand twice, differing only in how its kan was obtained.
 *
 * A kan is the one meld whose fu a player cannot reach from the triplet rules:
 * it quadruples rather than doubles. Showing the closed and open versions side
 * by side isolates that — identical tiles, identical wait, and a meld worth
 * double, decided entirely by whether the fourth tile was drawn or claimed.
 *
 * Only the meld's own fu is named. A hand total would depend on the wait, the
 * win method and the closed-hand bonus, none of which this pair is holding
 * fixed, and the open version has no yaku at all, so it has no total to show.
 */
const KAN_EXAMPLE_TILES = '234p567p345s99s'
const KAN_EXAMPLE_WIN = '3s'

function kanCall(notation: string, kind: 'ankan' | 'minkan'): Call {
  const tiles = parseTiles(notation)
  return { kind, tile: tiles[0], tiles }
}

function KanExample({ kind }: { kind: 'ankan' | 'minkan' }) {
  return (
    <Hand
      tiles={parseTiles(KAN_EXAMPLE_TILES)}
      calls={[kanCall('1111m', kind)]}
      winTile={parseTiles(KAN_EXAMPLE_WIN)[0]}
      size="sm"
      sort={false}
    />
  )
}

export function FuLesson() {
  const t = useT()
  return (
    <Lesson
      id="fu"
      title={t.t('module.fu.title')}
      subtitle={t.t('lesson.fu.subtitle')}
      drills={[GENERATORS.fuCount]}
    >
      <p>
        <strong>{t.t('lesson.fu.p1a')}</strong> {t.t('lesson.fu.p1b')}
      </p>

      <div className="not-prose">
        <Card>
          <LineItem label={t.t('lesson.fu.rowBase')} value={t.fu(20)} />
          <LineItem
            label={t.t('lesson.fu.rowMenzenRon')}
            value={`+${t.fu(10)}`}
            detail={t.t('fu.menzen-ron.detail')}
          />
          <LineItem
            label={t.t('lesson.fu.rowTsumo')}
            value={`+${t.fu(2)}`}
            detail={t.t('lesson.fu.rowTsumoDetail')}
          />
          <LineItem
            label={t.t('lesson.fu.rowWait')}
            value={`+${t.fu(2)}`}
            detail={t.t('lesson.fu.rowWaitDetail')}
          />
          <LineItem label={t.t('lesson.fu.rowPair')} value={`+${t.fu(2)}`} />
        </Card>
      </div>

      <LessonHeading>{t.t('lesson.fu.h2Triplets')}</LessonHeading>
      <p>{t.t('lesson.fu.triplets')}</p>

      <div className="not-prose">
        <Card>
          {TRIPLET_ROWS.map((row) => (
            <LineItem
              key={row.key}
              // The figure leads, so the eight rows read as a column of shapes a
              // reader can compare down the page rather than as eight similar
              // sentences. It is decorative — the label says the same thing in
              // words — so it is hidden from screen readers.
              figure={
                // No fixed width: a kan is a tile wider than a triplet and an
                // open meld wider again, so a single column width either clips
                // the widest row or leaves a gap beside the narrowest.
                <span aria-hidden="true" className="shrink-0">
                  <MeldFigure tiles={row.tiles} concealed={row.concealed} />
                </span>
              }
              label={t.t(row.key)}
              value={t.fu(row.fu)}
            />
          ))}
        </Card>
      </div>

      <p className="pt-2">
        {t.t('lesson.fu.ronRule1')} <strong>{t.t('lesson.fu.ronRuleBold')}</strong>{' '}
        {t.t('lesson.fu.ronRule2')}
      </p>

      <LessonHeading>{t.t('lesson.fu.h2Special')}</LessonHeading>
      {/* One bullet each: three unrelated exceptions run together as prose read
          as one argument, and a learner scanning for "what is seven pairs worth"
          had to find it mid-sentence. */}
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>{t.t('lesson.fu.specialA')}</strong> {t.t('lesson.fu.specialB')}
        </li>
        <li>
          <strong>{t.t('lesson.fu.specialC')}</strong> {t.t('lesson.fu.specialD')}
        </li>
        <li>
          <strong>{t.t('lesson.fu.specialE')}</strong> {t.t('lesson.fu.specialF')}
        </li>
      </ul>

      <Example title={t.t('lesson.fu.exPinfu')}>
        <Hand tiles={parseTiles('234m22p345678s567s')} size="sm" sort={false} />
      </Example>

      <LessonHeading>{t.t('lesson.fu.h2Kan')}</LessonHeading>
      <p>{t.t('lesson.fu.kanIntro')}</p>

      <Example title={t.t('lesson.fu.exAnkan')}>
        <KanExample kind="ankan" />
        <p className="mt-2.5 text-sm text-black/60 dark:text-white/60">
          {t.t('lesson.fu.exAnkanNote')}
        </p>
      </Example>

      <Example title={t.t('lesson.fu.exMinkan')}>
        <KanExample kind="minkan" />
        <p className="mt-2.5 text-sm text-black/60 dark:text-white/60">
          {t.t('lesson.fu.exMinkanNote')}
        </p>
      </Example>

      <p>{t.t('lesson.fu.floor')}</p>
    </Lesson>
  )
}
