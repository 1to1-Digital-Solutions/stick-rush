/**
 * La partida de Stick Rush en Godot contra las reglas del `gameStore` de la web: las fases y la
 * cuenta atrás, los puntos y la racha, las vidas del desafío, los niveles con sus estrellas, la
 * partida sin fin por tandas, el récord, la altura del aro, la lección que se aprende atrapando y el
 * contrato del reto con el salón (entrar jugando con su semilla y contar cada partida una sola vez).
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
