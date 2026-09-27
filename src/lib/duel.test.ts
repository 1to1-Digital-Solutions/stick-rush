import { describe, expect, it } from 'vitest'

import { CHALLENGE_SETUP, GAME_MODE_ORDER } from './gameMode'
import { semillaDe } from './semilla'
import { buildStickLayout, fallOrder } from './stickLayout'
import {
  MODO_DEL_DUELO,
  PLAYER_COUNTS,
  PLAYER_COUNT_HINTS,
  PLAYER_COUNT_LABELS,
  PLAYER_LABELS,
  controllerHolder,
  createDuel,
  duelOver,
  duelTurn,
  duelSummary,
  duelWinner,
  eligeJugadores,
  juegaADos,
  mejorDelDuelo,
  otherPlayer,
  recordTurn,
} from './duel'

/**
 * La partida a dos: una tanda del desafío cada uno, con los mismos palos, y gana quien más puntos
 * saque.
 *
 * Lo que se prueba es lo que la hace justa —que los dos jueguen la misma tanda— y lo que la
 * cierra: de quién es el turno, quién gana y qué pasa cuando empatan.
 */

describe('a quién le toca', () => {
  it('empieza el primero, sigue el segundo y con los dos jugados no le toca a nadie', () => {
    const duel = createDuel(7)
    expect(duelTurn(duel)).toBe(0)
    expect(controllerHolder(duel)).toBe(0)

    const tras = recordTurn(duel, 1200)
    expect(duelTurn(tras)).toBe(1)
    expect(controllerHolder(tras)).toBe(1)
    expect(duelOver(tras)).toBe(false)

    const hecho = recordTurn(tras, 900)
    expect(duelTurn(hecho)).toBeNull()
    expect(duelOver(hecho)).toBe(true)
    // Acabada, el mando sigue siendo de quien la cerró: el marcador enseña su tanda.
    expect(controllerHolder(hecho)).toBe(1)
  })

  it('una tercera tanda no es de nadie: no cambia lo que ya se ha visto', () => {
    const hecho = recordTurn(recordTurn(createDuel(7), 1200), 900)
    expect(recordTurn(hecho, 5000)).toBe(hecho)
  })

  it('la semilla es la misma para los dos: no se toca al apuntar', () => {
    expect(recordTurn(recordTurn(createDuel(4242), 10), 20).semilla).toBe(4242)
  })

  it('el otro es el otro', () => {
    expect(otherPlayer(0)).toBe(1)
    expect(otherPlayer(1)).toBe(0)
  })
})

describe('quién gana', () => {
  it('quien más puntos saca', () => {
    expect(duelWinner(recordTurn(recordTurn(createDuel(1), 1200), 900))).toBe(0)
    expect(duelWinner(recordTurn(recordTurn(createDuel(1), 900), 1200))).toBe(1)
  })

  it('con los mismos puntos es empate: no se desempata por otra cifra', () => {
    expect(duelWinner(recordTurn(recordTurn(createDuel(1), 1000), 1000))).toBeNull()
    expect(duelWinner(recordTurn(recordTurn(createDuel(1), 0), 0))).toBeNull()
  })

  it('sin las dos tandas jugadas no gana nadie todavía', () => {
    expect(duelWinner(createDuel(1))).toBeNull()
    expect(duelWinner(recordTurn(createDuel(1), 3000))).toBeNull()
  })

  it('al salón se le cuenta lo mejor que se hizo en la partida', () => {
    expect(mejorDelDuelo(recordTurn(recordTurn(createDuel(1), 1200), 900))).toBe(1200)
    expect(mejorDelDuelo(recordTurn(createDuel(1), 40))).toBe(40)
    expect(mejorDelDuelo(createDuel(1))).toBe(0)
  })
})

describe('la misma semilla, la misma tanda', () => {
  it('los dos ven caer los mismos palos, en el mismo orden y en el mismo sitio', () => {
    // La tanda del desafío es la tanda 0 de la partida: su reparto sale de la semilla y su número.
    const duel = createDuel(98765)
    const primero = semillaDe(duel.semilla, 0)
    const segundo = semillaDe(recordTurn(duel, 1500).semilla, 0)
    expect(segundo).toBe(primero)
    expect(fallOrder(CHALLENGE_SETUP.stickCount, segundo)).toEqual(fallOrder(CHALLENGE_SETUP.stickCount, primero))
    expect(buildStickLayout(CHALLENGE_SETUP.stickCount, segundo, 2)).toEqual(buildStickLayout(CHALLENGE_SETUP.stickCount, primero, 2))
  })

  it('y otra partida es otra tanda: la siguiente no se repite', () => {
    const una = fallOrder(CHALLENGE_SETUP.stickCount, semillaDe(createDuel(1).semilla, 0))
    const otra = fallOrder(CHALLENGE_SETUP.stickCount, semillaDe(createDuel(2).semilla, 0))
    expect(otra).not.toEqual(una)
  })
})

describe('dónde se juega a dos', () => {
  it('solo en el desafío: es la misma partida para todos', () => {
    expect(GAME_MODE_ORDER.filter(eligeJugadores)).toEqual(['challenge'])
    expect(MODO_DEL_DUELO).toBe('challenge')
    expect(juegaADos('challenge', 2)).toBe(true)
    expect(juegaADos('challenge', 1)).toBe(false)
    // Fuera del desafío lo elegido no cuenta.
    expect(juegaADos('practice', 2)).toBe(false)
    expect(juegaADos('levels', 2)).toBe(false)
  })

  it('cada opción tiene su nombre y su explicación, y cada jugador el suyo', () => {
    for (const count of PLAYER_COUNTS) {
      expect(PLAYER_COUNT_LABELS[count].length).toBeGreaterThan(0)
      expect(PLAYER_COUNT_HINTS[count].length).toBeGreaterThan(0)
    }
    expect(PLAYER_LABELS).toEqual(['Player 1', 'Player 2'])
  })
})

describe('lo que se dice al acabar una tanda a dos', () => {
  const PAREJA = { wins: [3, 2] as const, ties: 1 }

  it('al acabar el primero: lo que ha sacado y el aviso de pasarle el mando al segundo', () => {
    const dicho = duelSummary(recordTurn(createDuel(1), 1500), PAREJA, 'en')
    expect(dicho.title).toBe('Player 1: 1,500 points')
    expect(dicho.pass).toBe('Pass the controller to Player 2.')
    expect(dicho.next).toBe(1)
    expect(dicho.winner).toBeNull()
    expect(dicho.tally).toBeNull()
    expect(dicho.lines).toEqual([{ player: 0, text: 'Player 1: 1,500 points' }])
  })

  it('al acabar los dos: quién gana, los puntos de los dos y lo que lleva la pareja', () => {
    const dicho = duelSummary(recordTurn(recordTurn(createDuel(1), 1500), 1700), PAREJA, 'es')
    expect(dicho.title).toBe('Gana Jugador 2')
    expect(dicho.pass).toBeNull()
    expect(dicho.next).toBeNull()
    expect(dicho.winner).toBe(1)
    expect(dicho.lines.map((l) => l.text)).toEqual(['Jugador 1: 1.500 puntos', 'Jugador 2: 1.700 puntos'])
    expect(dicho.tally).toBe('Ganadas: 3–2 · empates: 1')
  })

  it('con los mismos puntos, empate', () => {
    const dicho = duelSummary(recordTurn(recordTurn(createDuel(1), 900), 900), PAREJA, 'en')
    expect(dicho.title).toBe("It's a tie")
    expect(dicho.winner).toBeNull()
  })

  it('sin nadie jugado todavía, el aviso es para el primero', () => {
    const dicho = duelSummary(createDuel(1), PAREJA, 'en')
    expect(dicho.pass).toBe('Pass the controller to Player 1.')
    expect(dicho.lines).toEqual([])
  })
})
