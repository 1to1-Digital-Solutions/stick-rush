import { describe, expect, it } from 'vitest'

import {
  MIN_READING_DEGREES,
  sizesOffList,
  textsOnButtons,
  unreadableTexts,
  worstReadingDistance,
  type PanelButton,
} from '../../lib/panelReading'
import { translator, type TextKey } from '../../lib/textos'
import { PHRASES, PHRASES_WITH_HANDS, TUTORIAL_STEPS, type TutorialStepKey } from '../../lib/tutorial'
import {
  TUTORIAL_BUTTON,
  TUTORIAL_TEXT,
  XR_TUTORIAL_NEXT_OFFSET,
  XR_TUTORIAL_POSITION,
  XR_TUTORIAL_SKIP_OFFSET,
  xrPanelViews,
} from '../../lib/xrLayout'
import { LINE_HEIGHT } from './canvasPanel'
import { recordingCanvas, legibilityProblems, type DrawnText } from './legibility'
import { CONTROLLER_HEIGHT } from './drawnController'
import { HAND_HEIGHT } from './drawnHand'
import { drawStep, PANEL_HEIGHT, PANEL_WIDTH, stepLayout } from './XRTutorial'

/**
 * The tutorial's panel, **measured** instead of looked at.
 *
 * It is where Spanish runs off: the grab phrase takes up two lines in English and three in
 * Spanish, and the gesture that goes underneath has to go down with it or it gets inside it. And there are two
 * sets of phrases, one per way of playing —with a controller and bare-handed—, so the
 * two steps are gone through for the two variants and for the two languages.
 */

const LANGUAGES = ['en', 'es'] as const
const MEASURED_PANEL = { width: PANEL_WIDTH, height: PANEL_HEIGHT }
/** From where it is read: the panel in front of the eyes, at three heights and with the world standing or not. */
const VIEWS = xrPanelViews(XR_TUTORIAL_POSITION)

const VARIANTS = [
  { name: 'with a controller', phrases: PHRASES, bareHanded: false, gestureHeight: CONTROLLER_HEIGHT },
  { name: 'bare-handed', phrases: PHRASES_WITH_HANDS, bareHanded: true, gestureHeight: HAND_HEIGHT },
] as const

/** The two way-out buttons, just as the panel places them. */
const BUTTONS: readonly (PanelButton & { text: TextKey })[] = [
  { x: XR_TUTORIAL_NEXT_OFFSET[0], y: XR_TUTORIAL_NEXT_OFFSET[1], ...TUTORIAL_BUTTON, text: 'Next' },
  { x: XR_TUTORIAL_SKIP_OFFSET[0], y: XR_TUTORIAL_SKIP_OFFSET[1], ...TUTORIAL_BUTTON, text: 'Skip tutorial' },
]

interface Moment {
  where: string
  step: TutorialStepKey
  lang: (typeof LANGUAGES)[number]
  variant: (typeof VARIANTS)[number]
}

function allMoments(): Moment[] {
  return LANGUAGES.flatMap((lang) =>
    VARIANTS.flatMap((variant) =>
      TUTORIAL_STEPS.map((step) => ({ where: `${lang} ${variant.name} ${step}`, step, lang, variant })),
    ),
  )
}

function paint({ step, lang, variant }: Moment) {
  const { ctx, drawnTexts } = recordingCanvas()
  const t = translator(lang)
  drawStep(ctx, step, variant.phrases, t, variant.bareHanded)
  return { drawnTexts, layout: stepLayout(ctx, step, variant.phrases, t) }
}

/** At what distance the problems are measured: the reading one of the text that reads worst. */
function distance(drawnTexts: readonly DrawnText[]): number {
  return Math.max(...VIEWS.map(({ pose, eyes }) => worstReadingDistance(drawnTexts, pose, eyes, LINE_HEIGHT)))
}

describe('the tutorial panel reads', () => {
  it('nothing overlaps or runs off, in the two languages and with a controller or without one', () => {
    for (const moment of allMoments()) {
      const { drawnTexts } = paint(moment)
      expect(drawnTexts.length, `${moment.where}: nothing was measured`).toBeGreaterThan(0)
      expect(
        legibilityProblems(drawnTexts, { panel: MEASURED_PANEL, distance: distance(drawnTexts) }),
        moment.where,
      ).toEqual([])
    }
  })

  it(`and each letter, at a glance: none drops below ${MIN_READING_DEGREES}°`, () => {
    for (const moment of allMoments()) {
      const { drawnTexts } = paint(moment)
      for (const view of VIEWS) {
        expect(unreadableTexts(drawnTexts, view.pose, view.eyes, LINE_HEIGHT), `${moment.where}, ${view.where}`).toEqual([])
      }
    }
  })

  it('with a size from the list, without shrinking to fit', () => {
    const sizes = Object.values(TUTORIAL_TEXT)
    for (const moment of allMoments()) {
      expect(sizesOffList(paint(moment).drawnTexts, LINE_HEIGHT, sizes), moment.where).toEqual([])
    }
  })

  it('and the phrase does not get into the buttons at the bottom', () => {
    for (const moment of allMoments()) {
      expect(textsOnButtons(paint(moment).drawnTexts, BUTTONS), moment.where).toEqual([])
    }
  })
})

describe('the layout of the panel follows the phrase', () => {
  it('the gesture fits between the phrase and the buttons', () => {
    for (const moment of allMoments()) {
      const { gesture, phraseBottom } = paint(moment).layout
      const half = moment.variant.gestureHeight / 2
      expect(gesture + half, `${moment.where}: the gesture gets into the phrase`).toBeLessThanOrEqual(phraseBottom + 1e-9)
      expect(gesture - half, `${moment.where}: the gesture gets into the buttons`).toBeGreaterThanOrEqual(
        XR_TUTORIAL_SKIP_OFFSET[1] + TUTORIAL_BUTTON.height / 2 - 1e-9,
      )
    }
  })

  it('the phrase is anchored at the top: it always starts at the same height', () => {
    // Centred, the one that goes from two lines to three grows upwards and gets under the
    // counter. Spanish almost always has them.
    const tops = allMoments().map((moment) => paint(moment).layout.phraseTop)
    expect(new Set(tops).size).toBe(1)
  })

  it('the control: a longer phrase lowers the gesture', () => {
    // The layout has to **follow the phrase**, not be written by hand. Today the two languages
    // fit in the same lines —which is why it is not seen without measuring it—, so the
    // control is done with an invented phrase: if the gesture did not go down with it, neither would it
    // the day a translation gains a line.
    const { ctx } = recordingCanvas()
    const short = stepLayout(ctx, 'grab', PHRASES, () => 'Grab a stick')
    const long = stepLayout(
      ctx,
      'grab',
      PHRASES,
      () => 'Hold the grip button on a stick and keep your hand closed around it while the machine keeps throwing them at you',
    )
    expect(long.phraseBottom).toBeLessThan(short.phraseBottom)
    expect(long.gesture).toBeLessThan(short.gesture)
  })
})

describe('what the panel shows', () => {
  it('which step it is on, which is what says how much is left', () => {
    for (const [index, step] of TUTORIAL_STEPS.entries()) {
      const { drawnTexts } = paint({ where: step, step, lang: 'en', variant: VARIANTS[0] })
      expect(
        drawnTexts.some((drawn) => drawn.text === `${index + 1}/${TUTORIAL_STEPS.length}`),
        step,
      ).toBe(true)
    }
  })

  it('and the two way-out buttons are always there', () => {
    // A step that is not achieved would leave someone locked in it.
    for (const moment of allMoments()) {
      const { drawnTexts } = paint(moment)
      const t = translator(moment.lang)
      for (const button of BUTTONS) {
        expect(drawnTexts.some((drawn) => drawn.text === t(button.text)), `${moment.where}: ${button.text}`).toBe(true)
      }
    }
  })

  it('with no step to show it writes nothing', () => {
    const { ctx, drawnTexts } = recordingCanvas()
    drawStep(ctx, null, PHRASES, translator('es'), false)
    expect(drawnTexts).toEqual([])
  })
})
