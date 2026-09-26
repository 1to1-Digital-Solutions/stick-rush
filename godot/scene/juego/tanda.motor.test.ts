/**
 * Los palos de una tanda en Godot contra lo que hace cada `Stick.tsx` de la web: el reparto de
 * `buildStickLayout`, el turno de caída, la caída acelerada que dura lo que la dificultad dice, la
 * ventana para cogerlos (colgando o cayendo, nunca con la partida parada ni ya resueltos), el
 * destello del acierto, el tinte del fallo, el vaivén que solo es de los que cuelgan, y que cambiar
 * el aro o el número de palos en el menú no remonta los que ya había. Y las cuentas de qué palo toca
 * la mano o el ratón, y la regla de qué suena de `useGameSound.ts`.
 *
 * Corre dentro del motor, con los tests de dominio.
 */
import { describe, expect, it } from 'vitest'

import {
  DIFFICULTY_SPEEDS,
  MACHINE_HEIGHT,
  STICK_CORD_LENGTH,
  STICK_LENGTH,
  STICK_MISS_Y,
  STICK_RADIUS,
  fallDurationSeconds,
} from '@/lib/gameConfig'
import { hoopFallSpeed } from '@/lib/hoopHeight'
import { buildStickLayout, fallOrder } from '@/lib/stickLayout'

import { RADIO_DEL_AGARRE, distanciaAlSegmento, paloEnElRayo, paloEnLaMano, rayoContraSegmento } from './alcance'
import { SOUNDS, finalQueSuena, sonidosDesde, type Pistas } from './sonido'
import { CATCH_FLASH_DECAY, PASO_MAXIMO, Tanda, claveDeLaTanda, cuerpoDelPalo } from './tanda'

const PASO = 1 / 72

/** Avanza la tanda `segundos` a 72 fotogramas por segundo; devuelve los perdidos, en orden. */
function correr(tanda: Tanda, segundos: number, velocidad: number, parada = false): number[] {
  const perdidos: number[] = []
  for (let t = 0; t < segundos; t += PASO) perdidos.push(...tanda.avanzar(PASO, { parada, velocidad }).perdidos)
  return perdidos
}

describe('los palos de la tanda, como los de la web', () => {
  it('cuelgan donde los pone `buildStickLayout`, con su turno y su vaivén', () => {
    const tanda = new Tanda('a', 99, 9, MACHINE_HEIGHT)
    const web = buildStickLayout(9, 99, MACHINE_HEIGHT)
    expect(tanda.palos.map((p) => p.layout)).toEqual(web)
    expect(tanda.palos.every((p) => p.estado === 'hanging' && p.y === MACHINE_HEIGHT)).toBe(true)
  })

  it('parados no se sueltan, pero se mecen; y derechos del todo sin vaivén', () => {
    const tanda = new Tanda('a', 3, 5, MACHINE_HEIGHT)
    correr(tanda, 20, 1, true)
    expect(tanda.palos.every((p) => p.estado === 'hanging')).toBe(true)
    expect(tanda.palos.some((p) => Math.abs(p.inclinacion.z) > 0.01)).toBe(true)
    const quietos = new Tanda('b', 3, 5, MACHINE_HEIGHT, false)
    correr(quietos, 2, 1, true)
    expect(quietos.palos.every((p) => p.inclinacion.x === 0 && p.inclinacion.z === 0)).toBe(true)
  })

  it('caen por turnos (`fallOrder`) y cada uno tarda lo que dice su dificultad', () => {
    const velocidad = DIFFICULTY_SPEEDS.hard
    const tanda = new Tanda('a', 11, 7, MACHINE_HEIGHT)
    const perdidos = correr(tanda, 30, velocidad)
    expect(perdidos).toEqual(fallOrder(7, 11))
    expect(tanda.palos.every((p) => p.estado === 'missed' && p.y === STICK_MISS_Y)).toBe(true)
    // El primero, sin retardo: toca el suelo cuando se le acaba su tiempo de caída.
    const uno = new Tanda('b', 11, 7, MACHINE_HEIGHT)
    const primero = fallOrder(7, 11)[0]
    const duracion = fallDurationSeconds('hard')
    correr(uno, duracion - 0.05, velocidad)
    expect(uno.palos[primero].estado).toBe('falling')
    correr(uno, 0.1, velocidad)
    expect(uno.palos[primero].estado).toBe('missed')
  })

  it('con el aro más alto la caída se escala: tarda lo mismo', () => {
    const alto = 2.3
    const velocidad = hoopFallSpeed(DIFFICULTY_SPEEDS.medium, alto)
    const tanda = new Tanda('a', 5, 5, alto)
    const primero = fallOrder(5, 5)[0]
    correr(tanda, fallDurationSeconds('medium') - 0.05, velocidad)
    expect(tanda.palos[primero].estado).toBe('falling')
    correr(tanda, 0.1, velocidad)
    expect(tanda.palos[primero].estado).toBe('missed')
  })

  it('se cogen colgando o cayendo, no parados ni resueltos; cogerlo pronto da más reflejos', () => {
    const velocidad = DIFFICULTY_SPEEDS.easy
    const colgando = new Tanda('a', 21, 5, MACHINE_HEIGHT)
    expect(colgando.atrapar(0, true)).toBe(null)
    expect(colgando.atrapar(0, false)).toBe(0)
    expect(colgando.atrapar(0, false)).toBe(null)
    const cayendo = new Tanda('b', 21, 5, MACHINE_HEIGHT)
    const primero = fallOrder(5, 21)[0]
    correr(cayendo, fallDurationSeconds('easy') * 0.6, velocidad)
    // A tres quintos de su tiempo de caída, que es lo que mide el bonus (no el recorrido).
    const progreso = cayendo.atrapar(primero, false)!
    expect(progreso).toBeGreaterThan(0.55)
    expect(progreso).toBeLessThan(0.65)
  })

  it('el atrapado se enciende y se va con el destello; el perdido se tiñe de rojo del todo', () => {
    const tanda = new Tanda('a', 1, 5, MACHINE_HEIGHT)
    tanda.atrapar(2, false)
    const palo = tanda.palos[2]
    expect([palo.estado, palo.flash, palo.visible]).toEqual(['caught', 1, true])
    correr(tanda, 1 / CATCH_FLASH_DECAY + 0.05, 1, true)
    expect([palo.flash, palo.visible]).toEqual([0, false])
    const otra = new Tanda('b', 1, 5, MACHINE_HEIGHT)
    correr(otra, 30, DIFFICULTY_SPEEDS.impossible)
    expect(otra.palos.every((p) => p.missTint === 1)).toBe(true)
  })

  it('un salto de fotograma no suelta media tanda: el paso se acota', () => {
    const tanda = new Tanda('a', 1, 13, MACHINE_HEIGHT)
    tanda.avanzar(10, { parada: false, velocidad: 1 })
    expect(tanda.palos.every((p) => p.elapsed === PASO_MAXIMO)).toBe(true)
  })

  it('cambiar el aro o los palos en el menú no remonta los que había; el perdido sigue en el suelo', () => {
    const tanda = new Tanda('a', 8, 5, MACHINE_HEIGHT)
    correr(tanda, 30, DIFFICULTY_SPEEDS.impossible)
    tanda.atrapar(0, false)
    tanda.colocar(7, 2.2)
    expect(tanda.palos.length).toBe(7)
    expect(tanda.palos[0].estado).toBe('missed')
    expect(tanda.palos[0].y).toBe(STICK_MISS_Y)
    expect([tanda.palos[5].estado, tanda.palos[5].y]).toEqual(['hanging', 2.2])
    expect(tanda.palos.map((p) => p.layout)).toEqual(buildStickLayout(7, 8, 2.2))
    expect(claveDeLaTanda(3, 8)).not.toBe(claveDeLaTanda(4, 8))
  })

  it('el cuerpo del palo cuelga un hilo por debajo del anclaje y se inclina con el vaivén', () => {
    const tanda = new Tanda('a', 1, 5, MACHINE_HEIGHT, false)
    const palo = tanda.palos[2]
    const [x, y, z] = palo.layout.anchor
    const recto = cuerpoDelPalo(palo)
    const esperado = { arriba: [x, y - STICK_CORD_LENGTH, z], abajo: [x, y - STICK_CORD_LENGTH - STICK_LENGTH, z] }
    for (const punta of ['arriba', 'abajo'] as const) recto[punta].forEach((v, i) => expect(v).toBeCloseTo(esperado[punta][i]))
    palo.inclinacion = { x: 0, z: Math.PI / 2 }
    const { abajo } = cuerpoDelPalo(palo)
    expect(abajo[0]).toBeCloseTo(x + STICK_CORD_LENGTH + STICK_LENGTH)
    expect(abajo[1]).toBeCloseTo(y)
  })
})

describe('qué palo toca la mano o el ratón', () => {
  it('la distancia a un segmento y la de un rayo a un segmento', () => {
    expect(distanciaAlSegmento([0, 0.5, 1], [0, 0, 0], [0, 1, 0])).toBeCloseTo(1)
    expect(distanciaAlSegmento([0, 2, 0], [0, 0, 0], [0, 1, 0])).toBeCloseTo(1)
    const r = rayoContraSegmento([0, 0.5, 5], [0, 0, -1], [0.01, 0, 0], [0.01, 1, 0])
    expect(r.distancia).toBeCloseTo(0.01)
    expect(r.lejos).toBeCloseTo(5)
    // Paralelos: desde la punta de arriba.
    expect(rayoContraSegmento([0, 0, 0], [0, 1, 0], [0.3, 0, 0], [0.3, 1, 0]).distancia).toBeCloseTo(0.3)
  })

  it('la mano coge el palo que queda en su esfera de agarre, el más cercano', () => {
    const tanda = new Tanda('a', 1, 5, MACHINE_HEIGHT, false)
    const palo = tanda.palos[2]
    const { arriba, abajo } = cuerpoDelPalo(palo)
    const medio: [number, number, number] = [(arriba[0] + abajo[0]) / 2, (arriba[1] + abajo[1]) / 2, (arriba[2] + abajo[2]) / 2]
    expect(paloEnLaMano(tanda.palos, medio)?.indice).toBe(2)
    const fuera: [number, number, number] = [medio[0], medio[1], medio[2] + RADIO_DEL_AGARRE + STICK_RADIUS + 0.01]
    expect(paloEnLaMano(tanda.palos, fuera)).toBe(null)
  })

  it('el ratón coge el primer palo que corta su rayo, y no el de detrás', () => {
    const tanda = new Tanda('a', 1, 5, MACHINE_HEIGHT, false)
    const palo = tanda.palos[2]
    const { arriba, abajo } = cuerpoDelPalo(palo)
    const medio: [number, number, number] = [(arriba[0] + abajo[0]) / 2, (arriba[1] + abajo[1]) / 2, (arriba[2] + abajo[2]) / 2]
    const origen: [number, number, number] = [medio[0], medio[1], medio[2] + 3]
    expect(paloEnElRayo(tanda.palos, origen, [0, 0, -1])?.indice).toBe(2)
    expect(paloEnElRayo(tanda.palos, [medio[0] + STICK_RADIUS * 2, medio[1], medio[2] + 3], [0, 0, -1])).toBe(null)
  })
})

describe('qué suena, con la regla de `useGameSound.ts`', () => {
  const menu: Pistas = { score: 0, missed: 0, countdown: 0, gameState: 'menu', streak: 0, isRecord: false, levelPassed: null, lives: null }

  it('la cuenta atrás, la salida y los palos, cada nota del atrape con su racha y tope en ocho', () => {
    expect(sonidosDesde(menu, { ...menu, gameState: 'countdown', countdown: 3 })).toEqual(['countdown-3'])
    expect(sonidosDesde({ ...menu, gameState: 'countdown', countdown: 1 }, { ...menu, gameState: 'playing' })).toEqual(['go'])
    const jugando = { ...menu, gameState: 'playing' as const }
    expect(sonidosDesde(jugando, { ...jugando, score: 1, streak: 1 })).toEqual(['catch-1'])
    expect(sonidosDesde(jugando, { ...jugando, score: 12, streak: 12 })).toEqual(['catch-8'])
    expect(sonidosDesde(jugando, { ...jugando, missed: 1 })).toEqual(['miss'])
    expect(sonidosDesde(jugando, jugando)).toEqual([])
  })

  it('el final: ganar, perder o terminar, con el récord por encima', () => {
    const jugando = { ...menu, gameState: 'playing' as const }
    expect(sonidosDesde(jugando, { ...jugando, gameState: 'finished', isRecord: true })).toEqual(['over-close', 'record'])
    expect(finalQueSuena(true, null)).toBe('win')
    expect(finalQueSuena(false, null)).toBe('loss')
    expect(finalQueSuena(null, 2)).toBe('win')
    expect(finalQueSuena(null, 0)).toBe('loss')
    expect(finalQueSuena(null, null)).toBe('close')
  })

  it('todo lo que puede sonar es un fichero de `godot-kit.json`', () => {
    expect(SOUNDS.length).toBe(17)
  })
})
