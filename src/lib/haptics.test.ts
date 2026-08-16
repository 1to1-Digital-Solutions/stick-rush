import { describe, expect, it, vi } from 'vitest'
import {
  CATCH_PULSE,
  MISS_PULSE,
  PRESS_PULSE,
  pulseAllHaptics,
  pulseHaptics,
} from './haptics'

/** Doble de un mando de WebXR, con los motores de vibración que se le pidan. */
function fakeInputSource(actuators: unknown[]) {
  return { gamepad: { hapticActuators: actuators } } as unknown as XRInputSource
}

/**
 * Doble de un evento de mando: lo que le llega a la app es el estado del
 * puntero, con el `inputSource` de la sesión colgando.
 */
function fakeController(actuators: unknown[]) {
  return { pointerState: { inputSource: fakeInputSource(actuators) } }
}

/** Doble de una sesión inmersiva con los mandos que se le pasen. */
function fakeSession(...sources: XRInputSource[]) {
  return { inputSources: sources }
}

describe('el golpe del acierto', () => {
  it('aprieta de verdad pero no llega a saturar el mando', () => {
    expect(CATCH_PULSE.intensity).toBeGreaterThan(0.3)
    expect(CATCH_PULSE.intensity).toBeLessThanOrEqual(1)
  })

  it('dura un golpe, no un zumbido', () => {
    // Una partida encadena hasta trece aciertos con el mando en la mano: un
    // pulso largo dejaría de leerse como "otro palo" y pasaría a molestar.
    expect(CATCH_PULSE.durationMs).toBeGreaterThan(10)
    expect(CATCH_PULSE.durationMs).toBeLessThan(120)
  })
})

describe('el golpe del fallo', () => {
  it('se distingue del acierto por las dos cosas: dura más y aprieta menos', () => {
    // Si solo cambiara una, con el brazo en movimiento los dos se sentirían
    // igual y la vibración diría menos que el sonido, que sí los distingue.
    expect(MISS_PULSE.durationMs).toBeGreaterThan(CATCH_PULSE.durationMs * 2)
    expect(MISS_PULSE.intensity).toBeLessThan(CATCH_PULSE.intensity)
  })

  it('sigue siendo un aviso y no un zumbido', () => {
    // Suena en los dos mandos a la vez: pasado de largo o de fuerte, un par de
    // palos escapados seguidos dejarían las manos vibrando sin parar.
    expect(MISS_PULSE.durationMs).toBeLessThanOrEqual(250)
    expect(MISS_PULSE.intensity).toBeGreaterThan(0.1)
  })
})

describe('el toque de un botón', () => {
  it('es el más discreto de los tres', () => {
    // Elegir trece palos son trece pulsaciones seguidas: aquí lo que se pide es
    // notar que el botón respondió, no que pase algo en la partida.
    expect(PRESS_PULSE.durationMs).toBeLessThan(CATCH_PULSE.durationMs)
    expect(PRESS_PULSE.intensity).toBeLessThan(CATCH_PULSE.intensity)
    expect(PRESS_PULSE.intensity).toBeGreaterThan(0)
  })
})

describe('vibración del mando', () => {
  it('golpea el mando que ha atrapado el palo, con la receta que se le pide', () => {
    const pulse = vi.fn(() => Promise.resolve(true))
    const event = fakeController([{ pulse }])

    expect(pulseHaptics(event, CATCH_PULSE)).toBe(true)
    expect(pulse).toHaveBeenCalledWith(CATCH_PULSE.intensity, CATCH_PULSE.durationMs)
  })

  it('usa el primer actuador cuando el mando declara varios', () => {
    const first = vi.fn(() => Promise.resolve(true))
    const second = vi.fn(() => Promise.resolve(true))

    pulseHaptics(fakeController([{ pulse: first }, { pulse: second }]), CATCH_PULSE)

    expect(first).toHaveBeenCalledOnce()
    expect(second).not.toHaveBeenCalled()
  })

  it('con el ratón no vibra nada', () => {
    // En escritorio se juega a clics y el evento no trae puntero de XR: no es
    // un fallo, es que ahí no hay mando que hacer vibrar.
    expect(pulseHaptics({}, CATCH_PULSE)).toBe(false)
    expect(pulseHaptics(undefined, CATCH_PULSE)).toBe(false)
  })

  it('la mano desnuda no vibra', () => {
    // Sin mando no hay `gamepad`: se coge el palo igual, solo que sin golpe.
    const hand = { pointerState: { inputSource: { handedness: 'left' } } }

    expect(pulseHaptics(hand, CATCH_PULSE)).toBe(false)
  })

  it('un mando sin motor de vibración no rompe la captura', () => {
    expect(pulseHaptics(fakeController([]), CATCH_PULSE)).toBe(false)
    // Navegador que expone el actuador pero no la API `pulse` de WebXR.
    expect(pulseHaptics(fakeController([{ playEffect: vi.fn() }]), CATCH_PULSE)).toBe(false)
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

    expect(() => pulseHaptics(broken, CATCH_PULSE)).not.toThrow()
    expect(pulseHaptics(broken, CATCH_PULSE)).toBe(false)
  })

  it('un mando que no devuelve promesa vibra igual', () => {
    // La especificación dice que `pulse()` devuelve una promesa, pero el
    // navegador del visor no es quien la firma: si devuelve otra cosa, el
    // golpe ya se ha dado y no hay rechazo que recoger.
    const mute = fakeController([{ pulse: () => undefined }])

    expect(() => pulseHaptics(mute, CATCH_PULSE)).not.toThrow()
    expect(pulseHaptics(mute, CATCH_PULSE)).toBe(true)
  })

  it('recoge el rechazo del mando en vez de dejar la promesa suelta', () => {
    // Un mando que se niega a vibrar —el visor ha perdido el foco, la sesión se
    // está cerrando— rechaza la promesa. Sin recogerla quedaría un rechazo sin
    // atender por cada palo atrapado.
    const recover = vi.fn()
    const pending = { catch: recover } as unknown as Promise<boolean>

    expect(pulseHaptics(fakeController([{ pulse: () => pending }]), CATCH_PULSE)).toBe(true)
    expect(recover).toHaveBeenCalled()
  })
})

describe('vibración de toda la sesión', () => {
  it('avisa por los dos mandos, que es lo que no tiene el palo perdido', () => {
    // Nadie lo ha tocado: no hay mano a la que cobrarle el fallo, así que el
    // aviso va a las dos.
    const left = vi.fn(() => Promise.resolve(true))
    const right = vi.fn(() => Promise.resolve(true))
    const session = fakeSession(
      fakeInputSource([{ pulse: left }]),
      fakeInputSource([{ pulse: right }]),
    )

    expect(pulseAllHaptics(session, MISS_PULSE)).toBe(2)
    expect(left).toHaveBeenCalledWith(MISS_PULSE.intensity, MISS_PULSE.durationMs)
    expect(right).toHaveBeenCalledWith(MISS_PULSE.intensity, MISS_PULSE.durationMs)
  })

  it('un mando roto no deja mudo al otro', () => {
    // Con un solo mando encendido y el otro agotándose, el aviso tiene que
    // llegar igual por el que funciona.
    const good = vi.fn(() => Promise.resolve(true))
    const session = fakeSession(
      fakeInputSource([
        {
          pulse: () => {
            throw new Error('el mando se está apagando')
          },
        },
      ]),
      fakeInputSource([{ pulse: good }]),
    )

    expect(pulseAllHaptics(session, MISS_PULSE)).toBe(1)
    expect(good).toHaveBeenCalled()
  })

  it('las manos desnudas no cuentan como mando', () => {
    // Jugando con las manos no hay motor que hacer vibrar: el fallo se ve y se
    // oye, como en escritorio.
    const hand = { handedness: 'left' } as unknown as XRInputSource

    expect(pulseAllHaptics(fakeSession(hand), MISS_PULSE)).toBe(0)
  })

  it('sin sesión no ocurre nada', () => {
    // Es el caso de escritorio, donde este mismo aviso corre en cada partida.
    expect(pulseAllHaptics(null, MISS_PULSE)).toBe(0)
    expect(pulseAllHaptics(undefined, MISS_PULSE)).toBe(0)
    expect(pulseAllHaptics(fakeSession(), MISS_PULSE)).toBe(0)
  })
})
