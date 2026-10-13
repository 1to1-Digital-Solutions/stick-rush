/**
 * Qué suena en Stick Rush y cuándo: la regla de `useGameSound.ts` de la web, sin React, sobre los
 * efectos renderizados de su `sound.ts` (`godot-kit.json`).
 *
 * La web compara los contadores de la partida con los del render anterior y dispara lo que ha
 * pasado: **atrapar** (su nota sube un semitono por palo de racha, hasta siete: `catchFrequency`),
 * **perder**, cada **segundo de la cuenta atrás** (3, 2 y 1, cada uno en su nota), la **salida** al
 * acabar la cuenta, el **listón de medalla** que se cruza (dos notas cortas, más agudas cuanto mejor
 * es la medalla) y el **final** —ganar, perder o terminar sin más (`roundOutcome`)— con el
 * **récord** por encima si lo hay. Aquí se compara igual, de un fotograma al siguiente. Como en la
 * web, dos palos resueltos a la vez suenan una sola vez: dos copias del mismo sonido a la vez no se
 * oyen como dos.
 *
 * Los efectos son ficheros, uno por disparo distinto de la web: la nota del atrape va en ocho
 * (`catch-1`…`catch-8`, de la racha 1 a la 8 y más), la cuenta atrás en tres y el listón en tres.
 */
import { thresholdCrossed, type Medal } from '@/lib/goal'

import type { FaseDeLaPartida } from './partida'

/** Todos los ficheros de efectos, los de `godot-kit.json`. */
export const SOUNDS = [
  'catch-1',
  'catch-2',
  'catch-3',
  'catch-4',
  'catch-5',
  'catch-6',
  'catch-7',
  'catch-8',
  'miss',
  'countdown-3',
  'countdown-2',
  'countdown-1',
  'go',
  'over-win',
  'over-loss',
  'over-close',
  'record',
  'medal-bronze',
  'medal-silver',
  'medal-gold',
] as const

/** Cómo se llama el efecto de cada listón de medalla (`{ name: 'medal', rank }` de `sound.ts`). */
export const SONIDO_DEL_LISTON = { bronze: 'medal-bronze', silver: 'medal-silver', gold: 'medal-gold' } as const satisfies Record<Medal, string>

export type Sonido = (typeof SOUNDS)[number]

/** A partir de esta racha la nota del atrape ya no sube (`CATCH_MAX_SEMITONES` + 1). */
export const RACHA_MAS_AGUDA = 8

/** Lo que se compara de un fotograma al siguiente. */
export interface Pistas {
  score: number
  missed: number
  countdown: number
  gameState: FaseDeLaPartida
  streak: number
  /**
   * Si el final suena a ganar encima del cierre: el récord batido, o el final de una partida a dos
   * (`celebra` de la partida).
   */
  isRecord: boolean
  /** Si lo que acaba es la segunda tanda de una partida a dos: el cierre suena a ganar. */
  acabaElDuelo?: boolean
  /** Si el nivel acabado se superó, o `null` fuera de los niveles. */
  levelPassed: boolean | null
  lives: number | null
  /** La medalla que ya es de quien juega (`medalla` de la partida): cuando sube, suena su listón. */
  medalla?: Medal | null
}

/** Cómo suena el final (`roundOutcome` de `useGameSound.ts`). */
export function finalQueSuena(levelPassed: boolean | null, lives: number | null): 'win' | 'loss' | 'close' {
  if (levelPassed != null) return levelPassed ? 'win' : 'loss'
  if (lives != null) return lives > 0 ? 'win' : 'loss'
  return 'close'
}

/** Lo que tiene que sonar al pasar de `antes` a `ahora`, en orden. */
export function sonidosDesde(antes: Pistas, ahora: Pistas): Sonido[] {
  const suenan: Sonido[] = []
  if (ahora.score > antes.score) suenan.push(`catch-${Math.min(Math.max(1, Math.round(ahora.streak)), RACHA_MAS_AGUDA)}` as Sonido)
  if (ahora.missed > antes.missed) suenan.push('miss')
  if (ahora.gameState === 'countdown' && ahora.countdown > 0 && ahora.countdown !== antes.countdown) {
    suenan.push(`countdown-${Math.min(3, Math.max(1, ahora.countdown))}` as Sonido)
  }
  if (ahora.gameState === 'playing' && antes.gameState === 'countdown') suenan.push('go')
  // El listón de medalla que se acaba de cruzar, además del atrape que lo cruzó.
  const cruzado = thresholdCrossed(antes.medalla ?? null, ahora.medalla ?? null)
  if (cruzado != null) suenan.push(SONIDO_DEL_LISTON[cruzado])
  if (ahora.gameState === 'finished' && antes.gameState !== 'finished') {
    // El final de una partida a dos suena a ganar: la gana alguien de los que están delante, o
    // empatan, aunque el segundo se haya quedado sin vidas.
    suenan.push(`over-${ahora.acabaElDuelo === true ? 'win' : finalQueSuena(ahora.levelPassed, ahora.lives)}` as Sonido)
    // El récord va por encima del cierre y no en su lugar.
    if (ahora.isRecord) suenan.push('record')
  }
  return suenan
}
