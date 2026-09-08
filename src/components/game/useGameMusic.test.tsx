import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GameContext,
  type GameStore,
  useGameStoreValue,
} from '../../lib/gameStore'
import { MUSIC_VOLUME } from '../../lib/music'
import { useGameMusic } from './useGameMusic'

/**
 * Lo que se comprueba aquí son las reglas que el hook añade sobre el fichero de
 * audio: que entrar con la música apagada no descarga nada, que el silencio del
 * juego manda sobre ella, y que desmontar el mundo la calla —que es lo que pasa
 * a cada visita dentro del salón de xrcade—.
 *
 * `Audio` va de mentira porque jsdom no reproduce nada: lo que se mira es
 * cuántos se crean y qué se les pide.
 */
const creados: FakeAudio[] = []

class FakeAudio {
  loop = false
  volume = 1
  readonly play = vi.fn(() => Promise.resolve())
  readonly pause = vi.fn()

  constructor(readonly src: string) {
    creados.push(this)
  }
}

beforeEach(() => {
  creados.length = 0
  window.localStorage.clear()
  vi.stubGlobal('Audio', FakeAudio)
})

afterEach(() => {
  // Sin `globals` en la config de Vitest, Testing Library no limpia sola: un
  // montaje que sobrevive al test se despierta con la preferencia que ponga el
  // siguiente y se pone a sonar en su turno.
  cleanup()
  vi.unstubAllGlobals()
})

/** Monta el mundo con música y devuelve su estado para manejarlo desde fuera. */
function renderGame() {
  const store = { current: null as GameStore | null }

  function Music() {
    useGameMusic()
    return null
  }

  function Harness() {
    const value = useGameStoreValue()
    store.current = value
    return (
      <GameContext.Provider value={value}>
        <Music />
      </GameContext.Provider>
    )
  }

  const view = render(<Harness />)
  return Object.assign(store as { current: GameStore }, {
    unmount: view.unmount,
  })
}

describe('useGameMusic', () => {
  it('se entra con música, sonando en bucle y por debajo de la partida', () => {
    renderGame()

    expect(creados).toHaveLength(1)
    expect(creados[0].loop).toBe(true)
    expect(creados[0].volume).toBe(MUSIC_VOLUME)
    expect(creados[0].play).toHaveBeenCalled()
  })

  it('apagarla la para, y volver a encenderla no crea otro reproductor', () => {
    const game = renderGame()

    act(() => game.current.setMusic(false))
    expect(creados[0].pause).toHaveBeenCalled()

    act(() => game.current.setMusic(true))
    expect(creados).toHaveLength(1)
    expect(creados[0].play).toHaveBeenCalledTimes(2)
  })

  it('el silencio del juego la calla aunque esté encendida', () => {
    const game = renderGame()

    act(() => game.current.setMuted(true))

    expect(creados[0].pause).toHaveBeenCalled()
  })

  it('quitar el mundo se lleva la música', () => {
    // Es lo que pasa al salir de una cabina del salón: si no, seguiría sonando
    // sobre el juego siguiente.
    const game = renderGame()

    game.unmount()

    expect(creados[0].pause).toHaveBeenCalled()
  })

  it('si el navegador no la deja sonar, espera al primer gesto', () => {
    // Ningún navegador reproduce nada antes de que quien juega toque algo. Que
    // el intento falle no es un error: es el caso normal al entrar.
    renderGame()
    creados[0].play.mockClear()

    act(() => {
      window.dispatchEvent(new Event('pointerdown'))
    })

    expect(creados[0].play).toHaveBeenCalled()
  })
})
