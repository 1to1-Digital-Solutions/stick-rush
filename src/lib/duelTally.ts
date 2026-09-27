import type { Player } from './duel'
import { createStoredPreference } from './storage'

/**
 * Cuántas partidas a dos ha ganado cada uno, guardado en el navegador.
 *
 * **Jugar contra alguien es el momento más memorable de una sesión, y una partida que se cierra
 * y se borra no deja nada.** El récord no lo toca a propósito —una tanda a dos no es la marca de
 * nadie (`duel.ts`)—, pero de ahí no se sigue que la partida no cuente: lo que cuenta entre dos es
 * quién gana, y se apunta. Es lo mismo que hacen minigolf y bolos, con el mismo formato.
 *
 * Sin React a propósito: el port de Godot guarda el marcador de la pareja con estas mismas
 * funciones, y el motor no carga nada que importe React. El hook que la web pinta vive en
 * `useDuelTally.ts`.
 *
 * No es un récord y no viaja al salón: el salón enseña la mejor marca de una persona, y esto es
 * de la pareja que esté delante. Tampoco identifica a nadie: son tres números.
 */

/** Las partidas ganadas por cada uno, en orden de jugador, y las empatadas. */
export interface DuelTally {
  readonly wins: readonly [number, number]
  readonly ties: number
}

/** Dónde se recuerda. Con prefijo, como los récords, para no chocar con nada. */
export const DUEL_TALLY_KEY = 'stick-rush:duel-tally'

const EMPTY: DuelTally = { wins: [0, 0], ties: 0 }

/** Un contador entero y no negativo, o cero: es entrada externa. */
function count(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0
}

/** Interpreta lo leído del almacenamiento. */
export function parseDuelTally(raw: string | null): DuelTally {
  if (raw == null) return EMPTY
  try {
    const value = JSON.parse(raw) as { wins?: unknown[]; ties?: unknown }
    const wins = Array.isArray(value?.wins) ? value.wins : []
    return { wins: [count(wins[0]), count(wins[1])], ties: count(value?.ties) }
  } catch {
    // Lo escribió otra versión, o alguien a mano desde las herramientas del navegador.
    return EMPTY
  }
}

/**
 * El marcador, guardado como el texto que se escribió.
 *
 * Se guarda **el texto y no el objeto** a propósito: `createStoredPreference` vuelve a leer y
 * a interpretar en cada lectura, y `useSyncExternalStore` compara dos lecturas seguidas con
 * `Object.is`. Un objeto nuevo cada vez dejaría a React repintando sin parar; un texto no.
 */
const guardado = createStoredPreference<string>({
  key: DUEL_TALLY_KEY,
  parse: (raw) => raw ?? '',
  serialize: (value) => value,
})

/**
 * El marcador tal y como está guardado, para quien se suscribe a él (`useDuelTally.ts`): el texto
 * y no el objeto, por lo que se cuenta arriba.
 */
export const serieGuardada = {
  subscribe: guardado.subscribe,
  get: guardado.get,
  getServer: guardado.getServer,
}

/** Interpreta el texto guardado: vacío es que todavía no hay nada apuntado. */
export function tallyDelTexto(texto: string): DuelTally {
  return parseDuelTally(texto === '' ? null : texto)
}

/** Lo que llevan ahora mismo, sin suscribirse a nada. */
export function getDuelTally(): DuelTally {
  return tallyDelTexto(guardado.get())
}

/**
 * Apunta cómo acabó una partida a dos: quién la ganó, o `null` si fue empate.
 *
 * No devuelve nada: quien lo mire está suscrito (`useDuelTally`) y se entera solo. Devolver
 * el marcador invitaría a guardarlo en estado de React, y entonces habría dos copias de lo
 * mismo que pueden discrepar.
 */
export function saveDuelResult(winner: Player | null): void {
  const antes = getDuelTally()
  const tally: DuelTally =
    winner == null
      ? { wins: antes.wins, ties: antes.ties + 1 }
      : {
          wins:
            winner === 0
              ? [antes.wins[0] + 1, antes.wins[1]]
              : [antes.wins[0], antes.wins[1] + 1],
          ties: antes.ties,
        }

  guardado.save(JSON.stringify(tally))
}
