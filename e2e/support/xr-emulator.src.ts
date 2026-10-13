/**
 * WebXR emulator for the tests, injected into the page before it loads.
 *
 * Chromium does not implement WebXR, so without this there is no way of exercising the
 * immersive mode: the desktop tests go through the mouse path, which is
 * different code. IWER (Immersive Web Emulation Runtime, by Meta) installs a
 * full `navigator.xr` with a Quest 3 and its two controllers, which can be moved and
 * pressed from the test.
 *
 * This file is bundled into an IIFE in `globalSetup` and loaded with
 * `page.addInitScript`. It is test code: it does not go into the app's bundle.
 */
import { XRDevice, directionTo, lookRotation, metaQuest3 } from 'iwer'

type Hand = 'left' | 'right'
type Point = { x: number; y: number; z: number }

const device = new XRDevice(metaQuest3)
// `forceInstall` because Chromium already ships a `navigator.xr` of its own —with no
// headset behind it— and without this IWER steps aside and leaves that one: the menu would ask
// for the headset, it would be told there is none, and there would be no way in.
device.installRuntime({ forceInstall: true })

const controllerOf = (hand: Hand) => {
  const controller = device.controllers[hand]
  if (!controller) throw new Error(`The emulator does not expose the ${hand} controller`)
  return controller
}

const api = {
  /** Is there an immersive session in progress? */
  hasSession: () => device.activeSession != null,

  /** Places the hand at a point of the world (metres, same system as the scene). */
  place(hand: Hand, target: Point) {
    const controller = controllerOf(hand)
    controller.connected = true
    controller.position.set(target.x, target.y, target.z)
  },

  /**
   * Orients the hand so that its ray points at a point.
   *
   * The direction goes from the target towards the hand, not the other way round: `lookRotation`
   * aligns the **+Z** axis with the direction it is given, while in WebXR
   * the controller's ray leaves towards **-Z** of its local space. Without inverting it, the
   * controller points right at the opposite side.
   */
  aim(hand: Hand, target: Point) {
    const controller = controllerOf(hand)
    const backwards = directionTo(target, controller.position)
    const rotation = lookRotation(backwards, { x: 0, y: 1, z: 0 })
    controller.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
  },

  /**
   * Presses a button of the controller. `squeeze` is the grip one (the one that catches sticks) and
   * `trigger` the select one (the ray's, which drives the menu).
   */
  press(hand: Hand, button: 'squeeze' | 'trigger', value = 1) {
    // `setButtonValueImmediate` and not `updateButtonValue`: the second one queues the
    // value for the next frame of the emulator itself, and from a test the
    // pulse is lost. IWER documents this one for programmatic control.
    controllerOf(hand).setButtonValueImmediate(button, value)
  },

  /**
   * Puts the head at that height, in metres above the floor.
   *
   * It is what separates whoever plays standing from whoever plays seated, and the only thing the game
   * looks at to decide whether it lowers the world for them. IWER delivers the head pose inside a
   * space with a floor, so this height is a real stature.
   */
  seat(eyeHeight: number) {
    device.position.y = eyeHeight
  },

  /**
   * Turns the head, in **degrees**: `yaw` to the left and `pitch` upwards, as positive. It is the
   * common convention of the seventeen (`lookToward` of `support/common.ts`).
   *
   * The emulator always enters looking straight ahead; the floor hints, for example, are at the
   * feet. First the heading and then the pitch, which is the order of a head (the `'YXZ'`
   * Euler of three).
   */
  lookAt(yaw: number, pitch = 0) {
    const half = Math.PI / 360
    const cy = Math.cos(yaw * half)
    const sy = Math.sin(yaw * half)
    const cp = Math.cos(pitch * half)
    const sp = Math.sin(pitch * half)
    device.quaternion.set(cy * sp, sy * cp, -sy * sp, cy * cp)
  },

  /**
   * Switches to bare hands: turns the controllers off and the hands on.
   *
   * It is the headset's other input mode, and the one that leaves out whoever has no
   * controllers at hand or cannot hold them. IWER ships them with their joints,
   * so what is tested with this is exactly what the game does with
   * a real hand.
   */
  useHands() {
    for (const controller of [device.controllers.left, device.controllers.right]) {
      if (controller) controller.connected = false
    }
    device.primaryInputMode = 'hand'
    const { left, right } = device.hands
    if (left) {
      left.connected = true
      left.position.set(-0.25, 1.1, -0.4)
    }
    if (right) {
      right.connected = true
      right.position.set(0.25, 1.1, -0.4)
    }
  },

  /** Takes a bare hand to that point of the headset's space. */
  placeBareHand(hand: Hand, target: Point) {
    device.hands[hand]?.position.set(target.x, target.y, target.z)
  },

  /** Brings the thumb and the index finger together or apart: it is the «grab» of a bare hand. */
  pinch(hand: Hand, pressed: boolean) {
    const bareHand = device.hands[hand]
    if (bareHand == null) return
    bareHand.poseId = pressed ? 'pinch' : 'default'
    bareHand.updateHandPose()
    bareHand.updatePinchValue(pressed ? 1 : 0)
  },

  /** Internal state of the emulator, to diagnose tests that do not engage. */
  debug() {
    const session = device.activeSession as unknown as
      | { inputSources?: ArrayLike<unknown> }
      | undefined
    return {
      hasSession: session != null,
      inputSources: session?.inputSources?.length ?? -1,
      controllers: Object.keys(device.controllers ?? {}),
      rightConnected: device.controllers?.right?.connected ?? null,
      primaryInputMode: (device as unknown as { primaryInputMode?: string })
        .primaryInputMode,
    }
  },

  /** Counts the frames the session delivers in `ms` milliseconds. */
  async countSessionFrames(ms: number) {
    const session = device.activeSession
    if (!session) return -1
    let frames = 0
    let running = true
    const tick = () => {
      frames++
      if (running) session.requestAnimationFrame(tick)
    }
    session.requestAnimationFrame(tick)
    await new Promise((resolve) => setTimeout(resolve, ms))
    running = false
    return frames
  },

  /** Closes the session, as when the player takes the headset off. */
  async endSession() {
    await device.activeSession?.end()
  },
}

;(window as unknown as { __xrTest: typeof api }).__xrTest = api
