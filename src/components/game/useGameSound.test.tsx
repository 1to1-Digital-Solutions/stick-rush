import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  COUNTDOWN_SECONDS,
  GameContext,
  type GameStore,
  useGameStoreValue,
} from '@/lib/gameStore'
import { useGameSound } from './useGameSound'

// El motor de verdad se prueba en `sound.test.ts` contra un contexto de
// mentira; aquí lo que se comprueba es el cableado: qué sonido pide el juego
// en cada momento.
const { play } = vi.hoisted(() => ({ play: vi.fn() }))
vi.mock('@/lib/sound', () => ({
  createSoundEngine: () => ({ play, dispose: vi.fn() }),
}))

class FakeAudioContext {
  state: AudioContextState = 'running'
  resume = vi.fn(() => Promise.resolve())
  close = vi.fn(() => Promise.resolve())
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('AudioContext', FakeAudioContext)
  play.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** Monta el juego con sonido y devuelve su estado para manejarlo desde fuera. */
function renderGame() {
  const store = { current: null as GameStore | null }

  function Sound() {
    useGameSound()
    return null
  }

  function Harness() {
    const value = useGameStoreValue()
    store.current = value
    return (
      <GameContext.Provider value={value}>
        <Sound />
      </GameContext.Provider>
    )
  }

  render(<Harness />)
  return store as { current: GameStore }
}

/** El navegador no deja sonar hasta que el usuario interactúa con la página. */
function interact() {
  act(() => void window.dispatchEvent(new Event('pointerdown')))
}

/** Un segundo de la cuenta atrás. */
function tickSecond() {
  act(() => void vi.advanceTimersByTime(1000))
}

/** Deja la partida jugando, con la cuenta atrás agotada. */
function startPlaying(store: { current: GameStore }) {
  act(() => store.current.startGame())
  for (let second = 0; second < COUNTDOWN_SECONDS; second++) tickSecond()
}

/** Los sonidos pedidos hasta ahora, en orden. */
function playedSounds() {
  return play.mock.calls.map(([sound]) => sound)
}

describe('sonido de la partida', () => {
  it('no suena nada hasta que el jugador ha interactuado', () => {
    // Es la política del navegador: un contexto de audio creado sin gesto
    // previo nace suspendido y el juego se queda mudo el resto de la sesión.
    const store = renderGame()
    startPlaying(store)
    act(() => store.current.catchStick(0.5))

    expect(play).not.toHaveBeenCalled()
  })

  it('atrapar un palo suena', () => {
    const store = renderGame()
    interact()
    startPlaying(store)
    play.mockClear()

    act(() => store.current.catchStick(0.5))

    expect(playedSounds()).toEqual([{ name: 'catch', streak: 1 }])
  })

  it('la racha viaja en el sonido del acierto', () => {
    const store = renderGame()
    interact()
    startPlaying(store)
    act(() => store.current.catchStick(0.5))
    play.mockClear()

    act(() => store.current.catchStick(0.5))

    expect(playedSounds()).toEqual([{ name: 'catch', streak: 2 }])
  })

  it('perder un palo suena distinto que atraparlo', () => {
    const store = renderGame()
    interact()
    startPlaying(store)
    play.mockClear()

    act(() => store.current.missStick())

    expect(playedSounds()).toEqual([{ name: 'miss' }])
  })

  it('dos palos resueltos en el mismo lote suenan una vez', () => {
    // Dos copias del mismo sonido a la vez no se oyen como dos, se oyen como
    // una más fuerte.
    const store = renderGame()
    interact()
    act(() => store.current.setStickCount(9))
    startPlaying(store)
    play.mockClear()

    act(() => {
      store.current.catchStick(0.5)
      store.current.catchStick(0.5)
    })

    expect(playedSounds()).toEqual([{ name: 'catch', streak: 2 }])
  })

  it('la cuenta atrás marca cada segundo y remata con la salida', () => {
    const store = renderGame()
    interact()

    act(() => store.current.startGame())
    for (let second = 0; second < COUNTDOWN_SECONDS; second++) tickSecond()

    expect(playedSounds()).toEqual([
      { name: 'countdown', secondsLeft: 3 },
      { name: 'countdown', secondsLeft: 2 },
      { name: 'countdown', secondsLeft: 1 },
      { name: 'go' },
    ])
  })

  it('volver al menú durante la cuenta atrás no da la salida', () => {
    const store = renderGame()
    interact()

    act(() => store.current.startGame())
    tickSecond()
    act(() => store.current.resetGame())
    act(() => void vi.advanceTimersByTime(5000))

    expect(playedSounds()).not.toContainEqual({ name: 'go' })
  })

  it('empezar otra partida no suena a acierto por el marcador a cero', () => {
    const store = renderGame()
    interact()
    startPlaying(store)
    act(() => store.current.catchStick(0.5))
    act(() => store.current.resetGame())
    play.mockClear()

    startPlaying(store)

    expect(playedSounds()).not.toContainEqual({ name: 'catch', streak: 1 })
  })
})
