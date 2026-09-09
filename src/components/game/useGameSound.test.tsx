import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  COUNTDOWN_SECONDS,
  GameContext,
  type GameStore,
  useGameStoreValue,
} from '../../lib/gameStore'
import { useGameSound } from './useGameSound'
import { DEFAULT_VOLUMES } from '../../lib/ajustes'
import { setVolume } from '../../lib/ajustesCliente'

// El motor de verdad se prueba en `sound.test.ts` contra un contexto de
// mentira; aquí lo que se comprueba es el cableado: qué sonido pide el juego
// en cada momento.
const { play } = vi.hoisted(() => ({ play: vi.fn() }))
vi.mock('@/lib/sound', () => ({
  createSoundEngine: () => ({ play, dispose: vi.fn() }),
}))

/** Los contextos creados durante el test, para vigilar que no se quedan vivos. */
const contexts: FakeAudioContext[] = []

class FakeAudioContext {
  state: AudioContextState = 'running'
  resume = vi.fn(() => Promise.resolve())
  close = vi.fn(() => Promise.resolve())

  constructor() {
    contexts.push(this)
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('AudioContext', FakeAudioContext)
  // El silencio se recuerda entre visitas, y jsdom comparte `localStorage`
  // entre tests: sin vaciarlo, el que silencia dejaría mudo al siguiente.
  localStorage.clear()
  // Los volúmenes salen de los ajustes del arcade, que cachean lo leído para
  // que `useSyncExternalStore` no repinte sin parar: vaciar `localStorage` a
  // secas dejaría el caché con el valor de la prueba anterior. Se restablecen
  // por la API, que es la que lo invalida.
  setVolume('sfx', DEFAULT_VOLUMES.sfx)
  setVolume('ambience', DEFAULT_VOLUMES.ambience)
  contexts.length = 0
  play.mockClear()
})

afterEach(() => {
  // Sin `globals` en la config de Vitest, Testing Library no limpia sola: los
  // montajes de un test seguirían escuchando la página en el siguiente y
  // crearían contextos de audio que no son de nadie.
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/**
 * Monta el juego con sonido y devuelve su estado para manejarlo desde fuera.
 *
 * Lleva un botón de silenciar de verdad —no basta con llamar a `setMuted`—
 * porque parte de lo que hay que comprobar es cuándo llega ese cambio respecto
 * del clic que desbloquea el audio.
 */
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
        <button type="button" onClick={() => setVolume('sfx', value.muted ? DEFAULT_VOLUMES.sfx : 0)}>
          Mute
        </button>
      </GameContext.Provider>
    )
  }

  const view = render(<Harness />)
  return Object.assign(store as { current: GameStore }, {
    unmount: view.unmount,
    /**
     * Pulsa el botón de silenciar como lo haría el jugador: con la secuencia
     * de eventos que manda el navegador, no solo con el clic. El orden importa,
     * porque es lo que decide si el gesto que desbloquea el audio llega antes o
     * a la vez que la orden de callar.
     */
    clickMute: () => {
      const button = view.getByRole('button', { name: 'Mute' })
      fireEvent.pointerDown(button)
      fireEvent.pointerUp(button)
      fireEvent.click(button)
    },
  })
}

/** El navegador no deja sonar hasta que el usuario interactúa con la página. */
function interact() {
  act(() => {
    window.dispatchEvent(new Event('pointerdown'))
    window.dispatchEvent(new Event('click'))
  })
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

  it('un acierto y un fallo a la vez se oyen los dos', () => {
    // Con los mandos del visor el agarre se resuelve en el mismo frame que la
    // caída, así que las dos cosas pueden llegar en el mismo lote. Tragarse una
    // dejaría al jugador sin saber qué acaba de pasar, que es justo para lo que
    // está el sonido.
    const store = renderGame()
    interact()
    startPlaying(store)
    play.mockClear()

    act(() => {
      store.current.catchStick(0.5)
      store.current.missStick()
    })

    expect(playedSounds().map((sound) => sound.name)).toEqual(['catch', 'miss'])
  })

  it('en silencio ni se crea el contexto de audio', () => {
    // Silenciar no es bajar el volumen a cero: si se creara el contexto, el
    // juego seguiría pidiendo permiso de reproducción y programando nodos para
    // nada.
    const store = renderGame()
    act(() => setVolume('sfx', 0))
    interact()
    startPlaying(store)
    act(() => store.current.catchStick(0.5))

    expect(contexts).toHaveLength(0)
    expect(play).not.toHaveBeenCalled()
  })

  it('silenciar con el primer clic de la página tampoco lo abre', () => {
    // Ese clic es a la vez el gesto que desbloquea el audio y la orden de
    // callar. Atendidos por separado —el gesto en `pointerdown` y el botón en
    // el clic— el juego abre un contexto para cerrarlo en el render siguiente.
    const store = renderGame()

    store.clickMute()
    startPlaying(store)

    expect(store.current.muted).toBe(true)
    expect(contexts).toHaveLength(0)
  })

  it('silenciar a media partida cierra el contexto y calla', () => {
    const store = renderGame()
    interact()
    startPlaying(store)

    act(() => setVolume('sfx', 0))
    play.mockClear()
    act(() => store.current.catchStick(0.5))

    expect(contexts[0].close).toHaveBeenCalled()
    expect(play).not.toHaveBeenCalled()
  })

  it('quitar el silencio devuelve el sonido sin esperar otro gesto', () => {
    // El propio botón es el gesto que el navegador exige, así que volver a
    // esperar un clic dejaría muda la partida que ya está en marcha.
    const store = renderGame()
    interact()
    startPlaying(store)
    act(() => setVolume('sfx', 0))
    act(() => setVolume('sfx', DEFAULT_VOLUMES.sfx))
    play.mockClear()

    act(() => store.current.catchStick(0.5))

    expect(playedSounds()).toEqual([{ name: 'catch', streak: 1 }])
  })

  it('ir y volver del silencio no deja contextos abiertos', () => {
    // Cada vuelta abre uno nuevo, y el navegador solo permite unos pocos por
    // pestaña: si el anterior no se cerrara, unas cuantas idas y venidas
    // dejarían el juego mudo hasta recargar la página.
    renderGame()
    interact()

    for (let round = 0; round < 3; round++) {
      act(() => setVolume('sfx', 0))
      act(() => setVolume('sfx', DEFAULT_VOLUMES.sfx))
    }

    expect(contexts).toHaveLength(4)
    for (const closed of contexts.slice(0, -1)) {
      expect(closed.close).toHaveBeenCalled()
    }
    expect(contexts[contexts.length - 1].close).not.toHaveBeenCalled()
  })

  it('al desmontar cierra el contexto de audio', () => {
    // Sin esto cada montaje deja un contexto vivo, y el navegador solo permite
    // unos pocos por pestaña antes de negarse a crear más.
    const store = renderGame()
    interact()

    store.unmount()

    expect(contexts).toHaveLength(1)
    expect(contexts[0].close).toHaveBeenCalled()
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
