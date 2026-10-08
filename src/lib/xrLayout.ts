import { DIFFICULTY_ORDER, MAX_STICKS, PLAYER_OFFSET_Z, STICK_RADIUS, type Difficulty } from './gameConfig'
import { eligeJugadores } from './duel'
import { GAME_MODE_LABELS, picksSetup, type GameMode } from './gameMode'
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

/**
 * Cómo cuelga el panel del menú de la interfaz: dónde, de cara a quién y a qué escala.
 *
 * Los botones se declaran en coordenadas del panel (`XR_MENU_SPOT`, los `*_OFFSET`) y esta
 * pose los lleva al espacio de la interfaz (`onMenu`). Con la escala, el panel entero crece
 * con la distancia y conserva los ángulos: lo que se leía y se apuntaba a un metro se lee y
 * se apunta igual a metro y medio.
 */
export interface MenuPose {
  readonly position: Vec3
  /** Giro alrededor de la vertical, como el `rotation.y` de three. */
  readonly yaw: number
  readonly scale: number
}

/**
 * Dónde va la columna de ajustes en el visor: la regla común de los juegos del salón
 * (`.claude/rules/xr.md`, «La columna va lejos y a la izquierda, fuera de donde se juega»).
 *
 * **Estaba de frente, a 95 cm**: en medio del aro, justo donde caen los palos. Con las gafas
 * todas las columnas estorbaban jugando, y esta la que más. Ahora va a metro y medio
 * de los ojos y 55° a la izquierda: **fuera del aro** —que tiene 57 cm de radio— y fuera de
 * donde se mira jugando. El botón que la abre durante la partida (`XR_QUIT_POSITION`) ya
 * estaba a la izquierda, que es lo que pide la regla.
 *
 * A CALIBRAR CON EL VISOR (distancia entre 1,4 y 1,6; ángulo entre 50° y 65°).
 */
export const XR_COLUMN = { distance: 1.5, azimuth: (55 * Math.PI) / 180 } as const

/**
 * Cuánto crece el panel en la columna.
 *
 * El panel se diseñó a 97 cm de los ojos (95 delante y 20 por debajo), pero no crece todo lo
 * que se aleja (1,5 / 0,97 = 1,55): a ese tamaño pasaba de metro y medio de alto. Crece lo que pide la letra más pequeña para seguir leyéndose de un vistazo
 * en los dos idiomas y a las tres alturas de ojos (`menu.legible.test.ts`): la que manda es
 * «Aro», arriba del todo y vista en escorzo, que con 1,31 ya se queda en 1,39°. A CALIBRAR
 * CON EL VISOR.
 */
export const XR_MENU_SCALE = 1.35

/** Lo que ocupa la placa del menú, en metros, antes de crecer con la pose. */
export const MENU_PANEL: [number, number] = [1.06, 0.92 + BANDA_DE_LA_PISTA]

/** La columna del menú en el visor: a la izquierda, a la altura de los ojos, de cara. */
export const XR_MENU_POSE: MenuPose = {
  position: [
    -Math.sin(XR_COLUMN.azimuth) * XR_COLUMN.distance,
    REFERENCE_EYE_HEIGHT,
    -Math.cos(XR_COLUMN.azimuth) * XR_COLUMN.distance,
  ],
  yaw: XR_COLUMN.azimuth,
  scale: XR_MENU_SCALE,
}

/**
 * El menú sin visor: el salón de xrcade en escritorio, donde la interfaz de la escena es la
 * única que hay y no se puede girar la cabeza para buscarla. Ahí se queda delante, donde
 * estuvo siempre.
 */
export const XR_MENU_DESK_POSE: MenuPose = {
  position: [0, 1.4, -0.95],
  yaw: 0,
  scale: 1,
}

/** La pose del menú según haya sesión inmersiva o no. */
export function menuPoseFor(immersive: boolean): MenuPose {
  return immersive ? XR_MENU_POSE : XR_MENU_DESK_POSE
}

/**
 * **Los palos que tapan el menú se atenúan mientras se elige.** Quien juega está dentro del aro,
 * y el aro rodea todo lo que tiene delante: a la distancia y altura que sea, entre los ojos y la
 * columna siempre cuelgan palos (el emulador lo enseñó: el menú se leía entre barrotes
 * amarillos). Apartar la columna más de 90° la dejaría a la espalda, y la regla pide el menú
 * cerca del frente. Así que en el menú del visor esos palos se quedan casi transparentes, y
 * vuelven enteros en cuanto se pulsa Jugar: el resto de la máquina se sigue viendo colgar.
 */
export const PALO_TRAS_EL_MENU = 0.15

/** Lo que tarda en atenuarse o volver un palo, a este ritmo por segundo: un cuarto de segundo. */
export const ATENUAR_POR_SEGUNDO = 4

/**
 * El margen, en grados, a cada lado de la placa: el vaivén del palo colgado y su grosor, y algo
 * por si la cabeza no está justo donde se nace.
 */
export const MARGEN_DEL_MENU_GRADOS = 6

/** Hacia dónde queda un punto del espacio de quien juega, en grados: positivo a la izquierda. */
function rumbo(x: number, z: number): number {
  return (Math.atan2(-x, -z) * 180) / Math.PI
}

/**
 * De qué rumbo a qué rumbo ocupa la placa del menú vista desde los ojos, en grados (positivo a la
 * izquierda), con el margen ya sumado.
 */
export function rumbosDelMenu(pose: MenuPose = XR_MENU_POSE): [number, number] {
  const medio = (MENU_PANEL[0] * pose.scale) / 2
  // El +X de la placa, girada `yaw` sobre la vertical como el `rotation.y` de three.
  const dx = Math.cos(pose.yaw) * medio
  const dz = -Math.sin(pose.yaw) * medio
  const [x, , z] = pose.position
  const a = rumbo(x - dx, z - dz)
  const b = rumbo(x + dx, z + dz)
  return [Math.min(a, b) - MARGEN_DEL_MENU_GRADOS, Math.max(a, b) + MARGEN_DEL_MENU_GRADOS]
}

/**
 * Si el palo que cuelga de ese gancho se ve por delante de la placa del menú.
 *
 * El gancho viene en las coordenadas de la máquina (el centro del aro en el origen) y quien
 * juega está `PLAYER_OFFSET_Z` por detrás de él. Solo se mira el rumbo: la placa de la columna
 * mide más de un metro de alto y cubre, vista desde los ojos, toda la franja de donde cuelgan
 * los palos (`xrLayout.test.ts` lo comprueba).
 */
export function paloTapaElMenu(gancho: Vec3, pose: MenuPose = XR_MENU_POSE): boolean {
  const [x, , z] = gancho
  const delPalo = rumbo(x, z - PLAYER_OFFSET_Z)
  const lado = (Math.atan2(STICK_RADIUS, Math.hypot(x, z - PLAYER_OFFSET_Z)) * 180) / Math.PI
  const [desde, hasta] = rumbosDelMenu(pose)
  return delPalo + lado >= desde && delPalo - lado <= hasta
}

/**
 * La opacidad de un palo en este fotograma, yendo hacia la que le toca sin saltar: nada que se
 * vea grande cambia de brillo de golpe (`.claude/rules/xr.md`).
 */
export function opacidadHacia(actual: number, objetivo: number, delta: number): number {
  const paso = Math.max(0, delta) * ATENUAR_POR_SEGUNDO
  return actual < objetivo ? Math.min(objetivo, actual + paso) : Math.max(objetivo, actual - paso)
}

/** Centro del panel del menú en el visor. */
export const XR_MENU_POSITION: Vec3 = XR_MENU_POSE.position
/** Marcador, por debajo del menú para no cruzarse con los palos. */
export const XR_HUD_POSITION: Vec3 = [0, 0.95, -0.85]

/**
 * Lo alto que se pone el panel del marcador, en metros.
 *
 * Vive aquí y no dentro de `XRHud.tsx` porque **no es solo suyo**: el tutorial ahora se
 * enseña con la partida en marcha, así que los dos paneles están a la vez delante de la
 * misma cara y el de arriba tiene que dejar sitio al de abajo. Escrito dentro del
 * componente, ese reparto no se podría comprobar desde ningún test.
 *
 * `run` es lo que ocupa jugando; `finished`, con el resultado y su fila de botones; y
 * `livesRow` lo que se le añade cuando lleva corazones o estrellas.
 */
export const XR_HUD_PANEL = { run: 0.27, finished: 0.42, livesRow: 0.06 } as const

/**
 * El cartel del objetivo (`lib/objetivo.ts`, `lib/cartelDeLaMaquina.ts`): **de frente, justo
 * encima del marcador**, que es la franja que ya se miraba para saber cómo iba la partida.
 *
 * Por debajo de la máquina y no encima del aro: los palos cuelgan y caen por delante de la cara,
 * y un cartel ahí arriba taparía la caída. Aquí queda a 27° por debajo de la mirada —se lee
 * bajando los ojos, sin mover la cabeza— y más lejos que cualquier palo (el del frente cae a 65 cm
 * y esto está a 85), así que ninguno queda detrás de él. Su borde de arriba se queda por debajo
 * del aviso de salir y del tutorial, que empiezan a 1,21 m.
 *
 * A CALIBRAR CON EL VISOR (la altura: más arriba se lee mejor y se acerca al tutorial).
 */
export const XR_CARTEL_POSITION: Vec3 = [0, 1.16, -0.85]

/**
 * El marcador cuando el cartel de encima ya dice los puntos y las vidas: se queda con las fichas
 * de los palos y la racha —y, al acabar, los botones—, y su panel encoge a lo que lleva.
 *
 * `height` es lo alto del panel y `centre` dónde queda su centro respecto del sitio del marcador:
 * su borde de arriba no pasa de 13,5 cm, que es lo que deja libre al cartel. Las fichas no se
 * mueven al acabar (`content`): con el cartel encima no hay sitio hacia arriba, y los botones
 * ocupan lo que dejaron la barra y las vidas.
 */
export const XR_HUD_WITH_SIGN = {
  content: 0.04,
  run: { height: 0.15, centre: 0.06 },
  finished: { height: 0.33, centre: -0.03 },
} as const

/** Cómo se reparte el marcador: lo alto de su panel, dónde va su centro y a qué altura las fichas. */
export interface HudLayout {
  readonly height: number
  readonly centre: number
  readonly content: number
}

/**
 * El reparto del marcador en cada momento.
 *
 * @param finished con la partida acabada: el panel lleva además la fila de botones
 * @param row con fila de vidas o de estrellas bajo la barra
 * @param sign el cartel de encima ya dice los puntos y las vidas (`XR_HUD_WITH_SIGN`)
 */
export function xrHudLayout({ finished, row, sign }: { finished: boolean; row: boolean; sign: boolean }): HudLayout {
  if (sign) return { content: XR_HUD_WITH_SIGN.content, ...(finished ? XR_HUD_WITH_SIGN.finished : XR_HUD_WITH_SIGN.run) }
  return {
    height: (finished ? XR_HUD_PANEL.finished : XR_HUD_PANEL.run) + (row ? XR_HUD_PANEL.livesRow : 0),
    centre: 0,
    content: finished ? 0.1 : 0.04,
  }
}
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
 * El aviso de dejar la partida: **delante, a la altura de la vista**.
 *
 * Se pregunta con la partida parada, así que ocupa el sitio donde ya se está mirando y no
 * un rincón: lo que se decide aquí es perder lo que se lleve hecho. Era el sitio del menú;
 * el menú se ha ido a la columna de la izquierda y el aviso se queda delante.
 */
export const XR_CONFIRM_POSITION: Vec3 = [0, 1.4, -0.89]
export const XR_CONFIRM_SIZE: [number, number] = [0.78, 0.38]

/**
 * El final de una tanda a dos —el aviso de pasar el mando, o quién gana—: **en el sitio del aviso
 * de salir**, delante y a la vista, encima del marcador del final. Con la partida acabada no se
 * pregunta nada, así que los dos nunca coinciden; y el marcador, con sus botones de jugar y de
 * volver al menú, sigue debajo, donde se pulsa.
 */
export const XR_DUEL_POSITION: Vec3 = XR_CONFIRM_POSITION
export const XR_DUEL_SIZE: [number, number] = [0.9, 0.26]
/** A qué tamaño se escribe, en metros de alto de letra (`duelo.legible.test.ts`). */
export const DUEL_TEXT = { title: 0.045, body: 0.034 } as const

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
/**
 * Botón de salir del visor, **en la esquina de abajo a la derecha del panel del menú**.
 *
 * Esa esquina es la misma en los trece juegos y el porqué está en `lib/exitCorner.ts`: el
 * dibujo ya se había unificado —la flecha de volver— pero el sitio no, y con el visor puesto
 * eso se nota como que hay que buscarla en cada cabina. Aquí estaba en la punta izquierda de
 * la fila, así que las dos puntas se intercambiaron: la distancia entre ellas, que es lo que
 * evita pulsar una por otra a pulso, no cambia.
 */
export const XR_MENU_EXIT_OFFSET: Vec3 = [0.42, -0.37 + SUBIDA_DE_LA_PISTA, 0]
/**
 * Botón de silenciar, en la esquina opuesta a la de salir del visor. Los dos
 * ajustes de la fila de abajo quedan así uno en cada punta, con el de empezar
 * en medio: en el visor se apunta a pulso y un vecino a pocos centímetros se
 * pulsa por error.
 */
export const XR_MENU_SOUND_OFFSET: Vec3 = [-0.42, -0.37, 0]
/**
 * Fila de ajustes, la primera bajo la del aro: a la izquierda a qué se juega
 * (práctica, niveles o desafío) y a la derecha qué se ve alrededor. **El menú
 * empieza por el modo**: es lo que decide si hay algo más que preguntar —solo la
 * práctica pregunta palos y velocidad, que salen debajo— o si ya se le puede dar
 * a empezar. Van a las dos puntas y no juntos en el centro por lo mismo que los
 * botones de la fila de abajo: en el visor se apunta a pulso y un vecino a pocos
 * centímetros se pulsa por error.
 */
const SETTINGS_ROW_Y = 0.168 + SUBIDA_DE_LA_PISTA
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
/**
 * Contra quién —solo, o a dos pasándose el mando—, **en el mismo hueco** y solo en el desafío:
 * sin fin es de la práctica y contra quién del desafío (`duel.ts`), así que nunca se ven los dos, y
 * comparten la caja de pulsación (`XR_MENU_HIT.endless`).
 */
export const XR_PLAYERS_TOGGLE_OFFSET: Vec3 = XR_ENDLESS_TOGGLE_OFFSET
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
 * encima del resto porque es lo único que se toca **mirando la máquina**: con la
 * columna a la izquierda, el aro pasa por delante del panel, a la derecha de lo
 * que se mira, así que al pulsar se ve subir o bajar.
 */
//
// Medio centímetro más arriba de lo que estaba, lo que le queda antes de salirse de la altura
// cómoda (`xrInteraction.test.ts`): es lo que deja a la fila del modo subir bajo ella sin que
// el nombre de «Alrededor» —ancho en español— se meta en el botón de la música.
const HOOP_ROW_Y = 0.345 + SUBIDA_DE_LA_PISTA
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
 * Lo que mide el panel del tutorial, en metros.
 *
 * Las medidas de la flota, para que el panel sea el mismo en los quince: lleva contador,
 * frase, el gesto dibujado y dos botones, y la frase ocupa **tres líneas en español donde
 * ocupa dos en inglés**.
 */
export const TUTORIAL_PANEL = { width: 0.78, height: 0.62 } as const

/**
 * A qué tamaño se escribe cada cosa de ese panel, en metros de alto de letra.
 *
 * Una sola lista para quien pinta y para quien mide (`tutorial.legible.test.ts`), como
 * `MENU_TEXT`: una letra escrita a mano, o encogida para caber, no pasa sin verse.
 */
export const TUTORIAL_TEXT = { counter: 0.03, phrase: 0.042, button: 0.032 } as const

/** Lo que mide cada uno de sus dos botones: lo bastante ancho para «Saltar tutorial». */
export const TUTORIAL_BOTON = { width: 0.33, height: 0.09 } as const

/**
 * Tutorial: al frente, **por encima del marcador**.
 *
 * Ya no toma el relevo del menú —ahora se aprende jugando, con los palos cayendo—, así que
 * comparte pantalla con el marcador del visor (`XR_HUD_POSITION`) en vez de sustituirlo. De
 * ahí que suba: en el sitio del menú, su borde de abajo se metía en el borde de arriba del
 * marcador y el resultado era leer una cosa encima de la otra. Lo vigila
 * `xrInteraction.test.ts`.
 */
export const XR_TUTORIAL_POSITION: Vec3 = [0, 1.52, -0.95]
/** Altura de la fila de botones dentro del panel, medida desde su centro. */
const TUTORIAL_BOTON_Y = -TUTORIAL_PANEL.height / 2 + 0.08
/**
 * Botón de saltar el tutorial, abajo a la izquierda de su panel.
 *
 * Apartado de lo que se está enseñando, pero dentro del mismo panel: tiene que verse desde
 * el primer segundo sin competir con la lección. Y en la punta contraria a la de siguiente:
 * en el visor se apunta a pulso y un vecino a pocos centímetros se pulsa por error.
 */
export const XR_TUTORIAL_SKIP_OFFSET: Vec3 = [-0.19, TUTORIAL_BOTON_Y, 0]
/** Botón de pasar al paso siguiente, en la otra punta de esa fila. */
export const XR_TUTORIAL_NEXT_OFFSET: Vec3 = [0.19, TUTORIAL_BOTON_Y, 0]

/** Separación entre los palos del selector de cantidad. */
export const XR_STICK_PICKER_SPACING = 0.055
/**
 * Separación entre las casillas del selector de nivel, que ocupa la fila de
 * los palos en el modo Niveles: quince casillas en el ancho de trece palos.
 */
export const XR_LEVEL_PICKER_SPACING = 0.047
/** Separación entre las fichas de dificultad. */
export const XR_DIFFICULTY_SPACING = 0.17

/**
 * Altura del selector de palos dentro del panel —y del de niveles, que ocupa su fila—, bajo
 * la fila del modo: lo que se pregunta sale **después** de elegir a qué se juega, y solo en
 * práctica (`picksSetup`).
 *
 * Las cotas de las cuatro filas van apuradas al milímetro, y no es capricho: el aro no puede
 * subir más, empezar no puede bajar, y en medio caben justas tres filas con su nombre encima
 * sin que ningún nombre toque un botón ni ninguna caja pise la de la fila de al lado. Lo vigila
 * `xrLayout.test.ts` («el menú empieza por el modo») y `menu.legible.test.ts`.
 *
 * El nombre de cada fila y sus botones salen de la misma cota. Los palos se pintaban tres
 * centímetros por debajo de la suya y las fichas de velocidad dos, así que el nombre del modo,
 * que iba debajo, quedaba tapado por la ficha elegida.
 */
export const XR_STICK_ROW_Y = -0.014 + SUBIDA_DE_LA_PISTA
/** Altura del selector de dificultad dentro del panel: la última pregunta antes de empezar. */
export const XR_DIFFICULTY_ROW_Y = -0.17 + SUBIDA_DE_LA_PISTA
/**
 * Lo alto que es la caja de pulsación de cada ficha de esas dos filas. Declarado aquí y no en
 * el componente para que el test de disposición compruebe que no se meten en las filas de al
 * lado: una caja invisible que pisa al vecino es un botón que no responde.
 */
export const XR_ROW_HIT_HEIGHT = { sticks: 0.16, difficulty: 0.15 } as const
const STICK_PICKER_Y = XR_STICK_ROW_Y
const DIFFICULTY_Y = XR_DIFFICULTY_ROW_Y
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
  { text: 'Players', x: 0, y: SETTINGS_ROW_Y },
  { text: 'Around', x: 0.245, y: SETTINGS_ROW_Y },
] as const

/**
 * Los nombres de fila que se enseñan con cada modo. **Solo la práctica pregunta** palos y
 * velocidad; en Niveles la fila de los palos es la escalera y la velocidad se ve apagada, la
 * del nivel; el desafío va fijo (`CHALLENGE_SETUP`) y sus filas no se ven, así que tampoco
 * sus nombres: un rótulo sobre un hueco se lee como una opción que falta.
 */
export function menuLabelsFor(mode: GameMode): readonly (typeof MENU_LABELS)[number][] {
  // Contra quién solo se pregunta en el desafío, en el hueco del centro de la fila de ajustes.
  const conSuFila = MENU_LABELS.filter(({ text }) => text !== 'Players' || eligeJugadores(mode))
  if (picksSetup(mode) || mode === 'levels') return conSuFila
  return conSuFila.filter(({ text }) => text !== 'Sticks' && text !== 'Speed')
}

/**
 * Lo que se escribe en un rótulo del menú. El de la fila del modo dice **cuál** hay elegido
 * —«Challenge», que en español es «Reto»—: su interruptor lo dibuja con corazones o estrellas,
 * y un dibujo no dice cómo se llama lo que cuenta para medalla. Los demás, lo que son.
 */
export function menuLabelText(
  text: (typeof MENU_LABELS)[number]['text'],
  mode: GameMode,
): Exclude<(typeof MENU_LABELS)[number]['text'], 'Mode'> | (typeof GAME_MODE_LABELS)[GameMode] {
  return text === 'Mode' ? GAME_MODE_LABELS[mode] : text
}

function offset([x, y, z]: Vec3, dx: number, dy: number): Vec3 {
  return [x + dx, y + dy, z]
}

/**
 * Dónde cae un punto del panel del menú, dado en coordenadas del panel, en el espacio de la
 * interfaz: escalado y girado como lo hace three con el grupo del panel.
 */
export function onMenu(dx: number, dy: number, pose: MenuPose = XR_MENU_POSE): Vec3 {
  const [x, y, z] = pose.position
  const cos = Math.cos(pose.yaw)
  const sin = Math.sin(pose.yaw)
  return [x + dx * pose.scale * cos, y + dy * pose.scale, z - dx * pose.scale * sin]
}

/** Botón de volver al menú durante la partida. */
export function xrQuitButtonPosition(): Vec3 {
  return XR_QUIT_POSITION
}

/** Botón de salir del visor, dentro del panel del menú. */
export function xrMenuExitPosition(pose: MenuPose = XR_MENU_POSE): Vec3 {
  const [dx, dy] = XR_MENU_EXIT_OFFSET
  return onMenu(dx, dy, pose)
}

/** Botón de silenciar, dentro del panel del menú. */
export function xrMenuSoundPosition(pose: MenuPose = XR_MENU_POSE): Vec3 {
  const [dx, dy] = XR_MENU_SOUND_OFFSET
  return onMenu(dx, dy, pose)
}

/** Interruptor de modo (práctica, niveles o desafío), dentro del panel del menú. */
export function xrModeTogglePosition(pose: MenuPose = XR_MENU_POSE): Vec3 {
  const [dx, dy] = XR_MODE_TOGGLE_OFFSET
  return onMenu(dx, dy, pose)
}

/** Interruptor de tanda o sin fin, dentro del panel del menú. */
export function xrEndlessTogglePosition(pose: MenuPose = XR_MENU_POSE): Vec3 {
  const [dx, dy] = XR_ENDLESS_TOGGLE_OFFSET
  return onMenu(dx, dy, pose)
}

/** Casilla del nivel `level` (1-based) del selector de nivel. */
export function xrLevelOptionPosition(
  level: number,
  levelCount: number,
  pose: MenuPose = XR_MENU_POSE,
): Vec3 {
  const width = (levelCount - 1) * XR_LEVEL_PICKER_SPACING
  return onMenu((level - 1) * XR_LEVEL_PICKER_SPACING - width / 2, STICK_PICKER_Y, pose)
}
/** Selector de escenario o passthrough, dentro del panel del menú. */
export function xrSceneryPickerPosition(pose: MenuPose = XR_MENU_POSE): Vec3 {
  const [dx, dy] = XR_SCENERY_PICKER_OFFSET
  return onMenu(dx, dy, pose)
}

/** Botón de bajar el aro, dentro del panel del menú. */
export function xrHoopDownPosition(pose: MenuPose = XR_MENU_POSE): Vec3 {
  const [dx, dy] = XR_HOOP_DOWN_OFFSET
  return onMenu(dx, dy, pose)
}

/** Botón de subir el aro, dentro del panel del menú. */
export function xrHoopUpPosition(pose: MenuPose = XR_MENU_POSE): Vec3 {
  const [dx, dy] = XR_HOOP_UP_OFFSET
  return onMenu(dx, dy, pose)
}

/** Botón de volver a ver el tutorial, dentro del panel del menú. */
export function xrMenuTutorialPosition(pose: MenuPose = XR_MENU_POSE): Vec3 {
  const [dx, dy] = XR_MENU_TUTORIAL_OFFSET
  return onMenu(dx, dy, pose)
}

/** Botón de saltar el tutorial, dentro de su panel. */
export function xrTutorialSkipPosition(): Vec3 {
  const [dx, dy] = XR_TUTORIAL_SKIP_OFFSET
  return offset(XR_TUTORIAL_POSITION, dx, dy)
}

/** Botón de pasar al paso siguiente, dentro del panel del tutorial. */
export function xrTutorialNextPosition(): Vec3 {
  const [dx, dy] = XR_TUTORIAL_NEXT_OFFSET
  return offset(XR_TUTORIAL_POSITION, dx, dy)
}

/** Botón de empezar partida. */
export function xrPlayButtonPosition(pose: MenuPose = XR_MENU_POSE): Vec3 {
  const [dx, dy] = XR_MENU_PLAY_OFFSET
  return onMenu(dx, dy, pose)
}

/**
 * Posición del palo `index` (0-based) del selector de cantidad. El selector
 * muestra los `MAX_STICKS` posibles y se elige tocando hasta cuál se quiere.
 */
export function xrStickOptionPosition(index: number, pose: MenuPose = XR_MENU_POSE): Vec3 {
  const width = (MAX_STICKS - 1) * XR_STICK_PICKER_SPACING
  return onMenu(index * XR_STICK_PICKER_SPACING - width / 2, STICK_PICKER_Y, pose)
}

/** Posición de la ficha de una dificultad. */
export function xrDifficultyOptionPosition(
  difficulty: Difficulty,
  pose: MenuPose = XR_MENU_POSE,
): Vec3 {
  const index = DIFFICULTY_ORDER.indexOf(difficulty)
  const width = (DIFFICULTY_ORDER.length - 1) * XR_DIFFICULTY_SPACING
  return onMenu(index * XR_DIFFICULTY_SPACING - width / 2, DIFFICULTY_Y, pose)
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
 * `*.legible.test.ts` para medir cada letra donde queda de verdad. `yaw` es el giro del panel
 * cuando no está de frente, como la columna del menú.
 */
export function xrPanelViews(position: Vec3, yaw = 0): { donde: string; pose: PanelPose; ojos: Point }[] {
  return EYE_HEIGHTS.flatMap((ojos) =>
    [false, true].map((aLaAlturaDeLosOjos) => ({
      donde: `ojos a ${ojos} m${aLaAlturaDeLosOjos ? ', mundo a su altura' : ''}`,
      pose: {
        position: [
          position[0],
          position[1] + worldRise(ojos, aLaAlturaDeLosOjos) + xrUiRiseOverWorld(ojos, aLaAlturaDeLosOjos),
          position[2],
        ] as const,
        ...(yaw === 0 ? {} : { rotation: [0, yaw, 0] as const }),
      },
      ojos: eyesAt(ojos),
    })),
  )
}
