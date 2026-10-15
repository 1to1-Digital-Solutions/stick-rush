import { describe, expect, it, vi } from 'vitest'
import {
  IN_EXTREMIS,
  IN_EXTREMIS_BOOST,
  PRESS_PULSE,
  eventHand,
  pulseCatch,
  pulseHaptics,
  catchPulses,
  playPulses,
  catchHaptic,
} from './haptics'
import { HAPTIC_RECIPES, pulsesFor } from './hapticFeedback'

/** Double of a WebXR controller, with the vibration motors it is asked for. */
function fakeInputSource(actuators: unknown[], handedness: XRHandedness = 'right') {
  return { handedness, gamepad: { hapticActuators: actuators } } as unknown as XRInputSource
}

/**
 * Double of a controller event: what reaches the app is the state of the
 * pointer, with the session's `inputSource` hanging from it.
 */
function fakeController(actuators: unknown[], handedness: XRHandedness = 'right') {
  return { pointerState: { inputSource: fakeInputSource(actuators, handedness) } }
}

const CATCH = { intensity: 0.5, durationMs: 20 }

describe('catching a stick, in the hand that catches it', () => {
  it('is a grab of the common recipes', () => {
    expect(catchHaptic('left')).toEqual({ type: 'grab', hand: 'left' })
    expect(catchPulses('left', 0.3)).toEqual(pulsesFor({ type: 'grab', hand: 'left' }))
  })

  it('in extremis it is felt more, without going from a grab to a strike', () => {
    const normal = catchPulses('right', IN_EXTREMIS - 0.01)[0]
    const extreme = catchPulses('right', IN_EXTREMIS)[0]
    expect(extreme.intensity).toBeCloseTo(normal.intensity * IN_EXTREMIS_BOOST, 9)
    expect(extreme.intensity).toBeLessThan(HAPTIC_RECIPES.impact.max)
    expect(extreme.ms).toBe(normal.ms)
    expect(extreme.hand).toBe('right')
  })

  it('a fall that is not a number is treated as any other catch', () => {
    expect(catchPulses('left', Number.NaN)).toEqual(pulsesFor(catchHaptic('left')))
  })
})

describe('which hand an event comes from', () => {
  it('from the controller or from the XR hand, its side', () => {
    expect(eventHand(fakeController([], 'left'))).toBe('left')
    expect(eventHand(fakeController([], 'right'))).toBe('right')
  })

  it('the mouse and what has no side are no hand', () => {
    expect(eventHand({})).toBeNull()
    expect(eventHand(null)).toBeNull()
    expect(eventHand('click')).toBeNull()
    expect(eventHand(fakeController([], 'none'))).toBeNull()
  })
})

describe('playing the pulses', () => {
  it('each pulse goes to the controller of its hand, and only to that one', () => {
    const left = vi.fn(() => Promise.resolve(true))
    const right = vi.fn(() => Promise.resolve(true))
    playPulses(
      [fakeInputSource([{ pulse: left }], 'left'), fakeInputSource([{ pulse: right }], 'right')],
      [{ hand: 'left', intensity: 0.3, ms: 20, delay: 0 }],
    )
    expect(left).toHaveBeenCalledWith(0.3, 20)
    expect(right).not.toHaveBeenCalled()
  })

  it('the ones that carry a delay are scheduled, and can be cancelled', () => {
    const pulse = vi.fn(() => Promise.resolve(true))
    const scheduled: { run: () => void; ms: number }[] = []
    const cancelled = vi.fn()
    const cancel = playPulses(
      [fakeInputSource([{ pulse }], 'left')],
      pulsesFor({ type: 'impact', hand: 'left', strength: 1 }),
      (run, ms) => {
        scheduled.push({ run, ms })
        return cancelled
      },
    )
    // The strike goes out right away; the tail, when the strike ends.
    expect(pulse).toHaveBeenCalledOnce()
    expect(scheduled.map((p) => p.ms)).toEqual([HAPTIC_RECIPES.impact.ms])
    scheduled[0].run()
    expect(pulse).toHaveBeenCalledTimes(2)
    cancel()
    expect(cancelled).toHaveBeenCalledOnce()
  })

  it('with the real setTimeout, cancelling early leaves the tail unplayed', () => {
    vi.useFakeTimers()
    const pulse = vi.fn(() => Promise.resolve(true))
    const cancel = playPulses(
      [fakeInputSource([{ pulse }], 'right')],
      pulsesFor({ type: 'impact', hand: 'right', strength: 0.5 }),
    )
    cancel()
    vi.runAllTimers()
    expect(pulse).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('without a controller in that hand nothing happens', () => {
    const pulse = vi.fn()
    playPulses([undefined, fakeInputSource([{ pulse }], 'left')], [{ hand: 'right', intensity: 1, ms: 10, delay: 0 }])
    expect(pulse).not.toHaveBeenCalled()
  })
})

describe('the real catch, from the grip event', () => {
  it('the controller that caught it vibrates', () => {
    const pulse = vi.fn(() => Promise.resolve(true))
    pulseCatch(fakeController([{ pulse }], 'left'), 0.2)
    expect(pulse).toHaveBeenCalledWith(HAPTIC_RECIPES.grab.intensity, HAPTIC_RECIPES.grab.ms)
  })

  it('with the mouse or the bare hand, nothing', () => {
    expect(() => pulseCatch({}, 0.5)()).not.toThrow()
    const hand = { pointerState: { inputSource: { handedness: 'left' } } }
    expect(() => pulseCatch(hand, 0.5)).not.toThrow()
  })
})

describe('the tap of a button', () => {
  it('is discreet: thirteen in a row are noticed without being a nuisance', () => {
    expect(PRESS_PULSE.durationMs).toBeLessThanOrEqual(30)
    expect(PRESS_PULSE.intensity).toBeLessThanOrEqual(0.3)
    expect(PRESS_PULSE.intensity).toBeGreaterThan(0)
  })
})

describe('vibration of the controller', () => {
  it('pulses the controller that pressed, with the recipe it is asked for', () => {
    const pulse = vi.fn(() => Promise.resolve(true))
    const event = fakeController([{ pulse }])

    expect(pulseHaptics(event, CATCH)).toBe(true)
    expect(pulse).toHaveBeenCalledWith(CATCH.intensity, CATCH.durationMs)
  })

  it('uses the first actuator when the controller declares several', () => {
    const first = vi.fn(() => Promise.resolve(true))
    const second = vi.fn(() => Promise.resolve(true))

    pulseHaptics(fakeController([{ pulse: first }, { pulse: second }]), CATCH)

    expect(first).toHaveBeenCalledOnce()
    expect(second).not.toHaveBeenCalled()
  })

  it('with the mouse nothing vibrates', () => {
    // On desktop the game is played by clicks and the event brings no XR pointer: it is
    // not a failure, there is simply no controller there to make vibrate.
    expect(pulseHaptics({}, CATCH)).toBe(false)
    expect(pulseHaptics(undefined, CATCH)).toBe(false)
  })

  it('the bare hand does not vibrate', () => {
    // Without a controller there is no `gamepad`: the stick is caught all the same, only without a pulse.
    const hand = { pointerState: { inputSource: { handedness: 'left' } } }

    expect(pulseHaptics(hand, CATCH)).toBe(false)
  })

  it('a controller without a vibration motor does not break the catch', () => {
    expect(pulseHaptics(fakeController([]), CATCH)).toBe(false)
    // Browser that exposes the actuator but not the WebXR `pulse` API.
    expect(pulseHaptics(fakeController([{ playEffect: vi.fn() }]), CATCH)).toBe(false)
  })

  it('a controller that blows up on vibrating does not take the catch down with it', () => {
    // The other way the controller has of refusing: instead of rejecting the
    // promise, throwing on the spot. The exception would go up through the grip
    // handler, which is the one thing that cannot happen because of an ornament.
    const broken = fakeController([
      {
        pulse: () => {
          throw new Error('the headset has lost focus')
        },
      },
    ])

    expect(() => pulseHaptics(broken, CATCH)).not.toThrow()
    expect(pulseHaptics(broken, CATCH)).toBe(false)
  })

  it('a controller that does not return a promise vibrates all the same', () => {
    // The specification says that `pulse()` returns a promise, but the
    // headset's browser is not the one who signs it: if it returns something else, the
    // pulse has already been given and there is no rejection to handle.
    const mute = fakeController([{ pulse: () => undefined }])

    expect(() => pulseHaptics(mute, CATCH)).not.toThrow()
    expect(pulseHaptics(mute, CATCH)).toBe(true)
  })

  it('handles the rejection of the controller instead of leaving the promise loose', () => {
    // A controller that refuses to vibrate —the headset has lost focus, the session is
    // closing— rejects the promise. Without handling it there would be an unhandled
    // rejection for each stick caught.
    const recover = vi.fn()
    const pending = { catch: recover } as unknown as Promise<boolean>

    expect(pulseHaptics(fakeController([{ pulse: () => pending }]), CATCH)).toBe(true)
    expect(recover).toHaveBeenCalled()
  })
})
