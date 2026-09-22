import { DIFFICULTY_LABELS, type Difficulty } from './gameConfig'
import {
  type GameMode,
  GAME_MODE_LABELS,
  startingLives,
} from './gameMode'
import { formatoDeCifra } from './textos'

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
 * aparte, en `components/shareOrCopy.ts`, fuera de `lib/`: pide el navegador, y aquí
 * dentro no puede haber nada que lo necesite. Esto es la lógica del juego y tiene que
 * correr también en el motor del puerto a Godot, donde no hay `navigator` ni `window`.
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

/**
 * Una cifra del texto que se comparte.
 *
 * En inglés, como el resto de este texto: lo que se comparte no está traducido —ni los
 * modos, ni las dificultades, ni las palabras—, así que una cifra a la española dentro de
 * una frase en inglés sería lo único fuera de sitio. El día que se traduzca, el idioma
 * entra por aquí.
 *
 * Sin números por debajo de cero: el récord sale del almacenamiento, que cualquiera puede
 * editar a mano, y esto lo lee otra persona que no ha jugado la partida.
 */
function scoreText(points: number): string {
  return formatoDeCifra(Math.max(0, points), 'en')
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
    `${scoreText(points)} points`,
    `${score} of ${stickCount} sticks`,
    // `lives` puede faltar aunque el modo las tenga (una partida que no llegó a
    // empezar): sin el dato se calla, que es mejor que inventarse un número.
    ...(totalLives != null && lives != null
      ? [`${lives} of ${totalLives} lives`]
      : []),
  ]

  const record = isRecord
    ? 'New record!'
    : bestPoints > 0
      ? `My record: ${scoreText(bestPoints)}`
      : null

  return [
    `${SHARE_TITLE} — ${GAME_MODE_LABELS[gameMode]} on ${DIFFICULTY_LABELS[difficulty]}`,
    stats.join(' · '),
    ...(record ? [record] : []),
    url,
  ].join('\n')
}
