/**
 * Quién se queda el rayo del mando cuando apunta a varias cosas a la vez.
 *
 * El sistema de punteros del visor (`@pmndrs/pointer-events`) da cada rayo **al impacto más
 * cercano** y ahí se para: lo que queda detrás no se entera. Y **no mira si algo se ve**: en
 * toda la librería no aparece la palabra `visible`, porque el rayo lo resuelve el raycaster de
 * three, al que la visibilidad tampoco le dice nada.
 *
 * Aquí eso importa más que en ningún otro juego, porque **quien juega está dentro de la
 * máquina**: los palos cuelgan en arco a 57 cm alrededor, y el menú se planta a 95 cm delante
 * de la cara. Es decir, entre la mano y cualquier botón hay siempre palos. Reportado con el
 * visor puesto: «a veces seleccionando el menú de config es como que hay un objeto delante mía
 * y el cursor se corta. Es un objeto invisible que no veo y no me permite seleccionar la opción
 * que quiero». El objeto invisible es un palo ya atrapado: al cogerlo se apaga con `visible`
 * —no se desmonta, para no tirar su material y recompilarlo— y sigue escuchando punteros tan
 * campante.
 *
 * Tres reglas, y las tres se leen en su sitio:
 *
 * - **El decorado no está para el rayo.** La máquina, el suelo, la plaza y la cortina del
 *   cambio de escenario no escuchan nada, y con la librería tal cual no se cruzan en el camino;
 *   pero basta con que un anfitrión ponga un oyente por encima —el salón, un grupo que recoge
 *   clics— para que todo lo que cuelga de él cuente como tocado. Declarado en el mundo, no
 *   depende de quién monte el juego.
 * - **Un palo que ahora no se puede coger tampoco.** Los palos escuchan siempre, porque son los
 *   mismos durante la partida y fuera de ella; fuera solo tapan botones. Y el que ya se atrapó
 *   ni siquiera se ve. Se dice `auto` y no se calla, porque el mundo del que cuelgan ya está
 *   negado: lo que hace falta es **volver a encenderlo** para el palo que sí se puede coger.
 * - **Con la interfaz delante, la interfaz gana.** Aunque haya un palo en el camino que sí se
 *   pueda coger —la pregunta de salir sale en plena partida—, el botón se lleva el rayo. Es un
 *   orden y no una distancia: la librería mira primero `pointerEventsOrder` y solo con empate
 *   la distancia.
 */

/** El orden de la interfaz inmersiva frente al resto de la escena, que va en 0. */
export const MENU_POINTER_ORDER = 1

/** Lo que declara el mundo —máquina, suelo, decorado y cortina— ante los punteros: que no está. */
export const DECOR_POINTER_EVENTS = 'none' as const

/**
 * Si un palo está para el rayo: solo cuando se puede coger.
 *
 * `auto` y no `undefined` porque hereda el `none` del mundo: sin volver a encenderlo
 * explícitamente, no se podría atrapar ni uno.
 */
export function stickPointerEvents(catchable: boolean): 'auto' | 'none' {
  return catchable ? 'auto' : 'none'
}
