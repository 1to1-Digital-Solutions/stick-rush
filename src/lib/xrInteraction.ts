/**
 * Reglas de interacción con los palos.
 *
 * Un palo se coge **con la mano**, no apuntando. En sesión inmersiva
 * @react-three/xr registra varios punteros por mando y cada uno se identifica
 * por su `pointerType`:
 *
 * - `grab`  — esfera pegada al puño, se activa con el gatillo lateral (squeeze).
 * - `touch` — contacto directo de la mano, sin mando.
 * - `ray`   — el rayo que sale del mando y llega a cualquier distancia.
 * - `mouse` — el ratón, en escritorio.
 *
 * El rayo se queda solo para manejar el menú: si valiera para los palos, el
 * juego se reduciría a apuntar desde lejos y perdería la gracia de atraparlos.
 */
export type PointerKind = 'grab' | 'touch' | 'ray' | 'mouse' | (string & {})

/**
 * ¿Este puntero puede atrapar un palo?
 *
 * Se acepta todo salvo el rayo, en vez de listar los válidos: los eventos de
 * ratón no siempre traen `pointerType`, y un puntero nuevo de la librería debe
 * poder coger palos por defecto antes que quedarse mudo sin que nadie se entere.
 */
export function canCatchWithPointer(pointerType: PointerKind | undefined) {
  return pointerType !== 'ray'
}

/** Vida de un palo: cuelga del aro, cae, y acaba atrapado o en el suelo. */
export type StickState = 'hanging' | 'falling' | 'caught' | 'missed'

/**
 * ¿Se puede atrapar este palo ahora mismo?
 *
 * **Un palo se coge hasta que toca el suelo, colgando incluido.** Es una
 * decisión de producto, no un descuido: la ventana empieza en cuanto arranca la
 * partida y se cierra cuando el palo se resuelve. Vaciar el aro sin esperar a
 * que caiga nada es una forma legítima de jugar, y el bonus por reflejos
 * (`reflexMultiplier`) la premia precisamente por eso — quien espera el palo
 * abajo se lleva la mitad de puntos.
 *
 * Lo que sí se cierra:
 *
 * - Un palo **ya resuelto** (atrapado o tocado el suelo) no vuelve a contar. El
 *   palo perdido se queda tirado para que el suelo cuente los fallos, pero es
 *   decorado: recogerlo del suelo borraría el fallo.
 * - Con la partida **parada** no se coge nada, y eso incluye la cuenta atrás:
 *   antes se podía vaciar el aro entero a clics antes de que empezara a caer
 *   nada.
 */
export function canCatchStick(state: StickState, paused: boolean) {
  if (paused) return false
  return state === 'hanging' || state === 'falling'
}

/**
 * ¿Se está jugando con las manos desnudas?
 *
 * Cambia lo que hay que **enseñar**, no lo que hay que hacer: los palos se
 * cogen igual —el puntero de agarre va con la mano lo mismo que con el mando—,
 * pero el tutorial dibujaba un mando con su gatillo lateral marcado, y quien
 * entra con las manos veía un objeto que no tiene y un botón que no puede
 * apretar.
 *
 * Se pide que **haya manos y no haya mandos**, y no solo que haya manos: el
 * visor puede tener las dos cosas conectadas —los mandos en la mesa siguen
 * anunciándose— y ahí lo que el jugador tiene en la mano manda. Sin nada
 * conectado todavía se dibuja el mando, que es lo que trae la mayoría.
 */
export function playingBareHanded(inputTypes: readonly string[]): boolean {
  return inputTypes.includes('hand') && !inputTypes.includes('controller')
}
