/**
 * El tutorial de Stick Rush en Godot: el guion de la web (`lib/tutorial.ts`) en el panel del kit,
 * con la letra y los botones de su `XRTutorial.tsx` (`TUTORIAL_TEXT`, `TUTORIAL_BOTON`).
 *
 * **Se aprende jugando**: coger un palo con el agarre y, luego, otro de los que caen por los lados.
 * El paso no se guarda aquí: lo lleva la partida (`tutorialStep`, que sale de los palos atrapados y
 * de lo saltado, con su plazo de seguridad), igual que en la web lo lleva el store. Aquí solo se
 * pinta, y **siguiente** y **saltar** van a la partida (`nextTutorialStep`, `finishTutorial`).
 *
 * Como en la web, sale **con el visor puesto** y **solo jugando** —en la cuenta atrás no hay nada
 * que atrapar y encima del final taparía el resultado—, y enciende el botón del paso en **el mando
 * de verdad de las dos manos**: aquí vale cualquiera de ellas. Con las manos desnudas, la frase del
 * pellizco. `-- --tutorial` lo enseña en plano.
 */
import type { Punteria } from '@kit/runtime/ui/punteria'
import { PanelDeTutorial, type MandoEnLaMano } from '@kit/runtime/ui/tutorial'

import type { Lang } from '@/lib/ajustes'
import { traductor } from '@/lib/textos'
import { FRASES, FRASES_CON_LAS_MANOS, TUTORIAL_BUTTONS, TUTORIAL_STEPS, type TutorialStepKey } from '@/lib/tutorial'
import { TUTORIAL_BOTON, TUTORIAL_TEXT, XR_TUTORIAL_NEXT_OFFSET } from '@/lib/xrLayout'

import { COLORES } from './menu'

/** La letra y los botones de la web (`TUTORIAL_TEXT` y `TUTORIAL_BOTON`, con su separación). */
export const MEDIDAS_DE_STICK_RUSH = {
  letra: TUTORIAL_TEXT,
  boton: { width: TUTORIAL_BOTON.width, height: TUTORIAL_BOTON.height, x: XR_TUTORIAL_NEXT_OFFSET[0] },
} as const

export class TutorialDelJuego {
  readonly vista: PanelDeTutorial
  private pintado: string | null = null
  private _paso: TutorialStepKey | null = null

  constructor(acciones: { siguiente(): void; saltar(): void }, punteria: Punteria, manos: readonly MandoEnLaMano[] = []) {
    this.vista = new PanelDeTutorial({
      rotulos: { next: 'Next', skip: 'Skip tutorial' },
      alSiguiente: () => acciones.siguiente(),
      alSaltar: () => acciones.saltar(),
      colores: {
        fondo: COLORES.panel,
        texto: COLORES.claro,
        suave: COLORES.suave,
        resaltado: COLORES.claro,
        boton: COLORES.suave,
        tintaDelBoton: COLORES.panel,
      },
      manos,
      medidas: MEDIDAS_DE_STICK_RUSH,
    })
    punteria.anadir(this.vista.siguiente, this.vista.saltar)
  }

  /** El paso que se enseña ahora, o `null` si no se enseña ninguno. */
  get paso(): TutorialStepKey | null {
    return this._paso
  }

  /**
   * Un fotograma: con `paso` (el de la partida, si toca enseñarlo), el panel y el mando de las
   * manos; sin él, fuera.
   */
  actualizar(paso: TutorialStepKey | null, lang: Lang, conLasManos: boolean, delta: number): void {
    if (paso == null) {
      // Ocultar el panel apaga también el mando de las manos.
      this._paso = null
      this.vista.ocultar()
      this.pintado = null
      return
    }
    this._paso = paso
    const clave = `${paso}:${lang}:${conLasManos}`
    if (clave !== this.pintado) {
      const t = traductor(lang)
      const frases = conLasManos ? FRASES_CON_LAS_MANOS : FRASES
      this.vista.rotular({ next: t('Next'), skip: t('Skip tutorial') })
      this.vista.mostrarPaso(TUTORIAL_STEPS.indexOf(paso) + 1, TUTORIAL_STEPS.length, t(frases[paso]), TUTORIAL_BUTTONS[paso])
      this.pintado = clave
    }
    this.vista.actualizar(delta)
  }
}
