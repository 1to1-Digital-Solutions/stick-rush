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

/** Color del color picker por defecto. */
export function stickColor(index: number): string {
  return STICK_COLORS[index % STICK_COLORS.length]
}
