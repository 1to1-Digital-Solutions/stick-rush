/**
 * La partida de Stick Rush en Godot contra las reglas del `gameStore` de la web: las fases y la
 * cuenta atrás, los puntos y la racha, las vidas del desafío, los niveles con sus estrellas, la
 * partida sin fin por tandas, el récord, la altura del aro, la lección que se aprende atrapando y el
 * contrato del reto con el salón (entrar jugando con su semilla y contar cada partida una sola vez),
 * con las hazañas estrenadas en el resultado, que es lo que va en el JSON de `report_result`.
 *
 * Corre dentro del motor, con los tests de dominio: guarda en el guardado del kit.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { MAX_STICKS, MIN_STICKS } from '@/lib/gameConfig'
import { CHALLENGE_LIVES, CHALLENGE_SETUP } from '@/lib/gameMode'
import { HOOP_ADJUST_RANGE, HOOP_ADJUST_STEP, HOOP_RISE_ABOVE_EYES, getHoopAdjustment } from '@/lib/hoopHeight'
import { LEVEL_STICK_STEPS, levelSpec } from '@/lib/levels'
import { getBestEndlessStreak, getBestPoints } from '@/lib/marcas'
import { getUnlockedLevel } from '@/lib/progress'
import { stickPoints } from '@/lib/scoring'
import { semillaDe, type Resultado } from '@/lib/semilla'
import { gameStorage } from '@/lib/storage'
import { getDuelTally } from '@/lib/duelTally'
import { HAZANAS, HAZANAS_KEY, leerHazanas, type ResultadoConHazanas } from '@/lib/hazanas'
import { PLAZO_DEL_PASO, tutorialSeen } from '@/lib/tutorial'

import { COUNTDOWN_SECONDS, MODO_DEL_RETO, Partida, acotarPalos } from './partida'

/** Una partida con la cuenta atrás ya pasada. */
function jugando(p: Partida, opciones?: { tutorial?: boolean }): Partida {
  p.startGame(opciones)
  p.tick(COUNTDOWN_SECONDS)
  return p
}

/** Resuelve `n` palos: atrapados recién soltados, o perdidos. */
function resolver(p: Partida, n: number, atrapado = true): void {
  for (let i = 0; i < n; i++) {
    if (atrapado) p.catchStick(0)
    else p.missStick()
  }
}

describe('la partida de la web, sin React', () => {
  beforeEach(() => gameStorage()?.clear())

  it('empieza en el menú, en práctica, a Fácil y con cinco palos', () => {
    const p = new Partida()
    expect([p.gameState, p.gameMode, p.difficulty, p.stickCount, p.endless, p.lives]).toEqual(['menu', 'practice', 'easy', MIN_STICKS, false, null])
  })

  it('los palos se quedan entre cinco y trece', () => {
    expect([acotarPalos(2), acotarPalos(20), acotarPalos(7.4), acotarPalos(Number.NaN)]).toEqual([MIN_STICKS, MAX_STICKS, 7, MIN_STICKS])
  })

  it('jugar cuenta atrás tres segundos, con una semilla nueva; la pregunta de salir la para y para los palos', () => {
    let semilla = 100
    const p = new Partida({ semillas: () => ++semilla })
    p.startGame()
    expect([p.gameState, p.countdown, p.semilla, p.runId, p.paused]).toEqual(['countdown', 3, 101, 1, true])
    p.tick(1.2)
    expect(p.countdown).toBe(2)
    p.askToQuit()
    p.tick(5)
    expect(p.countdown).toBe(2)
    p.keepPlaying()
    p.tick(2)
    expect([p.gameState, p.paused]).toEqual(['playing', false])
    p.askToQuit()
    expect(p.paused).toBe(true)
    p.resetGame()
    expect(p.gameState).toBe('menu')
    p.startGame()
    expect([p.semilla, p.runId]).toEqual([102, 2])
  })

  it('cada palo atrapado puntúa con la dificultad, la racha y los reflejos de la web', () => {
    const p = new Partida()
    p.setDifficulty('hard')
    jugando(p)
    p.catchStick(0.2)
    p.catchStick(0.9)
    p.missStick()
    p.catchStick(0)
    const esperado =
      stickPoints({ difficulty: 'hard', streak: 1, fallProgress: 0.2 }) +
      stickPoints({ difficulty: 'hard', streak: 2, fallProgress: 0.9 }) +
      stickPoints({ difficulty: 'hard', streak: 1, fallProgress: 0 })
    expect([p.score, p.resolved, p.misses, p.streak, p.bestStreak, p.points]).toEqual([3, 4, 1, 1, 2, esperado])
  })

  it('la práctica acaba con el último palo, se guarda el récord y se le cuenta al salón una vez', () => {
    const contados: Resultado[] = []
    const p = new Partida({ alTerminar: (r) => contados.push(r) })
    jugando(p)
    resolver(p, 4)
    expect(p.gameState).toBe('playing')
    resolver(p, 1, false)
    expect([p.gameState, p.outcome, p.isRecord]).toEqual(['finished', 'cleared', true])
    expect(getBestPoints('practice')).toBe(p.points)
    p.tick(1)
    p.tick(1)
    expect(contados).toEqual([{ modo: 'practice', puntos: p.points, reto: false }])
    // Otra igual no bate la marca: la iguala.
    const otra = new Partida()
    jugando(otra)
    resolver(otra, 4)
    resolver(otra, 1, false)
    expect(otra.isRecord).toBe(false)
  })

  it('el desafío va fijo, con tres vidas: la tercera que se escapa lo acaba', () => {
    const p = new Partida()
    p.setGameMode('challenge')
    p.setDifficulty('impossible')
    p.setStickCount(5)
    jugando(p)
    expect([p.activeDifficulty, p.activeStickCount, p.lives]).toEqual([CHALLENGE_SETUP.difficulty, CHALLENGE_SETUP.stickCount, CHALLENGE_LIVES])
    resolver(p, 2, false)
    expect([p.lives, p.gameState]).toEqual([1, 'playing'])
    resolver(p, 1, false)
    expect([p.lives, p.gameState, p.outcome]).toEqual([0, 'finished', 'failed'])
  })

  it('el modo solo cambia entre partidas', () => {
    const p = new Partida()
    jugando(p)
    p.setGameMode('challenge')
    expect(p.gameMode).toBe('practice')
    p.resetGame()
    p.setGameMode('levels')
    expect(p.gameMode).toBe('levels')
  })

  it('los niveles juegan lo del nivel, dan estrellas y abren el siguiente', () => {
    const p = new Partida()
    p.setGameMode('levels')
    expect(p.activeLevel).toBe(getUnlockedLevel())
    jugando(p)
    const nivel = levelSpec(1)
    expect([p.activeDifficulty, p.activeStickCount]).toEqual([nivel.difficulty, LEVEL_STICK_STEPS[0]])
    resolver(p, nivel.stickCount)
    expect(p.levelResult).toEqual({ stars: 3, passed: true, unlocked: 2 })
    expect(p.isRecord).toBe(false)
    p.tick(0.1)
    expect(getUnlockedLevel()).toBe(2)
    // Durante el resumen el nivel sigue siendo el jugado, aunque ya esté abierto el siguiente.
    expect(p.activeLevel).toBe(1)
    // Sin elegir, el más alto abierto; lo elegido se recorta a lo abierto.
    p.resetGame()
    expect(p.activeLevel).toBe(2)
    expect(p.levelStars[0]).toBe(3)
    p.setLevel(9)
    expect(p.activeLevel).toBe(2)
    p.setLevel(1)
    expect(p.activeLevel).toBe(1)
  })

  it('sin fin, la máquina se recarga con otra semilla y la cierra quien juega; se guarda la racha', () => {
    const p = new Partida({ semillas: () => 7 })
    p.setEndless(true)
    jugando(p)
    const primera = p.stickSeed
    expect(primera).toBe(semillaDe(7, 0))
    resolver(p, 5)
    expect([p.wave, p.waveScore, p.waveResolved, p.score, p.gameState]).toEqual([1, 0, 0, 5, 'playing'])
    expect(p.stickSeed).toBe(semillaDe(7, 1))
    resolver(p, 3)
    p.endRun()
    expect([p.gameState, p.outcome, p.isRecord]).toEqual(['finished', 'cleared', true])
    expect(getBestEndlessStreak()).toBe(8)
  })

  it('el aro sube y baja por pasos, con topes, y se guarda', () => {
    const p = new Partida()
    for (let i = 0; i < 10; i++) p.adjustHoop(1)
    expect(p.hoopAdjustment).toBeCloseTo(HOOP_ADJUST_RANGE)
    expect(getHoopAdjustment()).toBeCloseTo(HOOP_ADJUST_RANGE)
    p.adjustHoop(-1)
    expect(p.hoopAdjustment).toBeCloseTo(HOOP_ADJUST_RANGE - HOOP_ADJUST_STEP)
    p.setPlayerEyeHeight(1.5)
    expect(p.hoopHeight).toBeCloseTo(1.5 + HOOP_RISE_ABOVE_EYES + HOOP_ADJUST_RANGE - HOOP_ADJUST_STEP)
    expect(new Partida().hoopAdjustment).toBeCloseTo(HOOP_ADJUST_RANGE - HOOP_ADJUST_STEP)
  })

  it('con el visor y sin haberla visto, la partida enseña; se aprende atrapando y se anota vista', () => {
    const p = new Partida()
    p.setImmersive(true)
    jugando(p)
    expect([p.teaching, p.tutorialStep]).toEqual([true, 'grab'])
    p.catchStick(0)
    expect(p.tutorialStep).toBe('around')
    p.catchStick(0)
    p.tick(0.01)
    expect(p.tutorialStep).toBe(null)
    expect(tutorialSeen()).toBe(true)
    // Vista, la siguiente partida ya no enseña.
    p.resetGame()
    jugando(p)
    expect(p.teaching).toBe(false)
  })

  it('cada paso tiene su plazo, que solo corre jugando; siguiente lo pasa y saltar la da por vista', () => {
    const p = new Partida()
    jugando(p, { tutorial: true })
    p.askToQuit()
    p.tick(PLAZO_DEL_PASO.grab + 1)
    expect(p.tutorialStep).toBe('grab')
    p.keepPlaying()
    p.tick(PLAZO_DEL_PASO.grab / 2)
    p.tick(PLAZO_DEL_PASO.grab / 2 + 0.01)
    expect(p.tutorialStep).toBe('around')
    p.nextTutorialStep()
    expect(p.tutorialStep).toBe(null)
    p.resetGame()
    jugando(p, { tutorial: true })
    p.finishTutorial()
    expect([p.teaching, p.tutorialSeen, tutorialSeen()]).toEqual([false, true, true])
  })

  it('el reto del salón entra jugando el desafío con su semilla, y otra partida ya no es el reto', () => {
    const contados: Resultado[] = []
    const p = new Partida({ reto: { semilla: 4242 }, alTerminar: (r) => contados.push(r), semillas: () => 1 })
    expect([p.gameState, p.gameMode, p.enReto, p.semilla, p.countdown]).toEqual(['countdown', MODO_DEL_RETO, true, 4242, 3])
    p.tick(COUNTDOWN_SECONDS)
    resolver(p, CHALLENGE_LIVES, false)
    expect(contados).toEqual([{ modo: 'challenge', puntos: 0, reto: true }])
    p.startGame()
    expect([p.enReto, p.semilla]).toEqual([false, 1])
  })
})

describe('la partida a dos, sin React', () => {
  beforeEach(() => gameStorage()?.clear())

  /** Una partida a dos en el desafío, con las semillas que se pidan una detrás de otra. */
  function aDos(semillas: number[], alTerminar?: (r: Resultado) => void): Partida {
    let i = 0
    const p = new Partida({ semillas: () => semillas[i++ % semillas.length], alTerminar })
    p.setGameMode('challenge')
    p.setPlayers(2)
    return p
  }

  it('solo, o fuera del desafío, no hay partida a dos', () => {
    const p = new Partida()
    p.setGameMode('challenge')
    jugando(p)
    expect([p.duel, p.player]).toEqual([null, null])
    const q = new Partida()
    q.setPlayers(2)
    jugando(q)
    expect(q.duel).toBeNull()
  })

  it('los dos juegan la misma semilla, y al acabar el primero el mando es del segundo', () => {
    const p = aDos([111, 222, 333])
    jugando(p)
    expect([p.player, p.semilla, p.stickSeed]).toEqual([0, 111, semillaDe(111, 0)])
    resolver(p, 5)
    resolver(p, CHALLENGE_LIVES, false)
    expect(p.gameState).toBe('finished')
    expect(p.duel?.points).toEqual([p.points, null])
    expect([p.player, p.celebra, p.isRecord]).toEqual([1, false, false])
    jugando(p)
    expect([p.player, p.semilla]).toEqual([1, 111])
  })

  it('gana quien más saca, se apunta a la pareja, se celebra, al salón una vez y sin récord', () => {
    const contados: Resultado[] = []
    const p = aDos([111, 222], (r) => contados.push(r))
    jugando(p)
    resolver(p, 5)
    resolver(p, CHALLENGE_LIVES, false)
    const primero = p.points
    jugando(p)
    resolver(p, 1)
    resolver(p, CHALLENGE_LIVES, false)
    p.tick(1)
    expect(p.duel?.points).toEqual([primero, p.points])
    expect([p.celebra, p.isRecord, getBestPoints('challenge')]).toEqual([true, false, 0])
    expect(getDuelTally()).toEqual({ wins: [1, 0], ties: 0 })
    expect(contados).toEqual([{ modo: 'duel', puntos: primero, reto: false }])
    // Otra vez: una partida nueva, con otra semilla.
    jugando(p)
    expect([p.player, p.semilla, p.duel?.points]).toEqual([0, 222, [null, null]])
  })

  it('con los mismos puntos es empate; volver al menú deja la partida', () => {
    const p = aDos([7])
    jugando(p)
    resolver(p, CHALLENGE_LIVES, false)
    jugando(p)
    resolver(p, CHALLENGE_LIVES, false)
    expect(getDuelTally()).toEqual({ wins: [0, 0], ties: 1 })
    p.resetGame()
    expect(p.duel).toBeNull()
  })
})

describe('las hazañas, como en la web', () => {
  beforeEach(() => gameStorage()?.clear())

  /** Lo que la escena le pasa al salón: el resultado tal cual, en JSON (`contarAlSalon`). */
  function alSalon(): { json: string[]; partida: (opciones?: ConstructorParameters<typeof Partida>[0]) => Partida } {
    const json: string[] = []
    return {
      json,
      partida: (opciones = {}) => new Partida({ ...opciones, alTerminar: (r: ResultadoConHazanas) => json.push(JSON.stringify(r)) }),
    }
  }

  it('los trece sin escaparse ninguno: SR_CLEAN_SWEEP en el JSON, guardada y solo la primera vez', () => {
    const { json, partida } = alSalon()
    const p = partida()
    p.setStickCount(MAX_STICKS)
    jugando(p)
    resolver(p, MAX_STICKS)
    expect(JSON.parse(json[0])).toEqual({ modo: 'practice', puntos: p.points, reto: false, hazanas: [HAZANAS.tandaLimpia] })
    expect(leerHazanas()).toEqual([HAZANAS.tandaLimpia])
    expect(gameStorage()?.getItem(HAZANAS_KEY)).not.toBeNull()
    jugando(p)
    resolver(p, MAX_STICKS)
    expect(JSON.parse(json[1])).not.toHaveProperty('hazanas')
  })

  it('doce de trece no: el JSON es el de siempre', () => {
    const { json, partida } = alSalon()
    const p = partida()
    p.setStickCount(MAX_STICKS)
    jugando(p)
    resolver(p, MAX_STICKS - 1)
    resolver(p, 1, false)
    expect(JSON.parse(json[0])).toEqual({ modo: 'practice', puntos: p.points, reto: false })
  })

  it('con el aro al mínimo, una tanda limpia: SR_LOW_HOOP; un paso por encima, no', () => {
    const { json, partida } = alSalon()
    const p = partida()
    p.adjustHoop(-100)
    p.adjustHoop(1)
    jugando(p)
    resolver(p, MIN_STICKS)
    expect(JSON.parse(json[0])).not.toHaveProperty('hazanas')
    p.adjustHoop(-1)
    expect(p.hoopAdjustment).toBe(-HOOP_ADJUST_RANGE)
    jugando(p)
    resolver(p, MIN_STICKS)
    expect(JSON.parse(json[1]).hazanas).toEqual([HAZANAS.aroAlMinimo])
  })

  it('un palo de espaldas: SR_BEHIND_BACK; dejar la partida a medias la pierde', () => {
    const { json, partida } = alSalon()
    const p = partida()
    jugando(p)
    p.catchStick(0.5, true)
    p.resetGame()
    jugando(p)
    resolver(p, MIN_STICKS, false)
    expect(JSON.parse(json[0])).not.toHaveProperty('hazanas')
    jugando(p)
    p.catchStick(0.5, true)
    resolver(p, MIN_STICKS - 1, false)
    expect(JSON.parse(json[1]).hazanas).toEqual([HAZANAS.deEspaldas])
  })

  it('sin fin, la tanda limpia cuenta al recargar y se da al terminar; la que se escapa, no', () => {
    const { json, partida } = alSalon()
    const p = partida()
    p.setEndless(true)
    p.setStickCount(MAX_STICKS)
    jugando(p)
    resolver(p, 1, false)
    resolver(p, MAX_STICKS - 1)
    expect(p.wave).toBe(1)
    resolver(p, MAX_STICKS)
    expect(p.wave).toBe(2)
    resolver(p, 1)
    p.endRun()
    expect(JSON.parse(json[0]).hazanas).toEqual([HAZANAS.tandaLimpia])
  })

  it('en el desafío, sin perder una vida; y a dos, lo del primer turno se cuenta al acabar el segundo', () => {
    const { json, partida } = alSalon()
    const p = partida()
    p.setGameMode('challenge')
    p.setPlayers(2)
    jugando(p)
    resolver(p, CHALLENGE_SETUP.stickCount)
    expect(json).toEqual([])
    jugando(p)
    resolver(p, CHALLENGE_LIVES, false)
    expect(JSON.parse(json[0])).toMatchObject({ modo: 'duel', hazanas: [HAZANAS.tandaLimpia] })
  })
})
