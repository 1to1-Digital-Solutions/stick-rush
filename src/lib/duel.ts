/**
 * La partida a dos: dos personas, un mando y la misma tanda de palos.
 *
 * **Por qué por tandas y no palo a palo.** Sin red, dos personas solo pueden turnarse el mando, y
 * pasarse el visor —quitárselo, ajustarlo, colocarse bajo el aro— entre palo y palo convertiría la
 * partida en una sucesión de esperas. Los hermanos que tienen modo a dos cambian de turno por una
 * unidad entera de su juego (un cuadro en bolos, un hoyo en minigolf, un partido en ping pong), y
 * aquí la unidad natural es **la tanda**: la máquina cargada, que se vacía entera antes de pasar el
 * mando.
 *
 * **La del desafío, y con la misma semilla.** El desafío se juega siempre igual —Medio y los trece
 * palos, con tres vidas (`CHALLENGE_SETUP`)—, que es justo lo que hace falta para que dos tandas se
 * puedan comparar sin ponerse de acuerdo en el menú. Y los palos que caen, y en qué orden, salen de
 * la semilla de la partida (`stickSeed`): los dos ven caer **los mismos palos en el mismo orden**,
 * así que nadie juega una tanda con más suerte. Es la regla de table-tennis —misma máquina, misma
 * semilla, gana quien le saque más— con la máquina de los palos de rival.
 *
 * **Gana quien más puntos saque**, que en este juego ya premian coger pronto y encadenar
 * (`scoring.ts`): son la medida de lo bien que se ha jugado, no solo de cuántos. Quedarse sin vidas
 * a media tanda es dejar palos sin puntuar, y eso ya lo dicen los puntos. Con los mismos puntos es
 * empate: desempatar por otra cifra sería premiar algo que nadie buscaba.
 *
 * Los récords de cada uno no se tocan: una tanda a dos no es la marca de nadie (la regla de
 * tower-tumble). Lo que cuenta entre dos es quién gana, y eso se apunta aparte (`duelTally.ts`).
 *
 * Función pura, sin React: la partida a dos se prueba entera sin montar el juego, y el port de
 * Godot la usa tal cual.
 */

import type { Lang } from './ajustes'
import type { DuelTally } from './duelTally'
import type { GameMode } from './gameMode'
import { MENU_EN } from './palabras'
import { formatea, formatoDeCifra, texto, type TextKey } from './textos'

export type Player = 0 | 1

/** Cómo se llama cada uno en pantalla, en inglés: es la clave con la que se traduce. */
export const PLAYER_LABELS = ['Player 1', 'Player 2'] as const satisfies readonly [string, string]

/** Cuántos juegan: solo, o dos por turnos con el mismo mando. */
export const PLAYER_COUNTS = [1, 2] as const
export type PlayerCount = (typeof PLAYER_COUNTS)[number]

/** Etiqueta visible de cada opción, en inglés (ver `textos.ts`). */
export const PLAYER_COUNT_LABELS = {
  1: MENU_EN.solo,
  2: MENU_EN.duelo,
} as const satisfies Record<PlayerCount, string>

/** Qué promete cada opción, en una línea, para el menú. */
export const PLAYER_COUNT_HINTS = {
  1: 'Your three lives against your record.',
  2: 'Pass the controller: same sticks, most points wins.',
} as const satisfies Record<PlayerCount, string>

/**
 * El modo en el que se puede jugar a dos: el desafío.
 *
 * En la práctica cada uno elegiría palos y velocidad, y la partida sin fin la corta quien juega:
 * dos tandas así no se comparan. En Niveles cada uno va por su escalera. El desafío es la misma
 * partida para todos, y por eso es también la del reto del salón.
 */
export const MODO_DEL_DUELO: GameMode = 'challenge'

/** ¿Pregunta este modo cuántos juegan? */
export function eligeJugadores(mode: GameMode): boolean {
  return mode === MODO_DEL_DUELO
}

/** ¿Se juega a dos con esto elegido? Fuera del desafío, lo elegido no cuenta. */
export function juegaADos(mode: GameMode, players: PlayerCount): boolean {
  return eligeJugadores(mode) && players === 2
}

/** La partida a dos: la semilla que comparten y los puntos de cada uno, `null` mientras no ha jugado. */
export interface Duel {
  readonly semilla: number
  readonly points: readonly [number | null, number | null]
}

/** Una partida a dos sin empezar, con la semilla que van a jugar los dos: le toca al primero. */
export function createDuel(semilla: number): Duel {
  return { semilla, points: [null, null] }
}

/** A quién le toca, o `null` si los dos han jugado ya. */
export function duelTurn(duel: Duel): Player | null {
  if (duel.points[0] == null) return 0
  if (duel.points[1] == null) return 1
  return null
}

/** ¿Han jugado los dos? */
export function duelOver(duel: Duel): boolean {
  return duelTurn(duel) == null
}

/**
 * Quién tiene el mando: a quien le toca o, con las dos tandas jugadas, el último que jugó.
 *
 * Es lo que dice el marcador —de quién es la tanda que se ve— y siempre es alguien: una partida
 * acabada sigue enseñando la tanda que la cerró.
 */
export function controllerHolder(duel: Duel): Player {
  return duelTurn(duel) ?? 1
}

/**
 * Apunta los puntos de quien tenía el turno.
 *
 * Con los dos jugados no apunta nada: una tercera tanda no es de nadie, y sobrescribir una de las
 * dos cambiaría el resultado de algo que ya se ha visto.
 */
export function recordTurn(duel: Duel, points: number): Duel {
  const turn = duelTurn(duel)
  if (turn == null) return duel
  return { ...duel, points: turn === 0 ? [points, duel.points[1]] : [duel.points[0], points] }
}

/** Quién ha ganado, o `null` si no han jugado los dos o van empatados. */
export function duelWinner(duel: Duel): Player | null {
  const [one, two] = duel.points
  if (one == null || two == null || one === two) return null
  return one > two ? 0 : 1
}

/** El otro. */
export function otherPlayer(player: Player): Player {
  return player === 0 ? 1 : 0
}

/**
 * Los puntos que se le cuentan al salón de una partida a dos: los de quien más sacó. El salón paga
 * por partida terminada y enseña lo último que se jugó; la partida es de los dos, y lo que se
 * enseña de ella es lo mejor que se hizo.
 */
export function mejorDelDuelo(duel: Duel): number {
  return Math.max(duel.points[0] ?? 0, duel.points[1] ?? 0)
}

/** Lo que se dice al acabar una tanda de la partida a dos. */
export interface DuelSummary {
  /** Quién acaba de jugar y lo que ha sacado, o, con los dos jugados, quién ha ganado. */
  readonly title: string
  /** El aviso de pasar el mando, mientras le quede la tanda a alguien; si no, `null`. */
  readonly pass: string | null
  /** A quién le toca, para el botón de empezar; `null` con la partida acabada. */
  readonly next: Player | null
  /** Los puntos de cada uno que ya ha jugado, en orden de jugador. */
  readonly lines: readonly { readonly player: Player; readonly text: string }[]
  /** Quién ha ganado, o `null` mientras no han jugado los dos o si han empatado. */
  readonly winner: Player | null
  /** Las partidas que lleva la pareja, con la de ahora ya contada; solo al acabar la partida. */
  readonly tally: string | null
}

/**
 * El final de una tanda a dos, dicho igual en la web, en el visor y en el port de Godot: de quién
 * era y a quién le pasa el mando o, con las dos jugadas, quién gana y lo que lleva la pareja.
 *
 * El marcador de la pareja ya incluye la partida que acaba de terminar: se apunta al acabar
 * (`saveDuelResult`), antes de pintar esto.
 */
export function duelSummary(duel: Duel, tally: DuelTally, lang: Lang): DuelSummary {
  const t = (key: TextKey, valores: Record<string, string | number> = {}) => formatea(texto(lang, key), valores)
  const nombre = (player: Player) => texto(lang, PLAYER_LABELS[player])
  const puntos = (player: Player, points: number) =>
    t('{player}: {points} points', { player: nombre(player), points: formatoDeCifra(points, lang) })
  const lines = ([0, 1] as const).flatMap((player) => {
    const points = duel.points[player]
    return points == null ? [] : [{ player, text: puntos(player, points) }]
  })
  const turn = duelTurn(duel)
  if (turn != null) {
    const acaba = otherPlayer(turn)
    return {
      title: puntos(acaba, duel.points[acaba] ?? 0),
      pass: t('Pass the controller to {player}.', { player: nombre(turn) }),
      next: turn,
      lines,
      winner: null,
      tally: null,
    }
  }
  const winner = duelWinner(duel)
  return {
    title: winner == null ? t("It's a tie") : t('{player} wins', { player: nombre(winner) }),
    pass: null,
    next: null,
    lines,
    winner,
    tally: t('Duels won: {one}–{two} · tied: {ties}', { one: tally.wins[0], two: tally.wins[1], ties: tally.ties }),
  }
}
