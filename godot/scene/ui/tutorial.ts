/**
 * Stick Rush's tutorial in Godot: the web's script (`lib/tutorial.ts`) on the kit's panel,
 * with the type and the buttons of its `XRTutorial.tsx` (`TUTORIAL_TEXT`, `TUTORIAL_BUTTON`).
 *
 * **You learn by playing**: grab a stick with the grip and, then, another of those that fall at the sides.
 * The step is not kept here: the run carries it (`tutorialStep`, which comes from the sticks caught and
 * from what was skipped, with its safety deadline), just as on the web the store carries it. Here it is
 * only painted, and **next** and **skip** go to the run (`nextTutorialStep`, `finishTutorial`).
 *
 * As on the web, it comes up **with the headset on** and **only while playing** —in the countdown there is
 * nothing to catch and over the end it would cover the result—, and it lights the step's button on **the
 * real controller of both hands**: here either of them will do. With bare hands, the sentence of the
 * pinch. `-- --tutorial` shows it flat.
 */
import type { PointerAim } from '@kit/runtime/ui/pointerAim'
import { PanelDeTutorial, type MandoEnLaMano } from '@kit/runtime/ui/tutorial'

import type { Lang } from '@/lib/settings'
import { translator } from '@/lib/textos'
import { PHRASES, PHRASES_WITH_HANDS, TUTORIAL_BUTTONS, TUTORIAL_STEPS, type TutorialStepKey } from '@/lib/tutorial'
import { TUTORIAL_BUTTON, TUTORIAL_TEXT, XR_TUTORIAL_NEXT_OFFSET } from '@/lib/xrLayout'

import { COLORS } from './menu'

/** The web's type and buttons (`TUTORIAL_TEXT` and `TUTORIAL_BUTTON`, with their spacing). */
export const STICK_RUSH_MEASUREMENTS = {
  letra: TUTORIAL_TEXT,
  boton: { width: TUTORIAL_BUTTON.width, height: TUTORIAL_BUTTON.height, x: XR_TUTORIAL_NEXT_OFFSET[0] },
} as const

export class GameTutorial {
  readonly view: PanelDeTutorial
  private painted: string | null = null
  private _step: TutorialStepKey | null = null

  constructor(actions: { next(): void; skip(): void }, aim: PointerAim, hands: readonly MandoEnLaMano[] = []) {
    this.view = new PanelDeTutorial({
      rotulos: { next: 'Next', skip: 'Skip tutorial' },
      alSiguiente: () => actions.next(),
      alSaltar: () => actions.skip(),
      colores: {
        fondo: COLORS.panel,
        texto: COLORS.light,
        suave: COLORS.dim,
        resaltado: COLORS.light,
        boton: COLORS.dim,
        tintaDelBoton: COLORS.panel,
      },
      manos: hands,
      medidas: STICK_RUSH_MEASUREMENTS,
    })
    aim.anadir(this.view.siguiente, this.view.saltar)
  }

  /** The step being shown now, or `null` if none is shown. */
  get step(): TutorialStepKey | null {
    return this._step
  }

  /**
   * One frame: with `step` (the run's, if it is time to show it), the panel and the controller of the
   * hands; without it, out.
   */
  update(step: TutorialStepKey | null, lang: Lang, withHands: boolean, delta: number): void {
    if (step == null) {
      // Hiding the panel also turns off the controller of the hands.
      this._step = null
      this.view.ocultar()
      this.painted = null
      return
    }
    this._step = step
    const key = `${step}:${lang}:${withHands}`
    if (key !== this.painted) {
      const t = translator(lang)
      const phrases = withHands ? PHRASES_WITH_HANDS : PHRASES
      this.view.rotular({ next: t('Next'), skip: t('Skip tutorial') })
      this.view.mostrarPaso(TUTORIAL_STEPS.indexOf(step) + 1, TUTORIAL_STEPS.length, t(phrases[step]), TUTORIAL_BUTTONS[step])
      this.painted = key
    }
    this.view.actualizar(delta)
  }
}
