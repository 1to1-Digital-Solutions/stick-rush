export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'impossible'

/** Velocidad de caída (unidades por segundo) por dificultad. */
export const DIFFICULTY_SPEEDS: Record<Difficulty, number> = {
  easy: 0.8,
  medium: 1.5,
  hard: 2.5,
  expert: 4.0,
  impossible: 7.0,
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

/** Paleta de los sticks; se asigna cíclicamente por índice. */
export const STICK_COLORS = ['#D97706', '#15803D', '#DC2626', '#7C3AED', '#0284C7']

/** Límites de palos seleccionables. */
export const MIN_STICKS = 5
export const MAX_STICKS = 13

/** Geometría de la máquina y de los palos. */
export const MACHINE_RADIUS = 3
export const MACHINE_HEIGHT = 3
export const STICK_LENGTH = 1.5
export const GROUND_Y = -2
/** Hueco entre el arco y el palo, ocupado por el hilo del que cuelga. */
export const STICK_CORD_LENGTH = 0.25

/**
 * Escala del jugador en sesión inmersiva.
 *
 * La escena está modelada en unidades pensadas para la cámara de escritorio: del
 * suelo (`GROUND_Y`) al alto del arco hay ~6.5 unidades. Si esas unidades fueran
 * metros, el jugador tendría los palos a más de 3 m por encima de la cabeza y
 * una máquina de 6 m de ancho. En vez de rehacer la geometría (que la versión
 * Godot replica), se agranda el origen del jugador: el mundo se percibe a
 * 1/XR_PLAYER_SCALE, dejando el arco algo más de un metro sobre los ojos y los
 * palos cayendo a la altura de las manos.
 */
export const XR_PLAYER_SCALE = 2.2

/** Distancia (en unidades de mundo) del jugador al centro de la máquina. */
export const XR_PLAYER_DISTANCE = 5

/**
 * Pausa entre el fin de una partida en XR y el arranque de la siguiente. En
 * inmersivo no hay botón "Volver al menú", así que la partida encadena sola:
 * este margen es el que tiene el jugador para leer el resultado en el HUD 3D.
 */
export const XR_RESTART_DELAY_MS = 4000

/** Color del color picker por defecto. */
export function stickColor(index: number): string {
  return STICK_COLORS[index % STICK_COLORS.length]
}
