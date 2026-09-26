/**
 * Lo que el kit pide del `agarre.ts` común (mantener o un toque) para su gramática XR, en Stick Rush.
 *
 * El kit lo necesita para lo que se lleva en la mano (`XRPlayer.coger`), y Stick Rush no lleva nada:
 * **los palos se cogen al apretar** el gatillo lateral, en ese instante, como el `pointerdown` del
 * puntero de agarre de la web, sea cual sea el ajuste del salón. Y la web tampoco tiene `agarre.ts`.
 * Aquí se le pasa al kit la forma que pide con ese comportamiento: sujeta mientras se aprieta, sin
 * más (como `agarreDelBate.ts` en Batting Cage). Cuando la web adopte el `agarre.ts` común, se
 * cambia esto por él.
 */
import type { ComunAgarre, EngancheDelAgarre } from '@kit/lib/xr/comunes'

export const agarreManteniendo: ComunAgarre = {
  startGrab: (): EngancheDelAgarre => ({ holding: false, wasPressed: false }),
  stepGrab: (_estado, pressed): EngancheDelAgarre => ({ holding: pressed, wasPressed: pressed }),
}
