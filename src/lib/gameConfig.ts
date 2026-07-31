export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'impossible'

/**
 * Velocidad de caída en metros por segundo. La escena está a escala humana
 * (1 unidad = 1 metro) y un palo recorre ~1.6 m desde que se suelta hasta el
 * suelo, así que en Fácil dura algo menos de 6 s y en Imposible, siete décimas.
 */
export const DIFFICULTY_SPEEDS: Record<Difficulty, number> = {
  easy: 0.28,
  medium: 0.5,
  hard: 0.85,
  expert: 1.35,
  impossible: 2.4,
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
/** Radio del aro: al alcance del brazo desde el centro. */
export const MACHINE_RADIUS = 1.25
/** Altura del aro sobre el suelo: por encima de la cabeza, sin llegar a estorbar. */
export const MACHINE_HEIGHT = 2.15
export const STICK_LENGTH = 0.42
export const STICK_RADIUS = 0.022
export const GROUND_Y = 0
/** Hueco entre el aro y el palo, ocupado por el hilo del que cuelga. */
export const STICK_CORD_LENGTH = 0.12

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

/**
 * Pausa entre el fin de una partida en XR y el arranque de la siguiente. En
 * inmersivo no hay botón "Volver al menú", así que la partida encadena sola:
 * este margen es el que tiene el jugador para leer el resultado en el HUD 3D.
 */
export const XR_RESTART_DELAY_MS = 4000

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
