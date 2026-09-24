export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'impossible'

/**
 * Velocidad de caída en metros por segundo. La escena está a escala humana
 * (1 unidad = 1 metro) y un palo recorre ~1.45 m desde que se suelta hasta el
 * suelo, así que en Fácil dura algo menos de 6 s y en Imposible, siete décimas.
 *
 * Se recalculan cada vez que cambia la geometría —primero al acercar el aro al
 * jugador, luego al encogerlo un 8 %—, porque el recorrido cambia con ella y si
 * no todas las dificultades se desplazarían sin que nadie lo decidiera.
 * `gameConfig.test.ts` vigila que los márgenes de reacción sigan en su sitio.
 */
export const DIFFICULTY_SPEEDS: Record<Difficulty, number> = {
  easy: 0.257,
  medium: 0.452,
  hard: 0.771,
  expert: 1.213,
  impossible: 2.16,
}

/** Etiqueta visible para el usuario (idioma del producto: español). */
export const DIFFICULTY_LABELS = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
  impossible: 'Impossible',
} as const satisfies Record<Difficulty, string>

/** Orden de dificultades de menor a mayor para construir selectores. */
export const DIFFICULTY_ORDER: Difficulty[] = [
  'easy',
  'medium',
  'hard',
  'expert',
  'impossible',
]

/**
 * Color de cada botón de dificultad: progresa de verde (fácil) a rojo
 * (imposible). Sirve como señal visual de prioridad/riesgo, siempre
 * acompañada de texto para no depender solo del color.
 */
export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: '#15803d',
  medium: '#65a30d',
  hard: '#d97706',
  expert: '#ea580c',
  impossible: '#dc2626',
}

/**
 * Rojo de las vidas del desafío. Uno solo para el menú de escritorio, el
 * marcador y el visor: un corazón que cambia de color al pasar de un sitio a
 * otro deja de leerse como lo mismo.
 */
export const LIFE_COLOR = '#f87171'

/** Color de los palos: madera pintada de amarillo de feria. */
export const STICK_COLOR = '#e8b93f'
/** Verde del acierto: el palo se enciende al atraparlo. */
export const STICK_CAUGHT_COLOR = '#22c55e'
/** Rojo del fallo: el palo que toca el suelo se queda teñido. */
export const STICK_MISSED_COLOR = '#b91c1c'

/** Tonos de la máquina, a rayas de caseta de feria. */
export const MACHINE_STRIPE_COLORS = ['#c1121f', '#f4ece0']
/** Postes y remates de la máquina. */
export const MACHINE_FRAME_COLOR = '#9a7b33'
/** Celosía (aro superior, montantes y diagonales): hierro pintado. */
export const MACHINE_TRUSS_COLOR = '#6d6357'
/** Bombillas de la guirnalda. */
export const MACHINE_BULB_COLOR = '#ffd479'

/** Fondo y niebla fuera de AR: noche de plaza, a juego con el escenario. */
export const BACKDROP_COLOR = '#0d1017'

/**
 * Tonos del recinto de feria que rodea al jugador (ver `sceneryLayout.ts`). Los
 * toldos, las bombillas y el herraje son los mismos de la máquina: el recinto
 * tiene que parecer el sitio del que ha salido, no otro decorado.
 */
export const FAIR_WOOD_COLOR = '#4a3a2c'
/** Tablero del mostrador: lo más claro de la caseta, para que se lea de noche. */
export const FAIR_COUNTER_COLOR = '#cbb894'
/**
 * Carteles de las casetas. Son varios para que el círculo no parezca la misma
 * caseta repetida seis veces, que es justo lo que delata un decorado generado.
 */
export const FAIR_SIGN_COLORS = ['#1d3557', '#7a1f2b', '#1f5f4a']
/** Premios apilados dentro de la caseta, a la vista sobre el mostrador. */
export const FAIR_PRIZE_COLORS = ['#e8b93f', '#c1121f', '#4c8fbd']
/** Tonos de la ropa del público: oscuros, para que sean siluetas contra las luces. */
export const CROWD_SHADES = ['#2b2430', '#3b2e28', '#233040', '#3a2c3c', '#2f3a2e']
/** El blanco al que tiran las bombillas cuando la racha monta la fiesta. */
export const PARTY_BULB_COLOR = '#fff6e6'

/** Límites de palos seleccionables. */
export const MIN_STICKS = 5
export const MAX_STICKS = 13

/**
 * Geometría de la máquina y de los palos, en metros.
 *
 * El aro es un semicírculo **horizontal** (en el plano XZ) que rodea al jugador
 * por delante: él se planta en el centro y estira el brazo para atrapar los
 * palos, que le caen alrededor y no encima. Con el arco vertical de antes, los
 * palos del centro le caían literalmente sobre la cabeza.
 */
/**
 * Radio del aro. Manda el alcance real del brazo: los palos se cogen con la
 * mano (agarre), no apuntando, así que tienen que caer dentro del volumen que
 * el jugador alcanza sin moverse de sitio. Con el 1.25 m del diseño original se
 * veían lejos y no había forma de llegar a ellos en el visor.
 */
export const MACHINE_RADIUS = 0.57
/**
 * Altura **nominal** del aro: justo encima de la cabeza. Los palos cuelgan hasta
 * ~1.4 m y caen atravesando la altura del pecho, que es donde la mano llega
 * cómoda.
 *
 * **No se encoge con el resto.** La máquina se redujo un 8 % porque se veía
 * demasiado grande, pero esta cota la manda la estatura del jugador, no el
 * tamaño de la máquina: bajarla dejaría el aro a la altura de los ojos.
 *
 * Y por eso mismo tampoco es fija: en el visor la altura de verdad sale de la
 * del jugador (ver `hoopHeight.ts`), y esta es la que le corresponde a la
 * estatura de referencia. Es la que se usa en escritorio y la que hace de
 * respaldo cuando el visor no dice a qué altura está la cabeza.
 */
export const MACHINE_HEIGHT = 1.95
export const STICK_LENGTH = 0.39
export const STICK_RADIUS = 0.02
export const GROUND_Y = 0
/** Hueco entre el aro y el palo, ocupado por el hilo del que cuelga. */
export const STICK_CORD_LENGTH = 0.11

/**
 * Dónde se planta el jugador respecto al centro del aro, en metros (−Z es hacia el arco).
 *
 * Se ha movido dos veces, siempre por lo que se vio con el visor puesto:
 *
 * - **A −0,18 era demasiado**: «el jugador arranca muy pegado a la máquina, quizás medio
 *   pasito para atrás». Se dejó en −0,02, casi en el centro del aro.
 * - **Y desde ahí, un minipaso atrás** («está perfecto», con este único retoque): diez
 *   centímetros **por detrás** del centro. Los palos del frente quedan algo más lejos
 *   —65 cm en horizontal, dentro de los 75 del brazo— y los de los extremos, que antes
 *   caían a un lado, pasan a caer un poco por delante: la máquina entera se ve delante y
 *   nada le cae encima a quien juega. Lo que se sigue exigiendo es que cada palo **cruce**
 *   el alcance del brazo al caer (`xrInteraction.test.ts`, `hoopHeight.test.ts`).
 *
 * A CALIBRAR CON EL VISOR.
 */
export const PLAYER_OFFSET_Z = 0.08

/** Posición del jugador: los pies, en el suelo, un paso por detrás del centro del aro. */
export const PLAYER_POSITION: [number, number, number] = [
  0,
  GROUND_Y,
  PLAYER_OFFSET_Z,
]

/** Distancia desde el jugador hasta un punto de la escena, en metros. */
export function distanceFromPlayer([x, y, z]: [
  number,
  number,
  number,
]): number {
  const [px, , pz] = PLAYER_POSITION
  return Math.hypot(x - px, y - PLAYER_SHOULDER_HEIGHT, z - pz)
}

/** Altura de hombro de referencia, origen del alcance del brazo. */
export const PLAYER_SHOULDER_HEIGHT = 1.45

/**
 * Cota del anclaje a partir de la cual el palo se considera perdido: la que
 * deja su punta justo sobre el suelo. Medirlo en el anclaje hacía que el palo
 * entero se hundiera bajo el suelo (y siguiera siendo atrapable) antes de
 * contar como perdido.
 */
export const STICK_MISS_Y = GROUND_Y + STICK_CORD_LENGTH + STICK_LENGTH

/** Recorrido de un palo desde que se suelta hasta que se da por perdido. */
export const STICK_FALL_DISTANCE = MACHINE_HEIGHT - STICK_MISS_Y

/**
 * Segundos que tarda un palo en llegar al suelo en cada dificultad. Es el
 * margen real que tiene el jugador para atraparlo, y lo que se ajusta al tocar
 * `DIFFICULTY_SPEEDS` o la geometría de la máquina.
 */
export function fallDurationSeconds(difficulty: Difficulty): number {
  return STICK_FALL_DISTANCE / DIFFICULTY_SPEEDS[difficulty]
}

/**
 * Cuánto ha caído un palo cuyo anclaje está a la cota `y`: 0 recién soltado, 1
 * a punto de tocar el suelo. Es lo que convierte "dónde lo cogí" en el bonus de
 * reflejos de la puntuación (ver `scoring.ts`).
 *
 * `hoopHeight` es la cota desde la que salió ese palo: con el aro acomodado al
 * jugador (ver `hoopHeight.ts`) el recorrido cambia, y medirlo siempre contra la
 * altura nominal regalaría reflejos a quien lo tenga bajo y se los quitaría a
 * quien lo tenga alto.
 */
export function stickFallProgress(
  y: number,
  hoopHeight: number = MACHINE_HEIGHT,
): number {
  const distance = hoopHeight - STICK_MISS_Y
  if (!Number.isFinite(y) || !Number.isFinite(distance) || distance <= 0) {
    return 0
  }
  const fallen = (hoopHeight - y) / distance
  return Math.min(Math.max(fallen, 0), 1)
}

/**
 * Punto del aro para `t` en [0, 1], repartiendo de izquierda a derecha por
 * delante del jugador (mira hacia -Z). Es la misma curva que sigue la máquina y
 * de la que cuelgan los palos.
 */
export function machinePoint(
  t: number,
  hoopHeight: number = MACHINE_HEIGHT,
): [number, number, number] {
  const angle = (t - 0.5) * Math.PI
  return [
    Math.sin(angle) * MACHINE_RADIUS,
    hoopHeight,
    -Math.cos(angle) * MACHINE_RADIUS,
  ]
}

/**
 * Rutas de los assets locales (CC0, ver public/CREDITS.md), relativas a la base
 * desde la que se sirven: quien monta el juego decide dónde están (ver
 * `assets.ts`), así que se resuelven al pedirlos con `assetUrl()`.
 */
export const HDRI_PATH = 'hdri/plaza_pueblo_1k.exr'

/**
 * Mapas de la madera de los palos. Se usan el relieve y la rugosidad, que son
 * los que dan la sensación de madera con peso, pero no el mapa de color: es una
 * madera casi negra y, como el tinte multiplica, dejaba los palos marrón oscuro
 * en vez de amarillos. El color va plano, como madera pintada.
 */
export const WOOD_TEXTURES = {
  normalMap: 'textures/wood_nor_1k.jpg',
  roughnessMap: 'textures/wood_rough_1k.jpg',
} as const
