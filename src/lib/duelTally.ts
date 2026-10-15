import type { Player } from './duel'
import { createStoredPreference } from './storage'

/**
 * How many two-player matches each one has won, stored in the browser.
 *
 * **Playing against someone is the most memorable moment of a session, and a match that closes
 * and is erased leaves nothing.** It does not touch the record on purpose —a two-player round is
 * nobody's best (`duel.ts`)—, but it does not follow that the match does not count: what counts
 * between two is who wins, and it is noted. It is the same thing minigolf and bowling do, with the
 * same format.
 *
 * No React on purpose: the Godot port saves the pair's scoreboard with these same
 * functions, and the engine loads nothing that imports React. The hook the web paints lives in
 * `useDuelTally.ts`.
 *
 * It is not a record and does not travel to the hall: the hall shows one person's best, and this
 * belongs to the pair in front of it. It does not identify anyone either: it is three numbers.
 */

/** The matches won by each one, in player order, and the tied ones. */
export interface DuelTally {
  readonly wins: readonly [number, number]
  readonly ties: number
}

/** Where it is remembered. Prefixed, like the records, so as not to clash with anything. */
export const DUEL_TALLY_KEY = 'stick-rush:duel-tally'

const EMPTY: DuelTally = { wins: [0, 0], ties: 0 }

/** A non-negative integer counter, or zero: it is external input. */
function count(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0
}

/** Interprets what was read from storage. */
export function parseDuelTally(raw: string | null): DuelTally {
  if (raw == null) return EMPTY
  try {
    const value = JSON.parse(raw) as { wins?: unknown[]; ties?: unknown }
    const wins = Array.isArray(value?.wins) ? value.wins : []
    return { wins: [count(wins[0]), count(wins[1])], ties: count(value?.ties) }
  } catch {
    // Another version wrote it, or someone by hand from the browser's tools.
    return EMPTY
  }
}

/**
 * The scoreboard, stored as the text that was written.
 *
 * **The text and not the object** is stored on purpose: `createStoredPreference` reads and
 * interprets again on every read, and `useSyncExternalStore` compares two consecutive reads with
 * `Object.is`. A new object every time would leave React repainting non-stop; a text would not.
 */
const stored = createStoredPreference<string>({
  key: DUEL_TALLY_KEY,
  parse: (raw) => raw ?? '',
  serialize: (value) => value,
})

/**
 * The scoreboard just as it is stored, for whoever subscribes to it (`useDuelTally.ts`): the text
 * and not the object, for what is explained above.
 */
export const storedTally = {
  subscribe: stored.subscribe,
  get: stored.get,
  getServer: stored.getServer,
}

/** Interprets the stored text: empty means nothing has been noted yet. */
export function tallyFromText(text: string): DuelTally {
  return parseDuelTally(text === '' ? null : text)
}

/** What they have right now, without subscribing to anything. */
export function getDuelTally(): DuelTally {
  return tallyFromText(stored.get())
}

/**
 * Notes how a two-player match ended: who won it, or `null` if it was a tie.
 *
 * It returns nothing: whoever watches it is subscribed (`useDuelTally`) and finds out on its own.
 * Returning the scoreboard would invite storing it in React state, and then there would be two
 * copies of the same thing that can disagree.
 */
export function saveDuelResult(winner: Player | null): void {
  const before = getDuelTally()
  const tally: DuelTally =
    winner == null
      ? { wins: before.wins, ties: before.ties + 1 }
      : {
          wins:
            winner === 0
              ? [before.wins[0] + 1, before.wins[1]]
              : [before.wins[0], before.wins[1] + 1],
          ties: before.ties,
        }

  stored.save(JSON.stringify(tally))
}
