import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MAX_STICKS, MIN_STICKS } from './gameConfig'
import { useGameStoreValue } from './gameStore'

/** Juega una partida entera atrapando `caught` palos y perdiendo el resto. */
function playRound(
  store: { current: ReturnType<typeof useGameStoreValue> },
  total: number,
  caught: number,
) {
  act(() => store.current.setStickCount(total))
  act(() => store.current.startGame())
  for (let i = 0; i < total; i++) {
    act(() => {
      if (i < caught) store.current.catchStick()
      store.current.resolveStick()
    })
  }
}

describe('selección previa a la partida', () => {
  it('arranca en el menú con los valores por defecto', () => {
    const { result } = renderHook(() => useGameStoreValue())
    expect(result.current.gameState).toBe('menu')
    expect(result.current.stickCount).toBe(MIN_STICKS)
    expect(result.current.difficulty).toBe('easy')
    expect(result.current.score).toBe(0)
  })

  it('acepta cualquier número de palos dentro del rango', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.setStickCount(9))
    expect(result.current.stickCount).toBe(9)
  })

  it('recorta los valores fuera de rango en vez de romper la escena', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.setStickCount(MIN_STICKS - 3))
    expect(result.current.stickCount).toBe(MIN_STICKS)

    act(() => result.current.setStickCount(MAX_STICKS + 100))
    expect(result.current.stickCount).toBe(MAX_STICKS)

    act(() => result.current.setStickCount(-1))
    expect(result.current.stickCount).toBe(MIN_STICKS)
  })

  it('redondea los decimales y descarta NaN', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.setStickCount(7.4))
    expect(result.current.stickCount).toBe(7)

    act(() => result.current.setStickCount(Number.NaN))
    expect(result.current.stickCount).toBe(MIN_STICKS)
  })

  it('cambia de dificultad', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.setDifficulty('impossible'))
    expect(result.current.difficulty).toBe('impossible')
  })
})

describe('ciclo de una partida', () => {
  it('empieza a jugar con el marcador a cero', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.startGame())

    expect(result.current.gameState).toBe('playing')
    expect(result.current.score).toBe(0)
    expect(result.current.resolved).toBe(0)
  })

  it('renueva el identificador de partida para remontar los palos', () => {
    const { result } = renderHook(() => useGameStoreValue())
    const before = result.current.runId
    act(() => result.current.startGame())
    expect(result.current.runId).toBe(before + 1)
  })

  it('suma los palos atrapados sin cerrar la partida antes de tiempo', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.setStickCount(5))
    act(() => result.current.startGame())

    act(() => {
      result.current.catchStick()
      result.current.resolveStick()
    })

    expect(result.current.score).toBe(1)
    expect(result.current.resolved).toBe(1)
    expect(result.current.gameState).toBe('playing')
  })

  it('cuenta como resuelto el palo perdido, sin sumar al marcador', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.setStickCount(5))
    act(() => result.current.startGame())
    act(() => result.current.resolveStick())

    expect(result.current.score).toBe(0)
    expect(result.current.resolved).toBe(1)
  })

  it('termina la partida cuando se resuelve el último palo', () => {
    const { result } = renderHook(() => useGameStoreValue())
    playRound(result, 5, 3)

    expect(result.current.gameState).toBe('finished')
    expect(result.current.score).toBe(3)
    expect(result.current.resolved).toBe(5)
  })

  it('no se queda colgada si dos palos se resuelven de golpe', () => {
    // Dos mandos XR sobre palos distintos, o el último palo tocando el suelo
    // mientras se atrapa otro: ambas resoluciones caen en el mismo lote de
    // React. El contador se actualiza en función del valor previo, así que
    // ninguna se pierde.
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.setStickCount(5))
    act(() => result.current.startGame())

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.catchStick()
        result.current.resolveStick()
      }
    })

    expect(result.current.resolved).toBe(5)
    expect(result.current.score).toBe(5)
    expect(result.current.gameState).toBe('finished')
  })

  it('sobrevive a una resolución de más sin volver al menú', () => {
    const { result } = renderHook(() => useGameStoreValue())
    playRound(result, 5, 5)
    act(() => result.current.resolveStick())

    expect(result.current.gameState).toBe('finished')
  })
})

describe('vuelta al menú y revancha', () => {
  it('vuelve al menú conservando la configuración elegida', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.setDifficulty('hard'))
    playRound(result, 6, 2)

    act(() => result.current.resetGame())

    expect(result.current.gameState).toBe('menu')
    expect(result.current.score).toBe(0)
    expect(result.current.resolved).toBe(0)
    expect(result.current.stickCount).toBe(6)
    expect(result.current.difficulty).toBe('hard')
  })

  it('no se queda en "terminada" al encadenar otra partida', () => {
    const { result } = renderHook(() => useGameStoreValue())
    playRound(result, 5, 5)
    expect(result.current.gameState).toBe('finished')

    act(() => result.current.startGame())

    expect(result.current.gameState).toBe('playing')
    expect(result.current.score).toBe(0)
    expect(result.current.resolved).toBe(0)
  })

  it('no da por terminada una partida que no ha empezado', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.resolveStick())
    expect(result.current.gameState).toBe('menu')
  })
})
