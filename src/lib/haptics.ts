import { pulsesFor, type HandSide, type HandPulse, type HapticEvent } from './hapticFeedback'

/**
 * Vibration of the controllers (WebXR haptics).
 *
 * **What vibrates is the contact, and in the hand that touches** (`.claude/rules/xr.md`, "Each
 * contact is felt in the hand that touches, and nothing else"). In this game there is a single
 * contact: **catching a stick**. It is translated into a `grab` of the common recipes
 * (`hapticFeedback.ts`), in the hand that caught it, and with a little more strength if it was
 * caught in extremis, about to touch the ground: that is the one that is celebrated.
 *
 * And what is not contact does not vibrate. **The stick that gets away no longer vibrates**: it
 * used to give a long pulse in both controllers, but no hand has touched it, and the sound and the
 * red stick on the ground already say it. What is kept is the tap of a menu button
 * (`PRESS_PULSE`): it is not a contact with anything of the game, it is the confirmation that the
 * ray has pressed, and it goes in the hand that points.
 *
 * There is nothing to download: the controller's motor is exposed by WebXR itself in
 * `XRInputSource.gamepad.hapticActuators`, an array of actuators with `pulse()`.
 * Outside an immersive session —the mouse on desktop, or a bare hand without a
 * controller— there is no actuator and the game goes on the same, without vibration.
 */

/** A pulse of vibration. */
export interface HapticPulse {
  /** How hard it presses, from 0 (nothing) to 1 (everything the controller gives). */
  intensity: number
  /** How long it lasts, in milliseconds. */
  durationMs: number
}

/**
 * The tap of a button of the immersive menu: just enough to notice that it has
 * been activated.
 *
 * The buttons are pressed **by pointing** with the ray, so the hand touches
 * nothing and there is nothing to confirm the press except whatever changes in
 * the scene, which is sometimes a whole panel changing and sometimes a little
 * stick that lights up on the other side of the menu. Discreet on purpose:
 * choosing thirteen sticks is thirteen presses in a row.
 */
export const PRESS_PULSE: HapticPulse = { intensity: 0.25, durationMs: 18 }

/**
 * From what moment of the fall a stick has been caught **in extremis**: 0 just
 * released, 1 touching the ground (`stickFallProgress`, in time). It is the last fifth of the
 * time, which with the stick accelerating is a little over a third of the distance: the stretch
 * in which it gets away. TO BE CALIBRATED WITH THE HEADSET.
 */
export const IN_EXTREMIS = 0.8

/**
 * How much stronger the stick caught in extremis feels than any other one. It multiplies the
 * intensity of the common `grab` (0.25 → 0.45): it has to feel different without becoming
 * a strike. TO BE CALIBRATED WITH THE HEADSET.
 */
export const IN_EXTREMIS_BOOST = 1.8

/** The contact of catching a stick, told from the hand that catches it. */
export function catchHaptic(hand: HandSide): HapticEvent {
  return { type: 'grab', hand }
}

/**
 * The pulses of catching a stick with that hand, caught at that point of the fall.
 *
 * @param fallProgress how far the stick had fallen when it was caught, from 0 to 1.
 */
export function catchPulses(hand: HandSide, fallProgress: number): HandPulse[] {
  const pulses = pulsesFor(catchHaptic(hand))
  if (!(fallProgress >= IN_EXTREMIS)) return pulses
  return pulses.map((p) => ({ ...p, intensity: Math.min(1, p.intensity * IN_EXTREMIS_BOOST) }))
}

/**
 * The hand that produced a pointer event, if it is from a controller or from an XR hand.
 *
 * The mouse has no hand, and neither does a source without a side (`'none'`): neither of the
 * two can be charged with a contact.
 */
export function eventHand(event: unknown): HandSide | null {
  const handedness = inputSourceOf(event)?.handedness
  return handedness === 'left' || handedness === 'right' ? handedness : null
}

/** The only thing asked of the controller: to give a pulse. */
interface HapticActuator {
  pulse(value: number, duration: number): Promise<boolean>
}

/**
 * The vibration motor of a controller, if there is one.
 *
 * The mouse and bare hands carry no controller, and a controller without a motor
 * (or a browser that does not implement `pulse`) does not vibrate: the three cases
 * are playing without vibration, not a failure.
 *
 * The first actuator is used: headset controllers declare one, and when there
 * are several the first is the one of the controller's body.
 */
function actuatorOf(inputSource: XRInputSource | undefined): HapticActuator | undefined {
  const actuator = inputSource?.gamepad?.hapticActuators?.[0]
  return typeof actuator?.pulse === 'function' ? actuator : undefined
}

/**
 * The controller that fired this event, if there is one.
 *
 * The event arrives from @pmndrs/pointer-events and brings in `pointerState` the
 * state of the pointer that produced it: for an XR controller it is its
 * `XRControllerState`, with the WebXR `inputSource` inside.
 */
function inputSourceOf(event: unknown): XRInputSource | undefined {
  if (typeof event !== 'object' || event == null) return undefined
  const { pointerState } = event as { pointerState?: { inputSource?: XRInputSource } }
  return pointerState?.inputSource
}

/**
 * Is what the controller returned a promise to hold on to?
 *
 * The specification says that `pulse()` returns one, but that is a promise
 * of the browser, not a guarantee: chaining the `catch` to it blindly would turn
 * a controller that returns something else into an error in the middle of a catch.
 */
function isPromise(value: unknown): value is Promise<unknown> {
  return typeof (value as Promise<unknown> | undefined)?.catch === 'function'
}

/**
 * Asks a specific vibration motor for the pulse.
 *
 * The controller refusing to vibrate is a foreseen outcome —the headset has lost
 * focus, the session is closing— and means playing without vibration: the
 * flash and the sound are still there. Its two ways of refusing are handled,
 * because they arrive by different paths: the rejected promise (without the
 * `catch` it would be a loose rejection for each stick caught) and the exception
 * on the spot, which would go up through the grip handler and would indeed take
 * down whatever is left of the catch.
 */
function fire(actuator: HapticActuator, pulse: HapticPulse): boolean {
  try {
    const played: unknown = actuator.pulse(pulse.intensity, pulse.durationMs)
    if (isPromise(played)) void played.catch(() => {})
  } catch {
    return false
  }
  return true
}

/**
 * Makes the controller that fired `event` vibrate.
 *
 * @returns whether the controller got to receive the pulse. With the mouse, with
 *   the bare hand or with a controller without a motor it returns `false` and nothing happens.
 */
export function pulseHaptics(event: unknown, pulse: HapticPulse): boolean {
  const actuator = actuatorOf(inputSourceOf(event))
  if (actuator == null) return false
  return fire(actuator, pulse)
}

/** How a pulse that goes out later is scheduled; `setTimeout` except in the tests. */
export type Schedule = (run: () => void, ms: number) => () => void

const withSetTimeout: Schedule = (run, ms) => {
  const id = setTimeout(run, ms)
  return () => clearTimeout(id)
}

/**
 * Plays some pulses in the controllers of their hand.
 *
 * The ones that carry a `delay` are scheduled; the rest go out on the spot. It returns how to
 * cancel the ones left pending, to call it on unmount: a pulse that went out afterwards
 * would vibrate for something that is no longer there.
 *
 * @param sources the controllers among which to look for each hand's one: the session's, or only
 *   the one that produced the event.
 */
export function playPulses(
  sources: Iterable<XRInputSource | undefined>,
  pulses: readonly HandPulse[],
  schedule: Schedule = withSetTimeout,
): () => void {
  const list = [...sources]
  const pending: (() => void)[] = []
  for (const pulse of pulses) {
    const actuator = actuatorOf(list.find((source) => source?.handedness === pulse.hand))
    if (actuator == null) continue
    const haptic = { intensity: pulse.intensity, durationMs: pulse.ms }
    if (pulse.delay > 0) pending.push(schedule(() => fire(actuator, haptic), pulse.delay))
    else fire(actuator, haptic)
  }
  return () => {
    for (const cancel of pending) cancel()
  }
}

/**
 * Makes their hand feel that it has caught a stick.
 *
 * @returns how to cancel whatever is left pending. With the mouse, the bare hand or a controller
 *   without a motor nothing happens.
 */
export function pulseCatch(event: unknown, fallProgress: number): () => void {
  const hand = eventHand(event)
  if (hand == null) return () => {}
  return playPulses([inputSourceOf(event)], catchPulses(hand, fallProgress))
}
