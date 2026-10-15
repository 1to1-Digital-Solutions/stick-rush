'use client'

import { useXR } from '@react-three/xr'
import { useCallback } from 'react'

import { useLang } from '../../lib/settingsClient'
import { useGame } from '../../lib/gameStore'
import { translator, type TextKey } from '../../lib/textos'
import {
  PHRASES,
  PHRASES_WITH_HANDS,
  TUTORIAL_BUTTONS,
  TUTORIAL_STEPS,
  type TutorialStepKey,
} from '../../lib/tutorial'
import {
  TUTORIAL_BUTTON,
  TUTORIAL_PANEL,
  TUTORIAL_TEXT,
  XR_TUTORIAL_NEXT_OFFSET,
  XR_TUTORIAL_POSITION,
  XR_TUTORIAL_SKIP_OFFSET,
} from '../../lib/xrLayout'
import { NO_RAYCAST } from '../raycast'
import { ButtonHighlight, useButtonFeedback } from './buttonHighlight'
import { CanvasPanel, paragraphHeight, drawParagraph, drawText, roundedRect } from './canvasPanel'
import { RealController } from './RealController'
import { drawController } from './drawnController'
import { drawHand } from './drawnHand'
import { PANEL_COLOR } from './XRUi'

/**
 * How a stick is caught, inside the headset and only the first time.
 *
 * **It is learnt by doing, not by watching.** Each step is passed by catching a real stick, and the
 * run **does not stop** meanwhile: the machine drops sticks and the panel waits. Before, it
 * was a demonstration on a clock with the run queued —a fake controller picking up a
 * fake stick—, and whoever watched it without doing anything came out the same as they went in.
 *
 * **And the gesture taught is the one that serves whoever plays.** With controllers, the grip button
 * highlighted on the drawing (`drawnController.ts`) **and on the controller held in the hand**
 * (`RealController.tsx`): with the headset on what there is there has five buttons and none with
 * its name written on it. Bare-handed, the pinch (`drawnHand.ts`), which is what
 * moves the grab pointer when there is no controller: the phrase changes and the drawing changes.
 *
 * **There is always a way out**: next, skip and a deadline per step. A milestone that does not arrive
 * —because the sticks get away— would leave someone locked in their step.
 *
 * The script lives in `lib/tutorial.ts`, tested without a browser; here it is only painted and listened to.
 */

/** Measurements of the panel, in metres: `TUTORIAL_PANEL` says them. */
export const PANEL_WIDTH = TUTORIAL_PANEL.width
export const PANEL_HEIGHT = TUTORIAL_PANEL.height

/** The two buttons, at the bottom of the panel. */
const BUTTONS = [
  { id: 'next' as const, offset: XR_TUTORIAL_NEXT_OFFSET, text: 'Next' as TextKey },
  { id: 'skip' as const, offset: XR_TUTORIAL_SKIP_OFFSET, text: 'Skip tutorial' as TextKey },
]

/**
 * What is dimmed on the panel and what is read on top: the same greys the headset's menu
 * writes with, so the tutorial does not look like it belongs to another game.
 */
const DIM_COLOR = '#94a3b8'
const LIGHT_COLOR = '#e2e8f0'

/** What the phrase is drawn with, to measure it the same way it is painted. */
const PHRASE = { size: TUTORIAL_TEXT.phrase, maxWidth: PANEL_WIDTH - 0.1 }

/**
 * Where each thing falls on the panel of a step.
 *
 * It is computed and not written by hand because **the phrase does not take up the same in the two
 * languages**: the same line is two lines in English and three in Spanish, and the drawing has
 * to go down with it. It comes out of here and not from inside the drawing so the test can
 * check the same numbers that are painted, and not a copy of them.
 */
export function stepLayout(
  ctx: CanvasRenderingContext2D,
  step: TutorialStepKey,
  phrases: Record<TutorialStepKey, TextKey>,
  t: (key: TextKey) => string,
): { phraseTop: number; phraseBottom: number; gesture: number } {
  const phraseTop = PANEL_HEIGHT / 2 - 0.13
  const phraseBottom = phraseTop - paragraphHeight(ctx, t(phrases[step]), PHRASE)
  const buttonsTop = XR_TUTORIAL_SKIP_OFFSET[1] + TUTORIAL_BUTTON.height / 2
  return { phraseTop, phraseBottom, gesture: (phraseBottom + buttonsTop) / 2 }
}

/**
 * The tutorial's panel: which step it is on, what it asks for, the gesture that does it and the two
 * buttons at the bottom.
 *
 * It comes out of the component so a test can measure it with a fake canvas
 * (`legibility.ts`): it is text nobody has yet seen with the headset on, and the long phrase
 * in Spanish is where it runs off.
 */
export function drawStep(
  ctx: CanvasRenderingContext2D,
  step: TutorialStepKey | null,
  phrases: Record<TutorialStepKey, TextKey>,
  t: (key: TextKey) => string,
  bareHanded: boolean,
): void {
  roundedRect(ctx, 0, 0, PANEL_WIDTH, PANEL_HEIGHT, 0.02)
  ctx.fillStyle = PANEL_COLOR
  ctx.fill()

  if (step == null) return

  // Which one it is on, which is what says how much is left.
  drawText(ctx, `${TUTORIAL_STEPS.indexOf(step) + 1}/${TUTORIAL_STEPS.length}`, 0, PANEL_HEIGHT / 2 - 0.05, {
    size: TUTORIAL_TEXT.counter,
    color: DIM_COLOR,
  })

  // In a paragraph and not on one line: shrunk until it fitted on one, the phrase ended up in
  // two-centimetre letters and with the headset on nothing could be understood.
  //
  // **Anchored at the top**, not centred: centred, the phrase that goes from two lines to three
  // grows upwards and gets under the counter. Spanish almost always has them.
  const layout = stepLayout(ctx, step, phrases, t)
  drawParagraph(ctx, t(phrases[step]), 0, layout.phraseTop, {
    ...PHRASE,
    color: LIGHT_COLOR,
    weight: '600',
    anchor: 'top',
  })

  // What whoever plays really has in their hand, and not what most people bring.
  const colors = { body: DIM_COLOR, highlighted: LIGHT_COLOR }
  if (bareHanded) {
    drawHand(ctx, 0, layout.gesture, TUTORIAL_BUTTONS[step] != null, colors)
  } else {
    drawController(ctx, 0, layout.gesture, TUTORIAL_BUTTONS[step], colors)
  }

  for (const button of BUTTONS) {
    const [bx, by] = button.offset
    roundedRect(ctx, bx, by, TUTORIAL_BUTTON.width, TUTORIAL_BUTTON.height, 0.016)
    ctx.fillStyle = DIM_COLOR
    ctx.fill()
    drawText(ctx, t(button.text), bx, by, {
      size: TUTORIAL_TEXT.button,
      color: PANEL_COLOR,
      weight: '700',
      maxWidth: TUTORIAL_BUTTON.width - 0.03,
    })
  }
}

export function XRTutorial() {
  const {
    gameState,
    bareHanded,
    tutorialStep: step,
    finishTutorial,
    nextTutorialStep,
  } = useGame()
  const t = translator(useLang())
  const phrases = bareHanded ? PHRASES_WITH_HANDS : PHRASES
  const inSession = useXR((state) => state.mode != null)
  // Pointed at and pressed, which is what the button has to answer (`buttonHighlight.tsx`).
  const { stateOf, handlersFor } = useButtonFeedback()

  // **The step is carried by the store**, which is the one that sees the sticks caught and counts the
  // deadlines: here it is only painted. And only while really playing —during the countdown
  // there is nothing to catch, and on top of the end sign the panel would cover the result—.
  const active = inSession && gameState === 'playing' && step !== null

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => drawStep(ctx, step, phrases, t, bareHanded),
    [step, phrases, t, bareHanded],
  )

  if (!active) return null

  return (
    <>
      {/* Outside the panel's group on purpose: this does not live on the panel, it lives in the hand.
          It places itself, undoing whatever its parents put on it. On both hands because
          here either of them will do: lighting only one would be saying the other is no good.
          Bare-handed there is no controller to show and nothing is mounted. */}
      <RealController hand="left" button={TUTORIAL_BUTTONS[step]} />
      <RealController hand="right" button={TUTORIAL_BUTTONS[step]} />
      <group position={XR_TUTORIAL_POSITION}>
        <CanvasPanel width={PANEL_WIDTH} height={PANEL_HEIGHT} draw={draw} fallbackColor={PANEL_COLOR} />
        {BUTTONS.map((button) => (
          <group key={button.id} position={[button.offset[0], button.offset[1], 0.002]}>
            {/* Skipping is not «going through all the steps»: it is taking the lesson as seen, which
                also removes it from the next runs. Whoever skips it has already decided. */}
            <mesh
              onClick={button.id === 'next' ? nextTutorialStep : finishTutorial}
              {...handlersFor(button.id)}
            >
              <planeGeometry args={[TUTORIAL_BUTTON.width, TUTORIAL_BUTTON.height]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {/* **Lighting up when pointed at is what says the button responds.** The rest of
                the game's panels already do it. */}
            <ButtonHighlight
              width={TUTORIAL_BUTTON.width}
              height={TUTORIAL_BUTTON.height}
              state={stateOf(button.id)}
              glow={LIGHT_COLOR}
              ink={PANEL_COLOR}
            />
          </group>
        ))}
        {/* The panel cannot be pressed as a whole: only its buttons. */}
        <mesh position={[0, 0, -0.001]} raycast={NO_RAYCAST}>
          <planeGeometry args={[PANEL_WIDTH, PANEL_HEIGHT]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </>
  )
}
