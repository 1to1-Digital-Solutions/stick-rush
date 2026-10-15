import { describe, expect, it } from 'vitest'
import { FINAL_LABELS, drawFinalLabels } from './XRHud'
import { LINE_HEIGHT } from './canvasPanel'
import { XR_HUD_POSITION, xrHudLayout, xrPanelViews } from '../../lib/xrLayout'
import { recordingCanvas, legibilityProblems, type DrawnText } from './legibility'
import { MIN_READING_DEGREES, unreadableTexts, worstReadingDistance } from '../../lib/panelReading'
import { translator } from '../../lib/textos'

/**
 * The labels of the end-of-run buttons, measured instead of looked at: «Otra partida» is the
 * longest label and it is in Spanish that it runs off. They are measured with the challenge («Otro reto») and with the
 * other modes («Otra partida»).
 */

const LANGUAGES = ['en', 'es'] as const
/** The row of buttons goes 12 cm below the tokens (`XRHud`), and the labels under it. */
const BELOW_THE_TOKENS = -0.12 + FINAL_LABELS.y
/** Where they really end up: with the sign above and without it, which moves the tokens. */
const VIEWS = [true, false].flatMap((sign) => {
  const { content } = xrHudLayout({ finished: true, row: true, sign })
  const [x, y, z] = XR_HUD_POSITION
  return xrPanelViews([x, y + content + BELOW_THE_TOKENS, z])
})

const MODES = ['challenge', 'practice'] as const

function measure(lang: (typeof LANGUAGES)[number], mode: (typeof MODES)[number] = 'challenge'): DrawnText[] {
  const { ctx, drawnTexts } = recordingCanvas()
  drawFinalLabels(ctx, translator(lang), mode)
  return drawnTexts
}

describe('the labels of the end buttons', () => {
  it('say the two buttons and do not overlap or run off, in the two languages and in each mode', () => {
    for (const lang of LANGUAGES) {
      for (const mode of MODES) {
        const drawnTexts = measure(lang, mode)
        expect(drawnTexts.map((e) => e.text), lang).toHaveLength(2)
        const panel = { width: FINAL_LABELS.width, height: FINAL_LABELS.height }
        const distance = Math.max(...VIEWS.map(({ pose, eyes }) => worstReadingDistance(drawnTexts, pose, eyes, LINE_HEIGHT)))
        expect(legibilityProblems(drawnTexts, { panel, distance }), `${lang}, ${mode}`).toEqual([])
      }
    }
    expect(measure('es').map((e) => e.text)).toEqual(['Otro reto', 'Menú'])
    expect(measure('es', 'practice').map((e) => e.text)).toEqual(['Otra partida', 'Menú'])
  })

  it(`no letter drops below ${MIN_READING_DEGREES}°, at any eye height`, () => {
    for (const lang of LANGUAGES) {
      for (const mode of MODES) {
        for (const view of VIEWS) {
          expect(unreadableTexts(measure(lang, mode), view.pose, view.eyes, LINE_HEIGHT), `${lang}, ${mode}, ${view.where}`).toEqual([])
        }
      }
    }
  })
})
