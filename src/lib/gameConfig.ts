export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'impossible'

/**
 * Velocidad de caída en metros por segundo. La escena está a escala humana
 * (1 unidad = 1 metro) y un palo recorre ~1.4 m desde que se suelta hasta el
 * suelo, así que en Fácil dura algo menos de 6 s y en Imposible, siete décimas.
 *
 * Se recalcularon al acercar el aro al jugador: el recorrido se acortó y, con
 * las velocidades de antes, todas las dificultades se habrían vuelto un 12 %
 * más severas sin querer.
 */
export const DIFFICULTY_SPEEDS: Record<Difficulty, number> = {
  easy: 0.25,
  medium: 0.44,
  hard: 0.75,
  expert: 1.18,
  impossible: 2.1,
}

/** Etiqueta visible para el usuario (idioma del producto: español). */
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Fácil',
  medium: 'Medio',
  hard: 'Difícil',
  expert: 'Experto',
  impossible: 'Imposible',
}

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

/** Color de los palos: madera pintada de amarillo de feria. */
export const STICK_COLOR = '#e8b93f'

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
 * el jugador alcanza sin moverse de sitio. Con el 1.25 m de antes se veían
 * lejos y no había forma de llegar a ellos en el visor.
 */
export const MACHINE_RADIUS = 0.62
/**
 * Altura del aro: justo encima de la cabeza. Los palos cuelgan hasta ~1.4 m y
 * caen atravesando la altura del pecho, que es donde la mano llega cómoda.
 */
export const MACHINE_HEIGHT = 1.95
export const STICK_LENGTH = 0.42
export const STICK_RADIUS = 0.022
export const GROUND_Y = 0
/** Hueco entre el aro y el palo, ocupado por el hilo del que cuelga. */
export const STICK_CORD_LENGTH = 0.12

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
 * Punto del aro para `t` en [0, 1], repartiendo de izquierda a derecha por
 * delante del jugador (mira hacia -Z). Es la misma curva que sigue la máquina y
 * de la que cuelgan los palos.
 */
export function machinePoint(t: number): [number, number, number] {
  const angle = (t - 0.5) * Math.PI
  return [
    Math.sin(angle) * MACHINE_RADIUS,
    MACHINE_HEIGHT,
    -Math.cos(angle) * MACHINE_RADIUS,
  ]
}

/** Rutas de los assets locales (CC0, ver public/CREDITS.md). */
export const HDRI_URL = '/hdri/plaza_pueblo_1k.exr'

/**
 * Mapas de la madera de los palos. Se usan el relieve y la rugosidad, que son
 * los que dan la sensación de madera con peso, pero no el mapa de color: es una
 * madera casi negra y, como el tinte multiplica, dejaba los palos marrón oscuro
 * en vez de amarillos. El color va plano, como madera pintada.
 */
export const WOOD_TEXTURES = {
  normalMap: '/textures/wood_nor_1k.jpg',
  roughnessMap: '/textures/wood_rough_1k.jpg',
} as const
