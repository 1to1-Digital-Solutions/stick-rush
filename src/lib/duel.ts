/**
 * The two-player match: two people, one controller and the same round of sticks.
 *
 * **Why by rounds and not stick by stick.** Without a network, two people can only take turns with
 * the controller, and passing the headset —taking it off, adjusting it, standing under the hoop—
 * between stick and stick would turn the match into a succession of waits. The siblings that have a
 * two-player mode change turns by a whole unit of their game (a frame in bowling, a hole in
 * minigolf, a match in ping pong), and here the natural unit is **the round**: the loaded machine,
 * which empties completely before the controller is passed.
 *
 * **The challenge's one, and with the same seed.** The challenge is always played the same way
 * —Medium and the thirteen sticks, with three lives (`CHALLENGE_SETUP`)—, which is exactly what is
 * needed for two rounds to be comparable without agreeing on anything in the menu. And the sticks
 * that fall, and in which order, come from the match's seed (`stickSeed`): both see **the same
 * sticks fall in the same order**, so nobody plays a luckier round. It is the table-tennis rule
 * —same machine, same seed, whoever gets more out of it wins— with the stick machine as the rival.
 *
 * **Whoever scores more points wins**, and in this game they already reward catching early and
 * chaining (`scoring.ts`): they are the measure of how well it was played, not only of how many.
 * Running out of lives halfway through a round is leaving sticks unscored, and the points already
 * say that. With the same points it is a tie: breaking the tie by another figure would be rewarding
 * something nobody was after.
 *
 * Each one's records are not touched: a two-player round is nobody's best (the tower-tumble
 * rule). What counts between two is who wins, and that is noted separately (`duelTally.ts`).
 *
 * Pure function, no React: the two-player match is tested whole without mounting the game, and the
 * Godot port uses it as is.
 */

import type { Lang } from './settings'
import type { DuelTally } from './duelTally'
import type { GameMode } from './gameMode'
import { MENU_EN } from './menuWords'
import { formatText, formatFigure, texto, type TextKey } from './textos'

export type Player = 0 | 1

/** What each one is called on screen, in English: it is the key it is translated with. */
export const PLAYER_LABELS = ['Player 1', 'Player 2'] as const satisfies readonly [string, string]

/** How many play: alone, or two taking turns with the same controller. */
export const PLAYER_COUNTS = [1, 2] as const
export type PlayerCount = (typeof PLAYER_COUNTS)[number]

/** Visible label of each option, in English (see `textos.ts`). */
export const PLAYER_COUNT_LABELS = {
  1: MENU_EN.solo,
  2: MENU_EN.duel,
} as const satisfies Record<PlayerCount, string>

/** What each option promises, in one line, for the menu. */
export const PLAYER_COUNT_HINTS = {
  1: 'Your three lives against your record.',
  2: 'Pass the controller: same sticks, most points wins.',
} as const satisfies Record<PlayerCount, string>

/**
 * The mode in which two can play: the challenge.
 *
 * In practice each one would choose sticks and speed, and the endless run is cut short by whoever
 * plays: two rounds like that do not compare. In Levels each one climbs their own ladder. The
 * challenge is the same run for everyone, and that is why it is also the one of the hall's challenge.
 */
export const DUEL_MODE: GameMode = 'challenge'

/** Does this mode ask how many play? */
export function picksPlayers(mode: GameMode): boolean {
  return mode === DUEL_MODE
}

/** Is it played by two with this chosen? Outside the challenge, what was chosen does not count. */
export function playsAsDuel(mode: GameMode, players: PlayerCount): boolean {
  return picksPlayers(mode) && players === 2
}

/** The two-player match: the seed they share and each one's points, `null` while they have not played. */
export interface Duel {
  readonly seed: number
  readonly points: readonly [number | null, number | null]
}

/** A two-player match not yet started, with the seed both are going to play: it is the first one's turn. */
export function createDuel(seed: number): Duel {
  return { seed, points: [null, null] }
}

/** Whose turn it is, or `null` if both have already played. */
export function duelTurn(duel: Duel): Player | null {
  if (duel.points[0] == null) return 0
  if (duel.points[1] == null) return 1
  return null
}

/** Have both played? */
export function duelOver(duel: Duel): boolean {
  return duelTurn(duel) == null
}

/**
 * Who holds the controller: whoever's turn it is or, with both rounds played, the last one who played.
 *
 * It is what the scoreboard says —whose round is the one on view— and it is always someone: a
 * finished match still shows the round that closed it.
 */
export function controllerHolder(duel: Duel): Player {
  return duelTurn(duel) ?? 1
}

/**
 * Notes down the points of whoever had the turn.
 *
 * With both played it notes nothing: a third round is nobody's, and overwriting one of the
 * two would change the result of something that has already been seen.
 */
export function recordTurn(duel: Duel, points: number): Duel {
  const turn = duelTurn(duel)
  if (turn == null) return duel
  return { ...duel, points: turn === 0 ? [points, duel.points[1]] : [duel.points[0], points] }
}

/** Who has won, or `null` if both have not played or they are tied. */
export function duelWinner(duel: Duel): Player | null {
  const [one, two] = duel.points
  if (one == null || two == null || one === two) return null
  return one > two ? 0 : 1
}

/** The other one. */
export function otherPlayer(player: Player): Player {
  return player === 0 ? 1 : 0
}

/**
 * The points of a two-player match that are reported to the hall: those of whoever scored more. The
 * hall pays per finished run and shows the last thing that was played; the match belongs to both,
 * and what is shown of it is the best that was done.
 */
export function duelBest(duel: Duel): number {
  return Math.max(duel.points[0] ?? 0, duel.points[1] ?? 0)
}

/** What is said when a round of the two-player match ends. */
export interface DuelSummary {
  /** Who has just played and what they scored, or, with both played, who has won. */
  readonly title: string
  /** The notice to pass the controller, while someone still has their round left; otherwise, `null`. */
  readonly pass: string | null
  /** Whose turn it is, for the start button; `null` with the match finished. */
  readonly next: Player | null
  /** The points of each one who has already played, in player order. */
  readonly lines: readonly { readonly player: Player; readonly text: string }[]
  /** Who has won, or `null` while both have not played or if they have tied. */
  readonly winner: Player | null
  /** The matches the pair has so far, with the current one already counted; only when the match ends. */
  readonly tally: string | null
}

/**
 * The end of a two-player round, said the same on the web, in the headset and in the Godot port:
 * whose it was and who the controller passes to or, with both played, who wins and what the pair has so far.
 *
 * The pair's scoreboard already includes the match that has just finished: it is noted on finishing
 * (`saveDuelResult`), before painting this.
 */
export function duelSummary(duel: Duel, tally: DuelTally, lang: Lang): DuelSummary {
  const t = (key: TextKey, values: Record<string, string | number> = {}) => formatText(texto(lang, key), values)
  const name = (player: Player) => texto(lang, PLAYER_LABELS[player])
  const pointsLine = (player: Player, points: number) =>
    t('{player}: {points} points', { player: name(player), points: formatFigure(points, lang) })
  const lines = ([0, 1] as const).flatMap((player) => {
    const points = duel.points[player]
    return points == null ? [] : [{ player, text: pointsLine(player, points) }]
  })
  const turn = duelTurn(duel)
  if (turn != null) {
    const finished = otherPlayer(turn)
    return {
      title: pointsLine(finished, duel.points[finished] ?? 0),
      pass: t('Pass the controller to {player}.', { player: name(turn) }),
      next: turn,
      lines,
      winner: null,
      tally: null,
    }
  }
  const winner = duelWinner(duel)
  return {
    title: winner == null ? t("It's a tie") : t('{player} wins', { player: name(winner) }),
    pass: null,
    next: null,
    lines,
    winner,
    tally: t('Duels won: {one}–{two} · tied: {ties}', { one: tally.wins[0], two: tally.wins[1], ties: tally.ties }),
  }
}
