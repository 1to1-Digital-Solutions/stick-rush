import {
  CombinedPointer,
  createGrabPointer,
  createRayPointer,
} from '@pmndrs/pointer-events'
import {
  BackSide,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
} from 'three'
import { describe, expect, it } from 'vitest'
import {
  DECOR_POINTER_EVENTS,
  MENU_POINTER_ORDER,
  stickPointerEvents,
} from './pointers'
import {
  MACHINE_RADIUS,
  STICK_LENGTH,
  STICK_RADIUS,
} from './gameConfig'

/**
 * That nothing of the machine leaves the controller unable to point at the menu.
 *
 * Reported with the headset on: «sometimes when selecting the config menu it is as if there
 * were an object in front of me and the cursor gets cut off. It is an invisible object I cannot
 * see and it does not let me select the option I want».
 *
 * The invisible object is **a stick already caught**: on catching it, it is switched off with
 * `visible` —it is not unmounted, so as not to throw away its material and have to recompile
 * the shader—, but it still has its `onPointerDown`, and to the pointer system visibility says
 * nothing. Since whoever plays is INSIDE the machine, those sticks hang 57 cm around and the
 * menu is planted at 95 cm: there is always one between the hand and the button.
 *
 * Here the same thing is mounted that the library mounts for each controller of the hall —a
 * grab pointer and a ray combined, the ray by default— with the real parts of
 * `@pmndrs/pointer-events`, with no React nor browser. Opposite, what matters of this scene:
 * the world with a stick, the curtain of the scenery change and a button of the menu.
 */

/** Where the hand is while choosing in the menu: in front of the chest, inside the machine. */
const HAND = [0, 1.2, 0] as const
/** And at what distance the menu panel is planted, in front of the face. */
const MENU_Z = -0.95

interface Setup {
  scene: Scene
  button: Mesh
  stick: Mesh
  curtain: Mesh
  grab: ReturnType<typeof createGrabPointer>
  ray: ReturnType<typeof createRayPointer>
  move: () => void
}

/**
 * The scene, with or without the rules in place.
 *
 * @param withTheRules Whether the world declares itself out of the ray's reach, the stick says
 *   whether it can be caught and the ui goes first in the order.
 * @param catchable    Whether the stick can be caught right now. Caught or in the menu, no.
 */
function mount({
  withTheRules,
  catchable = false,
}: {
  withTheRules: boolean
  catchable?: boolean
}): Setup {
  const scene = new Scene()

  // The world: the machine, the scenery and the curtain of the scenery change.
  const world = new Group()
  if (withTheRules) world.pointerEvents = DECOR_POINTER_EVENTS

  // The curtain: a 35 cm sphere around the head, switched off with `visible`.
  const curtain = new Mesh(
    new SphereGeometry(0.35, 16, 12),
    new MeshBasicMaterial({ side: BackSide }),
  )
  curtain.visible = false
  curtain.position.set(HAND[0], HAND[1], HAND[2])
  world.add(curtain)

  // A stick, hanging between the hand and the panel. When it cannot be caught it is also
  // invisible, because it was already caught: it is exactly the state in which the bug was
  // reported, and listening all the same.
  const wholeStick = new Group()
  wholeStick.visible = catchable
  if (withTheRules) wholeStick.pointerEvents = stickPointerEvents(catchable)
  const stick = new Mesh(
    new CylinderGeometry(STICK_RADIUS, STICK_RADIUS, STICK_LENGTH, 16),
    new MeshBasicMaterial(),
  )
  stick.addEventListener('pointerdown', () => {})
  wholeStick.position.set(HAND[0], HAND[1], HAND[2] - MACHINE_RADIUS)
  wholeStick.add(stick)
  world.add(wholeStick)

  scene.add(world)

  // The immersive ui, with its button in front of the face.
  const ui = new Group()
  if (withTheRules) ui.pointerEventsOrder = MENU_POINTER_ORDER
  const button = new Mesh(new BoxGeometry(0.2, 0.1, 0.02), new MeshBasicMaterial())
  button.position.set(HAND[0], HAND[1], MENU_Z)
  button.addEventListener('pointerdown', () => {})
  ui.add(button)
  scene.add(ui)

  // The controller's space, looking at −Z like WebXR's.
  const controller = new Object3D()
  controller.position.set(...HAND)
  scene.add(controller)
  scene.updateMatrixWorld(true)

  // What the hall mounts for each controller: grab and ray, with the ray by default.
  const camera = new PerspectiveCamera()
  const space = { current: controller }
  const grab = createGrabPointer(() => camera, space, {})
  const ray = createRayPointer(() => camera, space, {}, { minDistance: 0.2 })
  const combined = new CombinedPointer(false)
  combined.register(grab)
  combined.register(ray, true)

  return {
    scene,
    button,
    stick,
    curtain,
    grab,
    ray,
    move: () => combined.move(scene, { timeStamp: performance.now() }),
  }
}

describe('the ray of the controller inside the machine', () => {
  it('without the rule, a stick already caught and invisible keeps the controller', () => {
    // The bug as is. It is left reproduced so that, if one day the library starts skipping
    // what is invisible, this warns that the rule is perhaps not needed instead of carrying on passing emptily.
    const { ray, stick, button, move } = mount({ withTheRules: false })
    move()

    // The ray stops at the stick, at 57 cm, and the button behind it at 95 does not find out.
    expect(ray.getIntersection()?.object).toBe(stick)
    expect(ray.getIntersection()?.object).not.toBe(button)
  })

  it('and one right next to the hand switches the whole ray off: the cursor disappears', () => {
    // Whoever plays is inside the arc of sticks, so the hand ends up next to one. The grab
    // pointer takes as touched at distance zero whatever wraps it and leaves the ray switched
    // off: it is the same thing that broke skeet, with a 39 cm stick instead of a 120 m bubble.
    const setup = mount({ withTheRules: false })
    setup.stick.parent!.position.set(...HAND)
    setup.scene.updateMatrixWorld(true)
    setup.move()

    expect(setup.grab.getEnabled()).toBe(true)
    expect(setup.grab.getIntersection()?.object).toBe(setup.stick)
    expect(setup.grab.getIntersection()?.distance).toBe(0)
    expect(setup.ray.getEnabled()).toBe(false)
  })

  it('with the rule, the ray reaches the button of the menu', () => {
    const { button, grab, ray, move } = mount({ withTheRules: true })
    move()

    expect(ray.getEnabled()).toBe(true)
    expect(ray.getIntersection()?.object).toBe(button)
    expect(grab.getEnabled()).toBe(false)
  })

  it('and with a stick that CAN be caught in front, the button takes the ray all the same', () => {
    // The exit question comes up in the middle of a run, with sticks falling between the hand
    // and the button: there switching the stick off will not do, the order has to win.
    const { button, ray, move } = mount({ withTheRules: true, catchable: true })
    move()

    expect(ray.getEnabled()).toBe(true)
    expect(ray.getIntersection()?.object).toBe(button)
  })

  it('but with nothing of the menu in front, the stick that can be caught is still caught', () => {
    // Denying the ray to the scenery cannot cost the run: the stick switches back on by itself.
    const setup = mount({ withTheRules: true, catchable: true })
    setup.scene.remove(setup.button.parent!)
    setup.move()

    expect(setup.ray.getIntersection()?.object ?? setup.grab.getIntersection()?.object).toBe(
      setup.stick,
    )
  })

  it('and the curtain of the scenery change does not wrap the controller', () => {
    // A 35 cm sphere around the head easily passes the hall's grab filter
    // (half a metre): if one day it listened to anything, it would keep the whole controller.
    const { curtain, grab, ray, move } = mount({ withTheRules: true })
    move()

    expect(grab.getIntersection()?.object).not.toBe(curtain)
    expect(ray.getIntersection()?.object).not.toBe(curtain)
  })
})

describe('the rule of the stick', () => {
  it('switches it on explicitly when it can be caught, because it inherits the «none» of the world', () => {
    expect(stickPointerEvents(true)).toBe('auto')
  })

  it('and switches it off when not', () => {
    expect(stickPointerEvents(false)).toBe('none')
  })
})
