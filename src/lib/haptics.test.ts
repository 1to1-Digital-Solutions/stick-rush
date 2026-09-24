import { describe, expect, it, vi } from 'vitest'
import {
  IN_EXTREMIS,
  IN_EXTREMIS_BOOST,
  PRESS_PULSE,
  manoDelEvento,
  pulsarAtrape,
  pulseHaptics,
  pulsosDelAtrape,
  reproducirPulsos,
  tactoDelAtrape,
} from './haptics'
import { RECETAS, pulsosDe } from './tactos'

/** Doble de un mando de WebXR, con los motores de vibración que se le pidan. */
function fakeInputSource(actuators: unknown[], handedness: XRHandedness = 'right') {
  return { handedness, gamepad: { hapticActuators: actuators } } as unknown as XRInputSource
}

/**
 * Doble de un evento de mando: lo que le llega a la app es el estado del
 * puntero, con el `inputSource` de la sesión colgando.
 */
function fakeController(actuators: unknown[], handedness: XRHandedness = 'right') {
  return { pointerState: { inputSource: fakeInputSource(actuators, handedness) } }
}

const CATCH = { intensity: 0.5, durationMs: 20 }

describe('atrapar un palo, en la mano que lo coge', () => {
  it('es un agarre de las recetas comunes', () => {
    expect(tactoDelAtrape('left')).toEqual({ tipo: 'agarre', mano: 'left' })
    expect(pulsosDelAtrape('left', 0.3)).toEqual(pulsosDe({ tipo: 'agarre', mano: 'left' }))
  })

  it('in extremis se siente más, sin pasar de un agarre a un golpe', () => {
    const normal = pulsosDelAtrape('right', IN_EXTREMIS - 0.01)[0]
    const extremo = pulsosDelAtrape('right', IN_EXTREMIS)[0]
    expect(extremo.intensidad).toBeCloseTo(normal.intensidad * IN_EXTREMIS_BOOST, 9)
    expect(extremo.intensidad).toBeLessThan(RECETAS.impacto.maximo)
    expect(extremo.ms).toBe(normal.ms)
    expect(extremo.mano).toBe('right')
  })

  it('una caída que no es un número se trata como un atrape cualquiera', () => {
    expect(pulsosDelAtrape('left', Number.NaN)).toEqual(pulsosDe(tactoDelAtrape('left')))
  })
})

describe('de qué mano viene un evento', () => {
  it('del mando o de la mano de XR, su lado', () => {
    expect(manoDelEvento(fakeController([], 'left'))).toBe('left')
    expect(manoDelEvento(fakeController([], 'right'))).toBe('right')
  })

  it('el ratón y lo que no tiene lado no son ninguna mano', () => {
    expect(manoDelEvento({})).toBeNull()
    expect(manoDelEvento(null)).toBeNull()
    expect(manoDelEvento('clic')).toBeNull()
    expect(manoDelEvento(fakeController([], 'none'))).toBeNull()
  })
})

describe('reproducir los pulsos', () => {
  it('cada pulso va al mando de su mano, y solo a ese', () => {
    const izquierda = vi.fn(() => Promise.resolve(true))
    const derecha = vi.fn(() => Promise.resolve(true))
    reproducirPulsos(
      [fakeInputSource([{ pulse: izquierda }], 'left'), fakeInputSource([{ pulse: derecha }], 'right')],
      [{ mano: 'left', intensidad: 0.3, ms: 20, retardo: 0 }],
    )
    expect(izquierda).toHaveBeenCalledWith(0.3, 20)
    expect(derecha).not.toHaveBeenCalled()
  })

  it('los que llevan retardo se programan, y se pueden cancelar', () => {
    const pulse = vi.fn(() => Promise.resolve(true))
    const programados: { hacer: () => void; ms: number }[] = []
    const cancelado = vi.fn()
    const cancelar = reproducirPulsos(
      [fakeInputSource([{ pulse }], 'left')],
      pulsosDe({ tipo: 'impacto', mano: 'left', fuerza: 1 }),
      (hacer, ms) => {
        programados.push({ hacer, ms })
        return cancelado
      },
    )
    // El golpe sale ya; la cola, cuando acaba el golpe.
    expect(pulse).toHaveBeenCalledOnce()
    expect(programados.map((p) => p.ms)).toEqual([RECETAS.impacto.ms])
    programados[0].hacer()
    expect(pulse).toHaveBeenCalledTimes(2)
    cancelar()
    expect(cancelado).toHaveBeenCalledOnce()
  })

  it('con setTimeout de verdad, cancelar antes de tiempo deja la cola sin sonar', () => {
    vi.useFakeTimers()
    const pulse = vi.fn(() => Promise.resolve(true))
    const cancelar = reproducirPulsos(
      [fakeInputSource([{ pulse }], 'right')],
      pulsosDe({ tipo: 'impacto', mano: 'right', fuerza: 0.5 }),
    )
    cancelar()
    vi.runAllTimers()
    expect(pulse).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('sin mando en esa mano no ocurre nada', () => {
    const pulse = vi.fn()
    reproducirPulsos([undefined, fakeInputSource([{ pulse }], 'left')], [{ mano: 'right', intensidad: 1, ms: 10, retardo: 0 }])
    expect(pulse).not.toHaveBeenCalled()
  })
})

describe('el atrape de verdad, desde el evento del agarre', () => {
  it('vibra el mando que lo ha cogido', () => {
    const pulse = vi.fn(() => Promise.resolve(true))
    pulsarAtrape(fakeController([{ pulse }], 'left'), 0.2)
    expect(pulse).toHaveBeenCalledWith(RECETAS.agarre.intensidad, RECETAS.agarre.ms)
  })

  it('con el ratón o la mano desnuda, nada', () => {
    expect(() => pulsarAtrape({}, 0.5)()).not.toThrow()
    const hand = { pointerState: { inputSource: { handedness: 'left' } } }
    expect(() => pulsarAtrape(hand, 0.5)).not.toThrow()
  })
})

describe('el toque de un botón', () => {
  it('es discreto: se notan trece seguidos sin molestar', () => {
    expect(PRESS_PULSE.durationMs).toBeLessThanOrEqual(30)
    expect(PRESS_PULSE.intensity).toBeLessThanOrEqual(0.3)
    expect(PRESS_PULSE.intensity).toBeGreaterThan(0)
  })
})

describe('vibración del mando', () => {
  it('golpea el mando que ha pulsado, con la receta que se le pide', () => {
    const pulse = vi.fn(() => Promise.resolve(true))
    const event = fakeController([{ pulse }])

    expect(pulseHaptics(event, CATCH)).toBe(true)
    expect(pulse).toHaveBeenCalledWith(CATCH.intensity, CATCH.durationMs)
  })

  it('usa el primer actuador cuando el mando declara varios', () => {
    const first = vi.fn(() => Promise.resolve(true))
    const second = vi.fn(() => Promise.resolve(true))

    pulseHaptics(fakeController([{ pulse: first }, { pulse: second }]), CATCH)

    expect(first).toHaveBeenCalledOnce()
    expect(second).not.toHaveBeenCalled()
  })

  it('con el ratón no vibra nada', () => {
    // En escritorio se juega a clics y el evento no trae puntero de XR: no es
    // un fallo, es que ahí no hay mando que hacer vibrar.
    expect(pulseHaptics({}, CATCH)).toBe(false)
    expect(pulseHaptics(undefined, CATCH)).toBe(false)
  })

  it('la mano desnuda no vibra', () => {
    // Sin mando no hay `gamepad`: se coge el palo igual, solo que sin golpe.
    const hand = { pointerState: { inputSource: { handedness: 'left' } } }

    expect(pulseHaptics(hand, CATCH)).toBe(false)
  })

  it('un mando sin motor de vibración no rompe la captura', () => {
    expect(pulseHaptics(fakeController([]), CATCH)).toBe(false)
    // Navegador que expone el actuador pero no la API `pulse` de WebXR.
    expect(pulseHaptics(fakeController([{ playEffect: vi.fn() }]), CATCH)).toBe(false)
  })

  it('un mando que revienta al vibrar no se lleva por delante la captura', () => {
    // La otra forma que tiene el mando de negarse: en vez de rechazar la
    // promesa, lanzar en el acto. La excepción subiría por el manejador del
    // agarre, que es lo único que no puede pasar por un adorno.
    const broken = fakeController([
      {
        pulse: () => {
          throw new Error('el visor ha perdido el foco')
        },
      },
    ])

    expect(() => pulseHaptics(broken, CATCH)).not.toThrow()
    expect(pulseHaptics(broken, CATCH)).toBe(false)
  })

  it('un mando que no devuelve promesa vibra igual', () => {
    // La especificación dice que `pulse()` devuelve una promesa, pero el
    // navegador del visor no es quien la firma: si devuelve otra cosa, el
    // golpe ya se ha dado y no hay rechazo que recoger.
    const mute = fakeController([{ pulse: () => undefined }])

    expect(() => pulseHaptics(mute, CATCH)).not.toThrow()
    expect(pulseHaptics(mute, CATCH)).toBe(true)
  })

  it('recoge el rechazo del mando en vez de dejar la promesa suelta', () => {
    // Un mando que se niega a vibrar —el visor ha perdido el foco, la sesión se
    // está cerrando— rechaza la promesa. Sin recogerla quedaría un rechazo sin
    // atender por cada palo atrapado.
    const recover = vi.fn()
    const pending = { catch: recover } as unknown as Promise<boolean>

    expect(pulseHaptics(fakeController([{ pulse: () => pending }]), CATCH)).toBe(true)
    expect(recover).toHaveBeenCalled()
  })
})
