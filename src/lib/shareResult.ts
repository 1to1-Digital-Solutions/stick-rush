import { DIFFICULTY_LABELS, type Difficulty } from './gameConfig'
import {
  type GameMode,
  GAME_MODE_LABELS,
  startingLives,
} from './gameMode'

/**
 * Enseñar la marca fuera del dispositivo.
 *
 * El récord vive en el `localStorage` del navegador (ver `highScore.ts`) y de
 * ahí no sale: media gracia de un juego de puntuación es poder enseñarla. Esto
 * es lo que la saca, y **solo eso**: se arma un texto y se le entrega al
 * sistema. No hay servidor, ni marcas ajenas, ni tabla online; compartir es
 * mandar un texto, no publicar un ranking.
 *
 * El texto se arma en una función pura para poder probarlo sin navegador —es
 * lo que acaba leyendo otra persona, así que su forma importa— y el reparto va
 * aparte, en `shareOrCopy`, que recibe el navegador por parámetro y así también
 * se prueba sin uno.
 */

/** Cómo se presenta el juego en la hoja de compartir del sistema. */
export const SHARE_TITLE = 'Stick Rush'

/** Lo que hace falta saber de una partida para contarla. */
export interface ShareResultInput {
  points: number
  /** Palos atrapados. */
  score: number
  stickCount: number
  difficulty: Difficulty
  gameMode: GameMode
  /** Vidas con las que se acabó, o `null` en un modo que no se juega con ellas. */
  lives: number | null
  /** Récord guardado del modo, ya incluida esta partida si la ha batido. */
  bestPoints: number
  /** Si esta partida es la que ha batido el récord. */
  isRecord: boolean
  /** Enlace al juego. */
  url: string
}

/** Igual que el resto del juego: miles con punto y sin decimales. */
function formatPoints(points: number): string {
  if (!Number.isFinite(points)) return '0'
  return Math.max(0, Math.round(points)).toLocaleString('es-ES')
}

/**
 * El resultado de una partida, en texto.
 *
 * Cuatro líneas como mucho, porque acaba en un mensaje: de qué modo y nivel iba
 * la partida, qué se sacó, la marca si hay algo que contar sobre ella, y el
 * enlace para que quien lo lea pueda intentarlo.
 *
 * Las vidas solo salen en desafío, que es donde significan algo: en práctica no
 * hay nada que perder y decir "sin vidas" sonaría a haber fracasado. El total
 * se deriva del modo (ver `gameMode.ts`) en vez de recibirse, para que no pueda
 * contarse una partida de tres vidas como si fueran cinco.
 */
export function buildShareText({
  points,
  score,
  stickCount,
  difficulty,
  gameMode,
  lives,
  bestPoints,
  isRecord,
  url,
}: ShareResultInput): string {
  const totalLives = startingLives(gameMode)
  const stats = [
    `${formatPoints(points)} puntos`,
    `${score} de ${stickCount} palos`,
    // `lives` puede faltar aunque el modo las tenga (una partida que no llegó a
    // empezar): sin el dato se calla, que es mejor que inventarse un número.
    ...(totalLives != null && lives != null
      ? [`${lives} de ${totalLives} vidas`]
      : []),
  ]

  const record = isRecord
    ? '¡Nuevo récord!'
    : bestPoints > 0
      ? `Mi récord: ${formatPoints(bestPoints)}`
      : null

  return [
    `${SHARE_TITLE} — ${GAME_MODE_LABELS[gameMode]} en ${DIFFICULTY_LABELS[difficulty]}`,
    stats.join(' · '),
    ...(record ? [record] : []),
    url,
  ].join('\n')
}

/** Cómo ha acabado el intento de compartir. */
export type ShareOutcome =
  /** Se abrió la hoja de compartir del sistema y siguió su curso. */
  | 'shared'
  /** No había con qué compartir (o no dejó): el texto quedó en el portapapeles. */
  | 'copied'
  /** El jugador cerró la hoja de compartir. No es un fallo. */
  | 'cancelled'
  /** Ni se pudo compartir ni copiar. */
  | 'unavailable'

/**
 * Lo que se necesita del navegador. Se declara aquí, en vez de pedir un
 * `Navigator` entero, para poder probar cada camino con un objeto de tres
 * líneas: los dos existen o no según el navegador, y ese es justo el caso que
 * hay que cubrir.
 */
export interface ShareTarget {
  share?: (data: { title?: string; text?: string }) => Promise<void>
  clipboard?: { writeText?: (text: string) => Promise<void> }
}

/** Cerrar la hoja de compartir llega como un `AbortError`. */
function isCancelled(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === 'AbortError'
}

/**
 * Comparte el texto, y si no se puede lo deja en el portapapeles.
 *
 * El plan B no es una cortesía: dentro de una sesión inmersiva la hoja de
 * compartir puede no abrirse —no hay dónde pintarla, o el navegador no
 * considera activación de usuario el gatillo de un mando—, y ahí un botón que
 * no hace nada es peor que no tener botón. Copiado, el texto sigue en el
 * portapapeles al quitarse el visor.
 *
 * Cancelar sí termina el intento: quien cierra la hoja ha decidido no
 * compartir, y copiarle el texto a escondidas sería hacer lo contrario de lo
 * que acaba de pedir.
 */
export async function shareOrCopy(
  text: string,
  target?: ShareTarget | null,
): Promise<ShareOutcome> {
  if (target?.share) {
    try {
      await target.share({ title: SHARE_TITLE, text })
      return 'shared'
    } catch (error) {
      if (isCancelled(error)) return 'cancelled'
      // Cualquier otro rechazo (sin permiso, sin activación, sin soporte real)
      // no cierra el intento: queda el portapapeles.
    }
  }

  const clipboard = target?.clipboard
  if (!clipboard?.writeText) return 'unavailable'
  try {
    await clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'unavailable'
  }
}
