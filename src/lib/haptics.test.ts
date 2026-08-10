import { describe, expect, it, vi } from 'vitest'
import { CATCH_PULSE, pulseHaptics } from './haptics'

/**
 * Doble de un mando de WebXR: lo que le llega a la app es el estado del puntero
 * dentro del evento, con el `inputSource` de la sesión colgando.
 */
function fakeController(actuators: unknown[]) {
  return {
    pointerState: { inputSource: { gamepad: { hapticActuators: actuators } } },
  }
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
