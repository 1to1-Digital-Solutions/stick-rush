import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  COUNTDOWN_SECONDS,
  GameContext,
  type GameStore,
  useGameStoreValue,
} from '../../lib/gameStore'
import { MISS_PULSE } from '../../lib/haptics'
import { XRHaptics } from './XRHaptics'

// La sesión de WebXR no existe fuera del visor, así que se sustituye por los
// mandos que se quieran tener en la mano. Lo que se comprueba aquí es el
// cableado —cuándo pide el juego un golpe—; que el golpe llegue al mando es lo
// que prueba `haptics.test.ts`.
const { session } = vi.hoisted(() => ({
  session: { current: null as { inputSources: unknown[] } | null },
}))
vi.mock('@react-three/xr', () => ({
  useXR: (select: (state: { session: unknown }) => unknown) =>
    select({ session: session.current }),
}))

/** Los motores de vibración de los dos mandos de la sesión de prueba. */
let motors: ReturnType<typeof vi.fn>[] = []

beforeEach(() => {
  vi.useFakeTimers()
  // El silencio se recuerda entre visitas y jsdom comparte `localStorage`: sin
  // vaciarlo, el test que silencia dejaría mudo al siguiente.
  localStorage.clear()
  motors = [vi.fn(() => Promise.resolve(true)), vi.fn(() => Promise.resolve(true))]
  session.current = {
    inputSources: motors.map((pulse) => ({
      gamepad: { hapticActuators: [{ pulse }] },
    })),
  }
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** Monta el juego con la vibración enchufada y devuelve su estado. */
function renderGame() {
  const store = { current: null as GameStore | null }

  function Harness() {
    const value = useGameStoreValue()
    store.current = value
    return (
      <GameContext.Provider value={value}>
        <XRHaptics />
      </GameContext.Provider>
    )
  }

  render(<Harness />)
  return store as { current: GameStore }
}

/** Deja la partida jugando, con la cuenta atrás agotada. */
function startPlaying(store: { current: GameStore }) {
  act(() => store.current.startGame())
  for (let second = 0; second < COUNTDOWN_SECONDS; second++) {
    act(() => void vi.advanceTimersByTime(1000))
  }
}

/** Cuántas veces ha vibrado cada mando. */
function pulses() {
  return motors.map((motor) => motor.mock.calls.length)
}

describe('vibración del palo perdido', () => {
  it('el palo que toca el suelo se nota en los dos mandos', () => {
    // Es lo que no puede dar el agarre: nadie ha tocado el palo, así que no hay
    // mano a la que cobrarle el fallo.
    const store = renderGame()
    startPlaying(store)

    act(() => store.current.missStick())

    expect(pulses()).toEqual([1, 1])
    for (const motor of motors) {
      expect(motor).toHaveBeenCalledWith(MISS_PULSE.intensity, MISS_PULSE.durationMs)
    }
  })

  it('atrapar un palo no vibra por aquí', () => {
    // El golpe del acierto lo da el propio agarre, en la mano que lo cogió
    // (ver `Stick`). Repetirlo aquí lo duplicaría en las dos.
    const store = renderGame()
    startPlaying(store)

    act(() => store.current.catchStick(0.5))

    expect(pulses()).toEqual([0, 0])
  })

  it('dos palos perdidos en el mismo lote dan un solo golpe', () => {
    // Dos vibraciones simultáneas en la misma mano no se sienten como dos.
    const store = renderGame()
    act(() => store.current.setStickCount(9))
    startPlaying(store)

    act(() => {
      store.current.missStick()
      store.current.missStick()
    })

    expect(pulses()).toEqual([1, 1])
  })

  it('empezar otra partida no vibra al poner el contador a cero', () => {
    const store = renderGame()
    startPlaying(store)
    act(() => store.current.missStick())
    act(() => store.current.resetGame())

    startPlaying(store)

    expect(pulses()).toEqual([1, 1])
  })

  it('el silencio no calla la vibración', () => {
    // Es justamente lo que sigue avisando con el sonido quitado: si el botón de
    // silenciar apagara también los mandos, quien juega en silencio se quedaría
    // sin ninguna señal del palo que se le escapa mientras mira otro.
    const store = renderGame()
    act(() => store.current.setMuted(true))
    startPlaying(store)

    act(() => store.current.missStick())

    expect(pulses()).toEqual([1, 1])
  })

  it('sin mandos en la sesión el fallo no rompe la partida', () => {
    // Jugando con las manos desnudas, o en escritorio, este mismo aviso corre
    // igual y no tiene dónde salir.
    session.current = null
    const store = renderGame()
    startPlaying(store)

    expect(() => act(() => store.current.missStick())).not.toThrow()
  })
})
