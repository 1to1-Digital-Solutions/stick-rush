import { describe, expect, it } from 'vitest'
import { drawNotice } from './XRHud'
import { LINE_HEIGHT } from './canvasPanel'
import {
  CONFIRM_BOXES,
  CONFIRM_TEXT,
  XR_CONFIRM_POSITION,
  XR_CONFIRM_SIZE as CONFIRM_SIZE,
  xrPanelViews,
} from '../../lib/xrLayout'
import { recordingCanvas, legibilityProblems, type DrawnText } from './legibility'
import {
  MIN_READING_DEGREES,
  sizesOffList,
  textsOnButtons,
  unreadableTexts,
  worstReadingDistance,
} from '../../lib/panelReading'
import { translator } from '../../lib/textos'

/**
 * The notice to leave the run, measured instead of looked at.
 *
 * It is one of the two panels that `legibility.ts` itself names as places where the
 * problem already happened —«the text overlaps», «nothing can be understood»— and nobody measured it in
 * this game. It is measured in the two languages: Spanish is longer than English almost
 * always, and is where the text runs off.
 *
 * And from where it is played: in front of the eyes, where the menu is, at three eye heights.
 */

const LANGUAGES = ['en', 'es'] as const
const VIEWS = xrPanelViews(XR_CONFIRM_POSITION)

function measure(lang: (typeof LANGUAGES)[number]): DrawnText[] {
  const { ctx, drawnTexts } = recordingCanvas()
  drawNotice(ctx, translator(lang))
  return drawnTexts
}

describe('the notice to leave the run', () => {
  it('reads in the two languages', () => {
    for (const lang of LANGUAGES) {
      const drawnTexts = measure(lang)

      expect(drawnTexts.length, 'nothing was measured').toBeGreaterThan(0)
      const panel = { width: CONFIRM_SIZE[0], height: CONFIRM_SIZE[1] }
      const distance = Math.max(...VIEWS.map(({ pose, eyes }) => worstReadingDistance(drawnTexts, pose, eyes, LINE_HEIGHT)))
      expect(legibilityProblems(drawnTexts, { panel, distance }), lang).toEqual([])
    }
  })
})

describe('every letter of the notice reads at a glance', () => {
  it(`none drops below ${MIN_READING_DEGREES}°, in the two languages and at any eye height`, () => {
    for (const lang of LANGUAGES) {
      for (const view of VIEWS) {
        expect(unreadableTexts(measure(lang), view.pose, view.eyes, LINE_HEIGHT), `${lang}, ${view.where}`).toEqual([])
      }
    }
  })

  it('and all of them are written with a size from the list, without shrinking', () => {
    // «Seguir jugando» did not fit in its button and shrank to 33 mm.
    for (const lang of LANGUAGES) {
      expect(sizesOffList(measure(lang), LINE_HEIGHT, Object.values(CONFIRM_TEXT)), lang).toEqual([])
    }
  })

  it('and the question does not get into the buttons, nor the label of one into the other', () => {
    const buttons = Object.values(CONFIRM_BOXES).map(({ position, size }) => ({
      x: position[0],
      y: position[1],
      width: size[0],
      height: size[1],
    }))
    for (const lang of LANGUAGES) {
      expect(textsOnButtons(measure(lang), buttons), lang).toEqual([])
    }
  })

  it('the control: a label shrunk to 24 mm would not make it', () => {
    const leave = measure('es').find((e) => e.text === 'Salir')!
    const view = VIEWS[0]
    expect(unreadableTexts([{ ...leave, height: 0.024 * LINE_HEIGHT }], view.pose, view.eyes, LINE_HEIGHT)).toHaveLength(1)
  })
})
