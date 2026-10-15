import { afterEach, describe, expect, it } from 'vitest'
import { drawNames } from './XRMenu'
import { LINE_HEIGHT } from './canvasPanel'
import { recordingCanvas, legibilityProblems, type DrawnText } from './legibility'
import { MENU_PANEL } from './XRMenu'
import { GAME_MODE_HINTS, GAME_MODE_ORDER } from '../../lib/gameMode'
import {
  MENU_TEXT,
  MENU_TITLE,
  XR_MENU_DESK_POSE,
  XR_MENU_HIT,
  XR_MENU_OPTIONS_OFFSET,
  XR_MENU_POSE,
  XR_MENU_SPOT,
  type MenuPose,
  xrPanelViews,
} from '../../lib/xrLayout'
import {
  MIN_READING_DEGREES,
  centreInside,
  eyesAt,
  sizesOffList,
  textsOnButtons,
  unreadableTexts,
  worstReadingDistance,
} from '../../lib/panelReading'
import { translator } from '../../lib/textos'
import { PLAYER_COUNT_HINTS } from '../../lib/duel'
import { MENU_EN } from '../../lib/menuWords'
import { setGameName } from '../../lib/menuTemplate'

/** Folded, as it opens, and unfolded behind «Más opciones». */
const FOLD_STATES = [false, true] as const

/**
 * The labels of the menu's panel, measured instead of looked at.
 *
 * In the two languages: Spanish is longer and is where a name runs off the
 * panel, overlaps the next one or shrinks until it cannot be read at the distance
 * it is played at. That, with the headset on, costs a testing session.
 */

const LANGUAGES = ['en', 'es'] as const
const MEASURED_PANEL = { width: MENU_PANEL[0], height: MENU_PANEL[1] }

/**
 * The two places where the menu is read: the headset's column —a metre and a half away, on the left,
 * turned and bigger— and in front, without a headset (the hall on desktop). At three eye heights and
 * with the world standing or not.
 */
const PLACES: { name: string; pose: MenuPose }[] = [
  { name: 'headset column', pose: XR_MENU_POSE },
  { name: 'desktop', pose: XR_MENU_DESK_POSE },
]

function viewsOf(pose: MenuPose) {
  return xrPanelViews(pose.position, pose.yaw)
}

/** What was written, at the scale the panel is painted at: the group's scale enlarges everything. */
function atScale(drawnTexts: readonly DrawnText[], scale: number): DrawnText[] {
  return drawnTexts.map((e) => ({ ...e, x: e.x * scale, y: e.y * scale, width: e.width * scale, height: e.height * scale }))
}

/** At what distance the problems are measured: the reading one of the text that reads worst, with the foreshortening. */
function distance(drawnTexts: readonly DrawnText[], pose: MenuPose): number {
  return Math.max(...viewsOf(pose).map(({ pose: view, eyes }) => worstReadingDistance(drawnTexts, view, eyes, LINE_HEIGHT)))
}

describe('the names of the menu rows read', () => {
  it('in the two languages', () => {
    for (const lang of LANGUAGES) {
      for (const gameMode of GAME_MODE_ORDER) {
        for (const moreOptions of FOLD_STATES) {
          const { ctx, drawnTexts } = recordingCanvas()
          drawNames(ctx, translator(lang), gameMode, 1, moreOptions)
          expect(drawnTexts.length, 'nothing was measured').toBeGreaterThan(0)
          for (const { name, pose } of PLACES) {
            const scaled = atScale(drawnTexts, pose.scale)
            const panel = { width: MEASURED_PANEL.width * pose.scale, height: MEASURED_PANEL.height * pose.scale }
            expect(
              legibilityProblems(scaled, { panel, distance: distance(scaled, pose) }),
              `${lang} ${gameMode} ${moreOptions ? 'unfolded' : 'folded'}, ${name}`,
            ).toEqual([])
          }
        }
      }
    }
  })

  /**
   * And what this came to fix: inside the headset the modes were **only names**
   * and what tells them apart was only told by the website's screen.
   */
  it('say what the chosen mode is', () => {
    for (const lang of LANGUAGES) {
      const t = translator(lang)
      for (const gameMode of GAME_MODE_ORDER) {
        const { ctx, drawnTexts } = recordingCanvas()
        drawNames(ctx, t, gameMode)
        const phrase = t(GAME_MODE_HINTS[gameMode])
        expect(drawnTexts.some((e) => phrase.startsWith(e.text.trim())), `${lang} ${gameMode}`).toBe(
          true,
        )
      }
    }
  })

  it('the mode row says «Modo» and which one is chosen: the one that counts for a medal, «Reto»', () => {
    const written = (lang: (typeof LANGUAGES)[number], gameMode: (typeof GAME_MODE_ORDER)[number]) => {
      const { ctx, drawnTexts } = recordingCanvas()
      drawNames(ctx, translator(lang), gameMode)
      return drawnTexts.map((e) => e.text)
    }

    expect(written('es', 'challenge')).toContain('Modo: Reto')
    expect(written('en', 'challenge')).toContain('Mode: Challenge')
    expect(written('es', 'practice')).toContain('Modo: Práctica')
    expect(written('es', 'levels')).toContain('Modo: Niveles')
    // What it explains underneath starts with whether it counts for a medal.
    expect(written('es', 'challenge').join(' ')).toContain('Cuenta para medalla.')
    expect(written('es', 'practice').join(' ')).toContain('Sin medalla.')
  })

  /**
   * The control of the measurement itself: a panel of which nothing was read would give
   * zero problems just like a perfect one. Narrowed to half it has to complain.
   */
  it('and the measurement notices when they do not fit', () => {
    const { ctx, drawnTexts } = recordingCanvas()
    drawNames(ctx, translator('es'))
    const narrow = { width: MEASURED_PANEL.width / 3, height: MEASURED_PANEL.height }
    expect(legibilityProblems(drawnTexts, { panel: narrow }).join(' ')).toContain(
      'runs off the panel',
    )
  })
})

/**
 * Everything the panel can write: each mode, and the two-player challenge, in the two languages, folded
 * and unfolded.
 */
function allMoments(): { where: string; drawnTexts: DrawnText[] }[] {
  return LANGUAGES.flatMap((lang) =>
    [...GAME_MODE_ORDER, 'two players' as const].flatMap((moment) =>
      FOLD_STATES.map((moreOptions) => {
        const gameMode = moment === 'two players' ? 'challenge' : moment
        const { ctx, drawnTexts } = recordingCanvas()
        drawNames(ctx, translator(lang), gameMode, moment === 'two players' ? 2 : 1, moreOptions)
        return { where: `${lang} ${moment}${moreOptions ? ' unfolded' : ''}`, drawnTexts }
      }),
    ),
  )
}

/**
 * The cabinet's name, top left, as in the other games of the hall: before, it was only
 * read on the web cover. It is a proper name: it does not go through `t()`.
 */
describe('the panel says what the cabinet is called', () => {
  afterEach(() => setGameName(null))

  const title = (drawnTexts: readonly DrawnText[]) => drawnTexts.find((e) => e.y === MENU_TITLE.y)

  it('in each mode and language, without translating it', () => {
    for (const { where, drawnTexts } of allMoments()) {
      expect(title(drawnTexts)?.text, where).toBe('Stick Rush')
    }
  })

  it('the one the hall gives it, and a long one fits without shrinking or overlapping anything', () => {
    // The longest name a cabinet of the catalogue can bring, and a bit more.
    setGameName('Atrapa los palos que caen del aro')
    for (const { where, drawnTexts } of allMoments()) {
      expect(title(drawnTexts)?.text, where).toBe('Atrapa los palos que caen del aro')
      expect(sizesOffList(drawnTexts, LINE_HEIGHT, Object.values(MENU_TEXT)), where).toEqual([])
      for (const { name, pose } of PLACES) {
        const scaled = atScale(drawnTexts, pose.scale)
        const panel = { width: MEASURED_PANEL.width * pose.scale, height: MEASURED_PANEL.height * pose.scale }
        expect(legibilityProblems(scaled, { panel, distance: distance(scaled, pose) }), `${where}, ${name}`).toEqual([])
        for (const view of viewsOf(pose)) {
          expect(unreadableTexts(scaled, view.pose, view.eyes, LINE_HEIGHT), `${where}, ${name}, ${view.where}`).toEqual([])
        }
      }
    }
  })
})

describe('the «Más opciones» button', () => {
  const written = (lang: (typeof LANGUAGES)[number], gameMode: (typeof GAME_MODE_ORDER)[number], moreOptions: boolean) => {
    const { ctx, drawnTexts } = recordingCanvas()
    drawNames(ctx, translator(lang), gameMode, 1, moreOptions)
    return drawnTexts.map((e) => e.text).join(' ')
  }

  it('says what it does, on its plate and in the two languages: unfold or fold again', () => {
    for (const gameMode of ['practice', 'levels'] as const) {
      expect(written('en', gameMode, false), gameMode).toContain('More options')
      expect(written('es', gameMode, false), gameMode).toContain('Más opciones')
      expect(written('en', gameMode, true), gameMode).toContain('Fewer options')
      expect(written('es', gameMode, true), gameMode).toContain('Menos opciones')
    }
  })

  it('and with the challenge it is not there: it is a fixed run', () => {
    for (const lang of LANGUAGES) {
      for (const moreOptions of FOLD_STATES) {
        const said = written(lang, 'challenge', moreOptions)
        expect(said).not.toContain(translator(lang)(MENU_EN.moreOptions).split(' ')[0])
        expect(said).not.toContain(translator(lang)(MENU_EN.fewerOptions).split(' ')[0])
      }
    }
  })

  it('what is folded is not named until it is asked for', () => {
    expect(written('es', 'practice', false)).not.toContain('Aro')
    expect(written('es', 'practice', false)).not.toContain('Velocidad')
    expect(written('es', 'practice', true)).toContain('Aro')
    expect(written('es', 'practice', true)).toContain('Velocidad')
  })
})

describe('for two, the menu says what it should', () => {
  it('names the "against whom" row and explains the two-player match, in the two languages', () => {
    for (const lang of LANGUAGES) {
      const t = translator(lang)
      const { ctx, drawnTexts } = recordingCanvas()
      drawNames(ctx, t, 'challenge', 2)
      const texts = drawnTexts.map((e) => e.text)
      expect(texts, lang).toContain(t('Players'))
      const phrase = t(PLAYER_COUNT_HINTS[2])
      expect(drawnTexts.some((e) => phrase.startsWith(e.text.trim())), lang).toBe(true)
    }
  })

  it('and only in the challenge: in practice, two players does not count', () => {
    const { ctx, drawnTexts } = recordingCanvas()
    drawNames(ctx, translator('en'), 'practice', 2)
    expect(drawnTexts.map((e) => e.text)).not.toContain('Players')
  })
})

/**
 * That each letter reads at a glance **from where it is played**, just as the canvas records it: the
 * size it was written with —shrunk included—, in its row and with the foreshortening.
 */
describe('every letter of the menu reads at a glance', () => {
  it(`none drops below ${MIN_READING_DEGREES}°, in any mode, language or eye height`, () => {
    for (const { where, drawnTexts } of allMoments()) {
      for (const { name, pose } of PLACES) {
        for (const view of viewsOf(pose)) {
          expect(
            unreadableTexts(atScale(drawnTexts, pose.scale), view.pose, view.eyes, LINE_HEIGHT),
            `${where}, ${name}, ${view.where}`,
          ).toEqual([])
        }
      }
    }
  })

  it('and all of them are written with a size from the list, without shrinking', () => {
    for (const { where, drawnTexts } of allMoments()) {
      expect(sizesOffList(drawnTexts, LINE_HEIGHT, Object.values(MENU_TEXT)), where).toEqual([])
    }
  })

  it('and no label gets into a button: the explanation passes between exit and «Más opciones»', () => {
    // The buttons are geometry and the instrument does not see them. The only text of a button is that of
    // «Más opciones», written on its plate; on the others any brush counts.
    const [ox, oy] = XR_MENU_OPTIONS_OFFSET
    const isItsOwn: typeof centreInside = (text, button) => button.x === ox && button.y === oy && centreInside(text, button)
    const buttons = Object.keys(XR_MENU_HIT).map((name) => ({
      x: XR_MENU_SPOT[name][0],
      y: XR_MENU_SPOT[name][1],
      width: XR_MENU_HIT[name][0],
      height: XR_MENU_HIT[name][1],
    }))
    for (const { where, drawnTexts } of allMoments()) {
      expect(textsOnButtons(drawnTexts, buttons, isItsOwn), where).toEqual([])
    }
  })

  it('the control: the explanation at 22 mm, right at the bottom, did not make it', () => {
    const { drawnTexts } = allMoments().find(({ where }) => where === 'es levels')!
    const last = drawnTexts.reduce((lowest, e) => (e.y < lowest.y ? e : lowest))
    const small = [{ ...last, height: 0.022 * LINE_HEIGHT }]
    expect(unreadableTexts(small, { position: XR_MENU_DESK_POSE.position }, eyesAt(1.6), LINE_HEIGHT)).toHaveLength(1)
  })

  it('and in the column, without enlarging the panel, the text would not make it', () => {
    // The control of the scale: a metre and a half away, the panel at its design size does not read.
    const { drawnTexts } = allMoments().find(({ where }) => where === 'es levels')!
    const failures = viewsOf(XR_MENU_POSE).flatMap((view) =>
      unreadableTexts(drawnTexts, view.pose, view.eyes, LINE_HEIGHT),
    )
    expect(failures.length).toBeGreaterThan(0)
  })
})
