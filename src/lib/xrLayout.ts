import { DIFFICULTY_ORDER, MAX_STICKS, type Difficulty } from './gameConfig'
import { REFERENCE_EYE_HEIGHT, isPlausibleEyeHeight } from './hoopHeight'

/**
 * Dónde se coloca cada cosa de la interfaz inmersiva, en metros. Las alturas se
 * miden desde el suelo y son las de la persona de referencia
 * (`REFERENCE_EYE_HEIGHT`); lo que se conserva de ellas al cambiar de jugador
 * es su distancia a los ojos, porque el conjunto entero sube o baja con él (ver
 * `xrUiRise`).
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

/**
 * Cuánto sube o baja toda la interfaz inmersiva para acomodarse a quien juega,
 * en metros.
 *
 * **El problema que resuelve.** El aro ya se planta sobre los ojos del jugador
 * (ver `hoopHeight.ts`), pero el panel seguía clavado a 1,40 m: quien juega
 * sentado se lo encontraba a la altura de la frente, con la fila de arriba
 * —justo la del ajuste del aro— por encima de la línea de visión cómoda.
 *
 * **Se sigue la altura de ojos entera, no una fracción.** El panel no toca el
 * suelo ni tiene nada que ver con él: es una hoja flotante que se mira, así que
 * lo único que importa es a qué altura quedan sus botones respecto a los ojos.
 * Seguir a medias dejaría la fila de arriba por encima de la cabeza de quien
 * juega sentado, que es exactamente el problema. Y no hacen falta los topes
 * absolutos que sí lleva el aro: dentro del margen de estaturas que se acepta
 * como persona, nada de la interfaz llega al suelo.
 *
 * Eso sí, no sobra: el panel del marcador se dibuja centrado en su cota y al
 * acabar una partida de desafío baja 24 cm, así que con el jugador más bajo su
 * borde se queda a un centímetro del suelo. Bajar una cota de aquí o hacer más
 * alto un panel obliga a volver sobre ese número, y `xrInteraction.test.ts` lo
 * vigila.
 *
 * Cuando el visor no dice a qué altura está la cabeza no se inventa nada: la
 * interfaz se queda donde ha estado siempre.
 */
export function xrUiRise(eyeHeight: number | null | undefined): number {
  if (!isPlausibleEyeHeight(eyeHeight)) return 0
  return eyeHeight - REFERENCE_EYE_HEIGHT
}

/** Panel del menú, delante del jugador y a la altura de los ojos. */
export const XR_MENU_POSITION: Vec3 = [0, 1.4, -0.95]
/** Marcador, por debajo del menú para no cruzarse con los palos. */
export const XR_HUD_POSITION: Vec3 = [0, 0.95, -0.85]
/**
 * Botón de volver al menú durante la partida —deja la partida, no la sesión:
 * el de salir del visor es `XR_MENU_EXIT_OFFSET`, y por eso llevan iconos
 * distintos—. Apartado a un lado para no cruzarse con los palos, pero dentro
 * del campo de visión: a 51° quedaba fuera de vista y no se encontraba.
 *
 * **Arriba y a la izquierda**, por encima de la línea de los ojos: a la altura del pecho
 * caía justo por donde va la mano a coger un palo, y ahí se pulsa sin querer. Lo que se
 * juega pasa por delante y por abajo, así que arriba no estorba a nada. El apartado a un
 * lado se queda como estaba: más allá, mirarlo hace que la interfaz entera se recoloque
 * (`XR_ANCHOR_DEADZONE`) y el botón se escapa justo al ir a apuntarlo.
 */
export const XR_QUIT_POSITION: Vec3 = [-0.42, 1.62, -0.75]

/**
 * El aviso de dejar la partida: **donde el menú, a la altura de la vista**.
 *
 * Se pregunta con la partida parada, así que ocupa el sitio donde ya se está mirando y no
 * un rincón: lo que se decide aquí es perder lo que se lleve hecho.
 */
export const XR_CONFIRM_POSITION: Vec3 = [
  XR_MENU_POSITION[0],
  XR_MENU_POSITION[1],
  XR_MENU_POSITION[2] + 0.06,
]
export const XR_CONFIRM_SIZE: [number, number] = [0.78, 0.38]

/** Sus dos botones, en coordenadas del propio aviso. */
export const CONFIRM_BOXES = {
  /** Seguir jugando va a la derecha y más grande: es la respuesta que no pierde nada. */
  stay: { position: [0.17, -0.1, 0.02] as Vec3, size: [0.32, 0.11, 0.04] as Vec3 },
  leave: { position: [-0.19, -0.1, 0.02] as Vec3, size: [0.28, 0.11, 0.04] as Vec3 },
}
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
export const XR_MENU_EXIT_OFFSET: Vec3 = [-0.42, -0.37, 0]
/**
 * Botón de silenciar, en la esquina opuesta a la de salir del visor. Los dos
 * ajustes de la fila de abajo quedan así uno en cada punta, con el de empezar
 * en medio: en el visor se apunta a pulso y un vecino a pocos centímetros se
 * pulsa por error.
 */
export const XR_MENU_SOUND_OFFSET: Vec3 = [0.42, -0.37, 0]
/**
 * Fila de ajustes bajo las dificultades: a la izquierda con qué se juega
 * (práctica o desafío) y a la derecha qué se ve alrededor. Van a las dos puntas
 * y no juntos en el centro por lo mismo que los botones de la fila de abajo: en
 * el visor se apunta a pulso y un vecino a pocos centímetros se pulsa por error.
 */
const SETTINGS_ROW_Y = -0.19
/**
 * Interruptor de modo: recorre práctica, niveles y desafío, y enseña lo que
 * cada uno pone en juego (nada, estrellas, corazones).
 */
export const XR_MODE_TOGGLE_OFFSET: Vec3 = [-0.26, SETTINGS_ROW_Y, 0]
/**
 * Tanda o sin fin, en medio de la fila de ajustes y solo en práctica. Cabe
 * entre los otros dos porque sus cajas de pulsación no llegan a tocarse.
 */
export const XR_ENDLESS_TOGGLE_OFFSET: Vec3 = [0, SETTINGS_ROW_Y, 0]
/** Selector de escenario o passthrough. */
export const XR_SCENERY_PICKER_OFFSET: Vec3 = [0.245, SETTINGS_ROW_Y, 0]
/**
 * Botón de terminar la partida sin fin, a un lado como el de volver al menú
 * pero en la punta contraria: son las dos salidas de la partida y una a cada
 * lado no se confunden. Girado hacia el jugador por lo mismo que aquel.
 */
export const XR_END_RUN_POSITION: Vec3 = [0.42, 1.15, -0.75]
export const XR_END_RUN_YAW = Math.atan2(
  -XR_END_RUN_POSITION[0],
  -XR_END_RUN_POSITION[2],
)
/**
 * Fila del ajuste de altura del aro, arriba del todo del panel. Va sola y por
 * encima del resto porque es lo único que se toca **mirando la máquina**: el
 * aro queda justo encima del panel, así que al pulsar se ve subir o bajar.
 */
const HOOP_ROW_Y = 0.34
/** Botón de bajar el aro, a la izquierda de su indicador. */
export const XR_HOOP_DOWN_OFFSET: Vec3 = [-0.13, HOOP_ROW_Y, 0]
/** Botón de subir el aro, a la derecha de su indicador. */
export const XR_HOOP_UP_OFFSET: Vec3 = [0.13, HOOP_ROW_Y, 0]
/** Regla entre los dos botones: dónde está el aro dentro de su recorrido. */
export const XR_HOOP_GAUGE_OFFSET: Vec3 = [0, HOOP_ROW_Y, 0]
/**
 * Botón de volver a ver el tutorial, en la esquina de arriba del panel. Va
 * lejos del de empezar a propósito: es una salida de emergencia para quien no
 * se acuerda de cómo se cogen los palos, no un paso del camino normal.
 */
export const XR_MENU_TUTORIAL_OFFSET: Vec3 = [-0.4, HOOP_ROW_Y, 0]
/**
 * Interruptor de la música de fondo, en la esquina de enfrente del tutorial.
 *
 * Arriba y no al lado del de silenciar, que es donde lo pediría el parecido
 * entre los dos: la fila de abajo la ocupan salir, empezar y silenciar, y lo
 * que quedaba libre entre ellos son quince centímetros —en el visor se apunta a
 * pulso y ahí se pulsa el vecino—. Aquí arriba las dos esquinas son las dos
 * cosas que se tocan una vez y se olvidan.
 */
export const XR_MENU_MUSIC_OFFSET: Vec3 = [0.4, HOOP_ROW_Y, 0]

/**
 * Cuenta atrás: al frente y a la altura de los ojos, que es donde el jugador
 * está mirando justo después de pulsar «empezar».
 */
export const XR_COUNTDOWN_POSITION: Vec3 = [0, 1.5, -0.9]

/**
 * Tutorial: exactamente donde estaba el menú del que viene. Toma su relevo
 * durante unos segundos, así que aparecer en otro sitio obligaría a buscarlo.
 */
export const XR_TUTORIAL_POSITION: Vec3 = XR_MENU_POSITION
/**
 * Botón de saltar el tutorial, en la esquina de abajo de su panel. Apartado de
 * lo que se está demostrando, pero dentro del mismo panel: tiene que verse
 * desde el primer segundo sin competir con la demostración.
 */
export const XR_TUTORIAL_SKIP_OFFSET: Vec3 = [0.4, -0.24, 0]
/** Barra de cuánto queda de tutorial, bajo la demostración. */
export const XR_TUTORIAL_PROGRESS_OFFSET: Vec3 = [0, -0.26, 0]

/** Separación entre los palos del selector de cantidad. */
export const XR_STICK_PICKER_SPACING = 0.055
/**
 * Separación entre las casillas del selector de nivel, que ocupa la fila de
 * los palos en el modo Niveles: quince casillas en el ancho de trece palos.
 */
export const XR_LEVEL_PICKER_SPACING = 0.047
/** Separación entre las fichas de dificultad. */
export const XR_DIFFICULTY_SPACING = 0.17

/** Altura del selector de palos dentro del panel. */
const STICK_PICKER_Y = 0.19
/** Altura del selector de dificultad dentro del panel. */
const DIFFICULTY_Y = -0.02
/** Altura del botón de empezar dentro del panel. */
const PLAY_Y = -0.26

/**
 * Cuánto sube el nombre de una fila por encima de sus botones, en metros.
 *
 * Las filas son palos, fichas de color e iconos, y un icono dice **qué pasa** pero no **de
 * qué es la fila**: cinco fichas en línea no se leen como «velocidad» hasta que alguien lo
 * dice. El panel creció para hacerles sitio, que quitárselo a los botones es quitárselo a
 * lo que cuesta apuntar.
 */
export const ROW_LABEL_RISE = 0.095

/**
 * Cómo se llama cada fila y sobre qué se centra, en coordenadas del panel.
 *
 * La de ajustes lleva tres cosas distintas, así que lleva tres nombres, cada uno sobre lo
 * suyo. En inglés, que es la clave con la que se traducen.
 */
export const MENU_LABELS = [
  { text: 'Hoop', x: 0, y: HOOP_ROW_Y },
  { text: 'Sticks', x: 0, y: STICK_PICKER_Y },
  { text: 'Speed', x: 0, y: DIFFICULTY_Y },
  { text: 'Mode', x: -0.26, y: SETTINGS_ROW_Y },
  { text: 'Around', x: 0.245, y: SETTINGS_ROW_Y },
] as const

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

/** Interruptor de modo (práctica, niveles o desafío), dentro del panel del menú. */
export function xrModeTogglePosition(): Vec3 {
  const [dx, dy] = XR_MODE_TOGGLE_OFFSET
  return offset(XR_MENU_POSITION, dx, dy)
}

/** Interruptor de tanda o sin fin, dentro del panel del menú. */
export function xrEndlessTogglePosition(): Vec3 {
  const [dx, dy] = XR_ENDLESS_TOGGLE_OFFSET
  return offset(XR_MENU_POSITION, dx, dy)
}

/** Casilla del nivel `level` (1-based) del selector de nivel. */
export function xrLevelOptionPosition(level: number, levelCount: number): Vec3 {
  const width = (levelCount - 1) * XR_LEVEL_PICKER_SPACING
  return offset(
    XR_MENU_POSITION,
    (level - 1) * XR_LEVEL_PICKER_SPACING - width / 2,
    STICK_PICKER_Y,
  )
}
/** Selector de escenario o passthrough, dentro del panel del menú. */
export function xrSceneryPickerPosition(): Vec3 {
  const [dx, dy] = XR_SCENERY_PICKER_OFFSET
  return offset(XR_MENU_POSITION, dx, dy)
}

/** Botón de bajar el aro, dentro del panel del menú. */
export function xrHoopDownPosition(): Vec3 {
  const [dx, dy] = XR_HOOP_DOWN_OFFSET
  return offset(XR_MENU_POSITION, dx, dy)
}

/** Botón de subir el aro, dentro del panel del menú. */
export function xrHoopUpPosition(): Vec3 {
  const [dx, dy] = XR_HOOP_UP_OFFSET
  return offset(XR_MENU_POSITION, dx, dy)
}

/** Botón de volver a ver el tutorial, dentro del panel del menú. */
export function xrMenuTutorialPosition(): Vec3 {
  const [dx, dy] = XR_MENU_TUTORIAL_OFFSET
  return offset(XR_MENU_POSITION, dx, dy)
}

/** Botón de saltar el tutorial, dentro de su panel. */
export function xrTutorialSkipPosition(): Vec3 {
  const [dx, dy] = XR_TUTORIAL_SKIP_OFFSET
  return offset(XR_TUTORIAL_POSITION, dx, dy)
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
