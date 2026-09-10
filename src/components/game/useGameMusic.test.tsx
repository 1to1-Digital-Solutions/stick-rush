import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GameContext,
  type GameStore,
  useGameStoreValue,
} from '../../lib/gameStore'
import { MUSIC_VOLUME } from '../../lib/music'
import { MUSIC_FADE_MS } from '../../lib/musicFade'
import { useGameMusic } from './useGameMusic'
import { DEFAULT_VOLUMES, volumeFactor } from '../../lib/ajustes'
import { setVolume } from '../../lib/ajustesCliente'

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


/**
 * Espera a que termine el fundido.
 *
 * La música ya no entra ni se va de golpe (`lib/musicFade.ts`), así que el volumen final y
 * el `pause()` llegan al acabar la rampa y no en la misma línea. Se espera de verdad y no
 * con relojes falsos porque la rampa va por fotogramas: falsear el reloj sin falsear
 * `requestAnimationFrame` la dejaría parada, y falsear los dos es más maquinaria que los
 * setecientos milisegundos que cuesta esperarla.
 */
async function trasElFundido() {
  await act(async () => {
    await new Promise((listo) => setTimeout(listo, MUSIC_FADE_MS + 120))
  })
}

describe('useGameMusic', () => {
  it('se entra con música, sonando en bucle y por debajo de la partida', async () => {
    renderGame()
    await trasElFundido()

    expect(creados).toHaveLength(1)
    expect(creados[0].loop).toBe(true)
    expect(creados[0].volume).toBeCloseTo(MUSIC_VOLUME * volumeFactor(DEFAULT_VOLUMES.ambience))
    expect(creados[0].play).toHaveBeenCalled()
  })

  it('apagarla la para, y volver a encenderla no crea otro reproductor', async () => {
    renderGame()

    act(() => setVolume('ambience', 0))
    await trasElFundido()
    expect(creados[0].pause).toHaveBeenCalled()

    act(() => setVolume('ambience', DEFAULT_VOLUMES.ambience))
    expect(creados).toHaveLength(1)
    expect(creados[0].play).toHaveBeenCalledTimes(2)
  })

  it('quitar los efectos no la calla: son dos canales aparte', () => {
    // Antes el silencio mandaba sobre todo. Ahora los ajustes del arcade
    // separan «sonidos interactivos» de «sonidos ambientales» a propósito: hay
    // quien quiere oír la feria y no los palos, y quien prefiere lo contrario.
    renderGame()

    act(() => setVolume('sfx', 0))

    expect(creados[0].pause).not.toHaveBeenCalled()
  })

  it('quitar el mundo se lleva la música', async () => {
    // Es lo que pasa al salir de una cabina del salón: si no, seguiría sonando
    // sobre el juego siguiente. Bajándola, no cortándola: el salón devuelve la suya detrás.
    const game = renderGame()

    game.unmount()
    await trasElFundido()

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
