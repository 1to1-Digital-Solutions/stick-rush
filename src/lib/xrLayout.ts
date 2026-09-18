import { DIFFICULTY_ORDER, MAX_STICKS, type Difficulty } from './gameConfig'
import { REFERENCE_EYE_HEIGHT, isPlausibleEyeHeight } from './hoopHeight'
import { EYE_HEIGHTS, eyesAt, type PanelPose, type Point } from './panelReading'

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
/**
 * Lo que ocupa la línea que explica el modo elegido.
 *
 * El panel crece **solo hacia abajo** y no se mueve nada de lo que ya había. Subir las
 * filas para repartir el crecimiento no cabe aquí: la de arriba —el aro— ya está a 14 cm
 * de los ojos y el techo cómodo son 15 (`xrInteraction.test.ts`), así que nueve
 * centímetros más la dejarían donde hay que estirar el cuello para verla.
 */
export const BANDA_DE_LA_PISTA = 0.1

/** Nada sube: la banda entera se saca por abajo. */
export const SUBIDA_DE_LA_PISTA = 0

/** Dónde empieza la línea del modo, por su borde de arriba. */
export const PISTA_Y = -0.395

/**
 * Lo ancho que se le deja.
 *
 * Menos que el panel: en las dos puntas de esa fila están salir y silenciar, y la frase
 * pasaría por encima de los dos.
 */
export const PISTA_ANCHO = 0.62

/**
 * A qué tamaño se escribe cada cosa del panel del menú, en metros de alto de letra.
 *
 * **Una sola lista para quien pinta y para quien mide.** `dibujarLosNombres` escribe con estos
 * tamaños y `menu.legible.test.ts` comprueba que todo lo que el lienzo apunta está en ella: una
 * letra escrita a mano, o encogida para caber, no pasa sin verse.
 *
 * La explicación del modo iba a 22 mm: abajo del todo, medio metro por debajo de los ojos y
 * medida en su fila con el escorzo, se quedaba en 0,92°. A 35 mm cabe en dos renglones; a 36, la
 * de los niveles pide tres y se sale del panel.
 */
export const MENU_TEXT = { label: 0.032, hint: 0.035 } as const

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

/**
 * A qué tamaño se escribe el aviso, en metros de alto de letra (`salida.legible.test.ts`).
 */
export const CONFIRM_TEXT = { title: 0.05, body: 0.034, button: 0.034 } as const

/**
 * Sus dos botones, en coordenadas del propio aviso.
 *
 * «Seguir jugando» no cabía en 32 cm con la letra de `CONFIRM_TEXT` y se encogía: el botón mide lo
 * que pide su etiqueta en español.
 */
export const CONFIRM_BOXES = {
  /** Seguir jugando va a la derecha y más grande: es la respuesta que no pierde nada. */
  stay: { position: [0.17, -0.1, 0.02] as Vec3, size: [0.34, 0.11, 0.04] as Vec3 },
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
export const XR_MENU_EXIT_OFFSET: Vec3 = [-0.42, -0.37 + SUBIDA_DE_LA_PISTA, 0]
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
const SETTINGS_ROW_Y = -0.19 + SUBIDA_DE_LA_PISTA
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
const HOOP_ROW_Y = 0.34 + SUBIDA_DE_LA_PISTA
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
const STICK_PICKER_Y = 0.19 + SUBIDA_DE_LA_PISTA
/** Altura del selector de dificultad dentro del panel. */
const DIFFICULTY_Y = -0.02 + SUBIDA_DE_LA_PISTA
/**
 * Dónde va el botón de empezar dentro del panel.
 *
 * Lo dice esta declaración y **no el componente**: lo tenía escrito a mano en los dos
 * sitios con tres centímetros de diferencia, y solo no se notaba porque su caja de
 * pulsación es más grande que él.
 *
 * Y **baja seis centímetros**. Su caja es 6 cm más alta que el botón que se ve, y por
 * arriba se metía en la fila de ajustes: los dos últimos centímetros del interruptor de
 * modo y el borde de «Sin fin» quedaban dentro de la caja de empezar, así que apuntarlos
 * no hacía nada. Es lo que se reportó del visor como «objetos invisibles que bloquean
 * opciones del menú», y ahora entre las dos filas hay justo lo que suman sus medias cajas.
 */
export const XR_MENU_PLAY_OFFSET: Vec3 = [0, -0.32, 0]

/** Lo que mide su caja de pulsación. */
export const XR_MENU_PLAY_HIT: Vec3 = [0.36, 0.13, 0.06]

/**
 * Lo que ocupa la caja de pulsación de cada botón fijo del menú, en metros.
 *
 * Estaba escrito dentro del componente, botón por botón, y una caja es **invisible**:
 * más grande que su botón se come al vecino y quien juega ve una opción que no responde
 * —lo que se reportó del visor como «hay algo que tapa el menú»—. Declaradas aquí se
 * pueden comparar entre sí, que es lo que hace `xrLayout.test.ts`.
 */
export const XR_MENU_HIT: Record<string, Vec3> = {
  exit: [0.16, 0.13, 0.06],
  sound: [0.16, 0.13, 0.06],
  tutorial: [0.14, 0.12, 0.06],
  music: [0.14, 0.12, 0.06],
  hoopDown: [0.13, 0.1, 0.06],
  hoopUp: [0.13, 0.1, 0.06],
  mode: [0.2, 0.13, 0.06],
  endless: [0.16, 0.13, 0.06],
  scenery: [0.14, 0.12, 0.06],
  play: [0.36, 0.13, 0.06],
}

/** Dónde va cada uno de esos botones. Mismo nombre, mismo orden. */
export const XR_MENU_SPOT: Record<keyof typeof XR_MENU_HIT, Vec3> = {
  exit: XR_MENU_EXIT_OFFSET,
  sound: XR_MENU_SOUND_OFFSET,
  tutorial: XR_MENU_TUTORIAL_OFFSET,
  music: XR_MENU_MUSIC_OFFSET,
  hoopDown: XR_HOOP_DOWN_OFFSET,
  hoopUp: XR_HOOP_UP_OFFSET,
  mode: XR_MODE_TOGGLE_OFFSET,
  endless: XR_ENDLESS_TOGGLE_OFFSET,
  scenery: XR_SCENERY_PICKER_OFFSET,
  play: XR_MENU_PLAY_OFFSET,
}

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
  const [dx, dy] = XR_MENU_PLAY_OFFSET
  return offset(XR_MENU_POSITION, dx, dy)
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

/**
 * Cuánto se corre el mundo, en metros, para dejarlo al alcance de quien juega.
 *
 * **El problema.** Las cotas de la escena se eligieron con una persona de pie
 * delante. Sentado —en una silla, en un sofá, en una silla de ruedas— el mundo
 * entero queda un palmo por encima de donde llega el brazo, y no falla nada:
 * simplemente no se puede jugar. A quien es más bajo que esa persona le pasa lo
 * mismo en pequeño, y tampoco tiene forma de nivelarlo.
 *
 * **Es la misma corrección que ya se le hace a la interfaz**, aplicada al
 * decorado: sale negativa para quien tiene los ojos por debajo de la referencia,
 * así que el mundo baja hasta él. Y se corre el decorado, no al jugador: el
 * origen es de quien monta la escena —en el salón hay un arco de cabinas
 * plantado ahí— y dos orígenes en la misma sesión se pisan.
 *
 * **No cambia ninguna puntuación.** Se corre la escena entera, con el objetivo
 * dentro, mientras la mano se queda donde está la mano: la altura del objetivo
 * respecto al brazo es la misma que tenía la persona de pie para la que se
 * dibujó. Y quien juega de pie no nota nada, porque ahí la corrección es cero.
 *
 * Lo pide quien juega desde los ajustes del arcade y no se adivina: bajar el
 * mundo sin que nadie lo haya dicho movería el suelo bajo los pies de quien
 * está de pie.
 *
 * @param eyeHeight  la cota de los ojos que haya medido el visor, o `null`
 * @param atEyeLevel si se ha pedido el mundo a la altura de los ojos
 */
export function worldRise(
  eyeHeight: number | null | undefined,
  atEyeLevel: boolean,
): number {
  if (!atEyeLevel) return 0
  return xrUiRise(eyeHeight)
}

/**
 * Cuánto tiene que cambiar la altura, y durante cuánto, para volver a medirla.
 *
 * Lo que cuelga de esta medida se coloca al entrar y **se queda quieto**. Uno
 * que persiguiera la cabeza subiría al ponerse de puntillas y bajaría al
 * agacharse, justo cuando se está apuntando. Pero sentarse a media partida sí
 * tiene que notarse, y eso es un cambio grande y sostenido, no un movimiento de
 * juego.
 */
export const RETAKE_DELTA = 0.15
export const RETAKE_SECONDS = 1

/** Lo que se recuerda de la altura entre fotogramas. */
export interface HeightTracker {
  /** La cota que se está usando ahora mismo, o `null` mientras no haya ninguna buena. */
  held: number | null
  /** La medida filtrada, que es lo que se compara con la que se usa. */
  smoothed: number | null
  /** Cuánto lleva la medida lejos de la que se usa, en segundos. */
  drift: number
}

/** Un seguimiento recién empezado: sin nada medido todavía. */
export function startTracking(): HeightTracker {
  return { held: null, smoothed: null, drift: 0 }
}

/**
 * Avanza el seguimiento con la medida de este fotograma.
 *
 * @param measured  la cota de la cabeza, o `null` si no hay dato bueno
 * @param ratio     cuánto se acerca el filtro a la medida en este fotograma, de 0 a 1
 * @param delta     segundos de este fotograma
 */
export function trackHeight(
  state: HeightTracker,
  measured: number | null,
  ratio: number,
  delta: number,
): HeightTracker {
  if (!isPlausibleEyeHeight(measured)) return state

  const smoothed =
    state.smoothed == null ? measured : state.smoothed + (measured - state.smoothed) * ratio
  // La primera medida buena se usa tal cual: entrar en la sesión y ver el mundo
  // a la altura de los ojos es lo que tiene que pasar, no una escena subiendo
  // despacio desde donde sea.
  if (state.held == null) return { held: smoothed, smoothed, drift: 0 }

  const lejos = Math.abs(smoothed - state.held) > RETAKE_DELTA
  const drift = lejos ? state.drift + Math.max(0, delta) : 0
  if (drift > RETAKE_SECONDS) return { held: smoothed, smoothed, drift: 0 }
  return { held: state.held, smoothed, drift }
}

/**
 * Cuánto sube la interfaz **por encima de lo que ya se haya movido el mundo**.
 *
 * La interfaz cuelga del mundo, y el mundo puede haber bajado ya hasta los ojos
 * de quien juega (ver `worldRise`). Sumar entonces la corrección de la interfaz
 * la bajaría dos veces: el menú acabaría a la altura de las rodillas justo para
 * quien menos puede agacharse a buscarlo.
 *
 * Dicho de otra forma: cuando el mundo entero viene a ti, la interfaz ya está
 * donde tiene que estar y no le hace falta corrección propia.
 */
export function xrUiRiseOverWorld(
  eyeHeight: number | null | undefined,
  atEyeLevel: boolean,
): number {
  return xrUiRise(eyeHeight) - worldRise(eyeHeight, atEyeLevel)
}

/**
 * Desde dónde se lee un panel de la interfaz: con los ojos a cada altura de `EYE_HEIGHTS` y con la
 * altura de juego del salón de pie o a la de los ojos.
 *
 * Todo cuelga de `XRGazeAnchor`, así que el panel queda delante de los ojos, a la altura que suben
 * el mundo (`worldRise`) y la interfaz sobre él (`xrUiRiseOverWorld`). Es lo que usan los
 * `*.legible.test.ts` para medir cada letra donde queda de verdad.
 */
export function xrPanelViews(position: Vec3): { donde: string; pose: PanelPose; ojos: Point }[] {
  return EYE_HEIGHTS.flatMap((ojos) =>
    [false, true].map((aLaAlturaDeLosOjos) => ({
      donde: `ojos a ${ojos} m${aLaAlturaDeLosOjos ? ', mundo a su altura' : ''}`,
      pose: {
        position: [
          position[0],
          position[1] + worldRise(ojos, aLaAlturaDeLosOjos) + xrUiRiseOverWorld(ojos, aLaAlturaDeLosOjos),
          position[2],
        ] as const,
      },
      ojos: eyesAt(ojos),
    })),
  )
}
