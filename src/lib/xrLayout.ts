import { DIFFICULTY_ORDER, MAX_STICKS, type Difficulty } from './gameConfig'

/**
 * Dónde se coloca cada cosa de la interfaz inmersiva, en metros y relativo a
 * los pies del jugador.
 *
 * **El −Z de aquí es hacia donde mira el jugador**, no una dirección fija de la
 * sala: todo esto cuelga de `<XRGazeAnchor>`, que gira el conjunto con él (ver
 * `@/lib/xrAnchor`). Antes colgaba directamente de `<XROrigin>`, cuyo −Z lo
 * decide la calibración del espacio, y bastaba entrar mirando a otro lado para
 * que el menú apareciera a la espalda.
 *
 * Vive aquí, y no dentro de los componentes, porque los tests de sesión
 * inmersiva tienen que apuntar el mando a estos mismos puntos: si el layout se
 * mueve, los tests lo siguen sin tocarlos. Los componentes solo pintan.
 */

export type Vec3 = [number, number, number]

/** Panel del menú, delante del jugador y a la altura de los ojos. */
export const XR_MENU_POSITION: Vec3 = [0, 1.4, -0.95]
/** Marcador, por debajo del menú para no cruzarse con los palos. */
export const XR_HUD_POSITION: Vec3 = [0, 0.95, -0.85]
/**
 * Botón de volver al menú durante la partida —deja la partida, no la sesión:
 * el de salir del visor es `XR_MENU_EXIT_OFFSET`, y por eso llevan iconos
 * distintos—. Apartado a un lado para no cruzarse con los palos, pero dentro
 * del campo de visión: a 51° quedaba fuera de vista y no se encontraba.
 */
export const XR_QUIT_POSITION: Vec3 = [-0.42, 1.15, -0.75]
/**
 * Giro de ese botón para que su placa encare al jugador.
 *
 * Es el único elemento apartado a un lado, así que es el único que necesita
 * girar: de canto, un botón plano se estrecha y su icono se hunde en la propia
 * placa. Se deriva de la posición en vez de fijarlo a ojo, para que al mover el
 * botón el giro lo siga.
 */
export const XR_QUIT_YAW = Math.atan2(
  -XR_QUIT_POSITION[0],
  -XR_QUIT_POSITION[2],
)
/** Botón de salir del visor, en la esquina del panel del menú. */
export const XR_MENU_EXIT_OFFSET: Vec3 = [-0.42, -0.29, 0]
/**
 * Botón de silenciar, en la esquina opuesta a la de salir del visor. Los dos
 * ajustes de la fila de abajo quedan así uno en cada punta, con el de empezar
 * en medio: en el visor se apunta a pulso y un vecino a pocos centímetros se
 * pulsa por error.
 */
export const XR_MENU_SOUND_OFFSET: Vec3 = [0.42, -0.29, 0]
/**
 * Fila de ajustes bajo las dificultades: a la izquierda con qué se juega
 * (práctica o desafío) y a la derecha qué se ve alrededor. Van a las dos puntas
 * y no juntos en el centro por lo mismo que los botones de la fila de abajo: en
 * el visor se apunta a pulso y un vecino a pocos centímetros se pulsa por error.
 */
const SETTINGS_ROW_Y = -0.17
/** Interruptor de modo: los corazones que se ponen (o no) en juego. */
export const XR_MODE_TOGGLE_OFFSET: Vec3 = [-0.26, SETTINGS_ROW_Y, 0]
/** Selector de escenario o passthrough. */
export const XR_SCENERY_PICKER_OFFSET: Vec3 = [0.245, SETTINGS_ROW_Y, 0]
/**
 * Cuenta atrás: al frente y a la altura de los ojos, que es donde el jugador
 * está mirando justo después de pulsar «empezar».
 */
export const XR_COUNTDOWN_POSITION: Vec3 = [0, 1.5, -0.9]

/** Separación entre los palos del selector de cantidad. */
export const XR_STICK_PICKER_SPACING = 0.055
/** Separación entre las fichas de dificultad. */
export const XR_DIFFICULTY_SPACING = 0.17

/** Altura del selector de palos dentro del panel. */
const STICK_PICKER_Y = 0.16
/** Altura del selector de dificultad dentro del panel. */
const DIFFICULTY_Y = -0.04
/** Altura del botón de empezar dentro del panel. */
const PLAY_Y = -0.21

function offset([x, y, z]: Vec3, dx: number, dy: number): Vec3 {
  return [x + dx, y + dy, z]
}

/** Botón de volver al menú durante la partida. */
export function xrQuitButtonPosition(): Vec3 {
  return XR_QUIT_POSITION
}

/** Botón de salir del visor, dentro del panel del menú. */
export function xrMenuExitPosition(): Vec3 {
  const [dx, dy] = XR_MENU_EXIT_OFFSET
  return offset(XR_MENU_POSITION, dx, dy)
}

/** Botón de silenciar, dentro del panel del menú. */
export function xrMenuSoundPosition(): Vec3 {
  const [dx, dy] = XR_MENU_SOUND_OFFSET
  return offset(XR_MENU_POSITION, dx, dy)
}

/** Interruptor de modo (práctica o desafío), dentro del panel del menú. */
export function xrModeTogglePosition(): Vec3 {
  const [dx, dy] = XR_MODE_TOGGLE_OFFSET
  return offset(XR_MENU_POSITION, dx, dy)
}

/** Selector de escenario o passthrough, dentro del panel del menú. */
export function xrSceneryPickerPosition(): Vec3 {
  const [dx, dy] = XR_SCENERY_PICKER_OFFSET
  return offset(XR_MENU_POSITION, dx, dy)
}

/** Botón de empezar partida. */
export function xrPlayButtonPosition(): Vec3 {
  return offset(XR_MENU_POSITION, 0, PLAY_Y)
}

/**
 * Posición del palo `index` (0-based) del selector de cantidad. El selector
 * muestra los `MAX_STICKS` posibles y se elige tocando hasta cuál se quiere.
 */
export function xrStickOptionPosition(index: number): Vec3 {
  const width = (MAX_STICKS - 1) * XR_STICK_PICKER_SPACING
  return offset(
    XR_MENU_POSITION,
    index * XR_STICK_PICKER_SPACING - width / 2,
    STICK_PICKER_Y,
  )
}

/** Posición de la ficha de una dificultad. */
export function xrDifficultyOptionPosition(difficulty: Difficulty): Vec3 {
  const index = DIFFICULTY_ORDER.indexOf(difficulty)
  const width = (DIFFICULTY_ORDER.length - 1) * XR_DIFFICULTY_SPACING
  return offset(
    XR_MENU_POSITION,
    index * XR_DIFFICULTY_SPACING - width / 2,
    DIFFICULTY_Y,
  )
}
