import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_STICKS, MIN_STICKS } from './gameConfig'
import { COUNTDOWN_SECONDS, useGameStoreValue } from './gameStore'

// La cuenta atrás usa `setTimeout`, así que todo el fichero corre con relojes
// falsos: si no, cada partida costaría tres segundos reales de test.
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/**
 * Agota la cuenta atrás y deja la partida en juego.
 *
 * Segundo a segundo, y no de un salto: cada tic reprograma el siguiente desde
 * un efecto, que no corre hasta que React vuelve a renderizar. Avanzar tres
 * segundos de golpe solo dispararía el primero.
 */
function runOutCountdown() {
  for (let second = 0; second < COUNTDOWN_SECONDS; second++) {
    act(() => void vi.advanceTimersByTime(1000))
  }
}

/** Arranca una partida y agota la cuenta atrás, dejándola en juego. */
function startPlaying(store: {
  current: ReturnType<typeof useGameStoreValue>
}) {
  act(() => store.current.startGame())
  runOutCountdown()
}

/** Juega una partida entera atrapando `caught` palos y perdiendo el resto. */
function playRound(
  store: { current: ReturnType<typeof useGameStoreValue> },
  total: number,
  caught: number,
) {
  act(() => store.current.setStickCount(total))
  startPlaying(store)
  for (let i = 0; i < total; i++) {
    act(() => {
      if (i < caught) store.current.catchStick(0.5)
      else store.current.missStick()
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
    startPlaying(result)

    expect(result.current.gameState).toBe('playing')
    expect(result.current.score).toBe(0)
    expect(result.current.resolved).toBe(0)
  })

  it('renueva el identificador de partida para remontar los palos', () => {
    const { result } = renderHook(() => useGameStoreValue())
    const before = result.current.runId
    startPlaying(result)
    expect(result.current.runId).toBe(before + 1)
  })

  it('suma los palos atrapados sin cerrar la partida antes de tiempo', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.setStickCount(5))
    startPlaying(result)

    act(() => result.current.catchStick(0.5))

    expect(result.current.score).toBe(1)
    expect(result.current.resolved).toBe(1)
    expect(result.current.gameState).toBe('playing')
  })

  it('cuenta como resuelto el palo perdido, sin sumar al marcador', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.setStickCount(5))
    startPlaying(result)
    act(() => result.current.missStick())

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
    startPlaying(result)

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.catchStick(0.5)
      }
    })

    expect(result.current.resolved).toBe(5)
    expect(result.current.score).toBe(5)
    expect(result.current.gameState).toBe('finished')
  })

  it('sobrevive a una resolución de más sin volver al menú', () => {
    const { result } = renderHook(() => useGameStoreValue())
    playRound(result, 5, 5)
    act(() => result.current.missStick())

    expect(result.current.gameState).toBe('finished')
  })
})

describe('cuenta atrás', () => {
  it('la partida no arranca de golpe: primero cuenta', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.startGame())

    expect(result.current.gameState).toBe('countdown')
    expect(result.current.countdown).toBe(COUNTDOWN_SECONDS)
  })

  it('va bajando un segundo cada vez', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.startGame())

    act(() => void vi.advanceTimersByTime(1000))
    expect(result.current.countdown).toBe(COUNTDOWN_SECONDS - 1)

    act(() => void vi.advanceTimersByTime(1000))
    expect(result.current.countdown).toBe(COUNTDOWN_SECONDS - 2)
    expect(result.current.gameState).toBe('countdown')
  })

  it('los palos no caen mientras se cuenta', () => {
    // `StickMachine` los mantiene parados mirando la fase; si la cuenta atrás
    // no fuera una fase propia, el primer palo saldría antes del "ya".
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.startGame())
    expect(result.current.gameState).not.toBe('playing')
  })

  it('al llegar a cero se empieza a jugar', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.startGame())
    runOutCountdown()

    expect(result.current.gameState).toBe('playing')
  })

  it('volver al menú durante la cuenta la corta', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.startGame())
    act(() => result.current.resetGame())

    expect(result.current.gameState).toBe('menu')

    // Y no arranca sola después: un temporizador que quedara vivo no puede
    // devolver al jugador a una partida que ha cancelado.
    act(() => void vi.advanceTimersByTime(5000))
    expect(result.current.gameState).toBe('menu')
  })
})

describe('escenario o passthrough', () => {
  it('se entra con el escenario puesto', () => {
    // Es la experiencia completa; quien prefiera ver su cuarto lo quita desde
    // el menú inmersivo.
    const { result } = renderHook(() => useGameStoreValue())
    expect(result.current.scenery).toBe('scene')
  })

  it('se puede alternar en cualquier momento', () => {
    const { result } = renderHook(() => useGameStoreValue())

    act(() => result.current.setScenery('passthrough'))
    expect(result.current.scenery).toBe('passthrough')

    act(() => result.current.setScenery('scene'))
    expect(result.current.scenery).toBe('scene')
  })

  it('la elección sobrevive a la partida', () => {
    // Cambiar de decorado no es parte de la partida: quitarlo al empezar o al
    // volver al menú obligaría a elegirlo cada vez.
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.setScenery('passthrough'))

    playRound(result, 5, 3)
    expect(result.current.scenery).toBe('passthrough')

    act(() => result.current.resetGame())
    expect(result.current.scenery).toBe('passthrough')
  })
})

describe('puntuación y racha', () => {
  it('atrapar suma puntos; fallar no', () => {
    const { result } = renderHook(() => useGameStoreValue())
    startPlaying(result)

    act(() => result.current.catchStick(0.5))
    const afterCatch = result.current.points
    expect(afterCatch).toBeGreaterThan(0)

    act(() => result.current.missStick())
    expect(result.current.points).toBe(afterCatch)
  })

  it('cogerlo pronto puntúa más que rescatarlo del suelo', () => {
    const early = renderHook(() => useGameStoreValue())
    startPlaying(early.result)
    act(() => early.result.current.catchStick(0))

    const late = renderHook(() => useGameStoreValue())
    startPlaying(late.result)
    act(() => late.result.current.catchStick(1))

    expect(early.result.current.points).toBeGreaterThan(late.result.current.points)
  })

  it('la misma partida renta más en una dificultad alta', () => {
    const easy = renderHook(() => useGameStoreValue())
    startPlaying(easy.result)
    act(() => easy.result.current.catchStick(0.5))

    const hard = renderHook(() => useGameStoreValue())
    act(() => hard.result.current.setDifficulty('impossible'))
    startPlaying(hard.result)
    act(() => hard.result.current.catchStick(0.5))

    expect(hard.result.current.points).toBeGreaterThan(easy.result.current.points)
  })

  it('la racha crece al encadenar y se rompe al fallar', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.setStickCount(9))
    startPlaying(result)

    act(() => result.current.catchStick(0.5))
    act(() => result.current.catchStick(0.5))
    expect(result.current.streak).toBe(2)

    act(() => result.current.missStick())
    expect(result.current.streak).toBe(0)

    act(() => result.current.catchStick(0.5))
    expect(result.current.streak).toBe(1)
  })

  it('guarda la mejor racha aunque luego se rompa', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.setStickCount(9))
    startPlaying(result)

    act(() => result.current.catchStick(0.5))
    act(() => result.current.catchStick(0.5))
    act(() => result.current.catchStick(0.5))
    act(() => result.current.missStick())

    expect(result.current.streak).toBe(0)
    expect(result.current.bestStreak).toBe(3)
  })

  it('dos palos atrapados en el mismo lote puntúan cada uno por su racha', () => {
    // Los dos mandos XR pueden resolver a la vez. Si la racha se leyera del
    // render anterior, ambos cobrarían el mismo bonus y el segundo saldría
    // barato.
    const batched = renderHook(() => useGameStoreValue())
    act(() => batched.result.current.setStickCount(9))
    startPlaying(batched.result)
    act(() => {
      batched.result.current.catchStick(0.5)
      batched.result.current.catchStick(0.5)
    })

    const sequential = renderHook(() => useGameStoreValue())
    act(() => sequential.result.current.setStickCount(9))
    startPlaying(sequential.result)
    act(() => sequential.result.current.catchStick(0.5))
    act(() => sequential.result.current.catchStick(0.5))

    expect(batched.result.current.streak).toBe(2)
    expect(batched.result.current.points).toBe(sequential.result.current.points)
  })

  it('empezar otra partida borra puntos y racha', () => {
    const { result } = renderHook(() => useGameStoreValue())
    playRound(result, 5, 5)
    expect(result.current.points).toBeGreaterThan(0)

    startPlaying(result)

    expect(result.current.points).toBe(0)
    expect(result.current.streak).toBe(0)
    expect(result.current.bestStreak).toBe(0)
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

    startPlaying(result)

    expect(result.current.gameState).toBe('playing')
    expect(result.current.score).toBe(0)
    expect(result.current.resolved).toBe(0)
  })

  it('no da por terminada una partida que no ha empezado', () => {
    const { result } = renderHook(() => useGameStoreValue())
    act(() => result.current.missStick())
    expect(result.current.gameState).toBe('menu')
  })
})
