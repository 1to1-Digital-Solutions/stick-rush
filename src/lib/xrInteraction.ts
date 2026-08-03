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
