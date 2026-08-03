/**
 * Emulador WebXR para los tests, inyectado en la página antes de que cargue.
 *
 * Chromium no implementa WebXR, así que sin esto no hay forma de ejercitar el
 * modo inmersivo: los tests de escritorio pasan por el camino del ratón, que es
 * código distinto. IWER (Immersive Web Emulation Runtime, de Meta) instala un
 * `navigator.xr` completo con un Quest 3 y sus dos mandos, que se pueden mover y
 * pulsar desde el test.
 *
 * Este fichero se empaqueta a un IIFE en `globalSetup` y se carga con
 * `page.addInitScript`. Es código de test: no entra en el bundle de la app.
 */
import { XRDevice, directionTo, lookRotation, metaQuest3 } from 'iwer'

type Hand = 'left' | 'right'
type Point = { x: number; y: number; z: number }

const device = new XRDevice(metaQuest3)
device.installRuntime()

const controllerOf = (hand: Hand) => {
  const controller = device.controllers[hand]
  if (!controller) throw new Error(`El emulador no expone el mando ${hand}`)
  return controller
}

const api = {
  /** ¿Hay una sesión inmersiva en curso? */
  hasSession: () => device.activeSession != null,

  /** Coloca la mano en un punto del mundo (metros, mismo sistema que la escena). */
  place(hand: Hand, target: Point) {
    const controller = controllerOf(hand)
    controller.connected = true
    controller.position.set(target.x, target.y, target.z)
  },

  /**
   * Orienta la mano para que su rayo apunte a un punto.
   *
   * La dirección va del objetivo hacia la mano, no al revés: `lookRotation`
   * alinea el eje **+Z** con la dirección que se le pasa, mientras que en WebXR
   * el rayo del mando sale hacia **-Z** de su espacio local. Sin invertirlo, el
   * mando apunta justo al lado contrario.
   */
  aim(hand: Hand, target: Point) {
    const controller = controllerOf(hand)
    const backwards = directionTo(target, controller.position)
    const rotation = lookRotation(backwards, { x: 0, y: 1, z: 0 })
    controller.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
  },

  /**
   * Pulsa un botón del mando. `squeeze` es el de agarre (el que coge palos) y
   * `trigger` el de selección (el del rayo, que maneja el menú).
   */
  press(hand: Hand, button: 'squeeze' | 'trigger', value = 1) {
    // `setButtonValueImmediate` y no `updateButtonValue`: el segundo encola el
    // valor para el siguiente frame del propio emulador, y desde un test se
    // pierde el pulso. IWER documenta este para control programático.
    controllerOf(hand).setButtonValueImmediate(button, value)
  },

  /** Estado interno del emulador, para diagnosticar tests que no enganchan. */
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

  /** Cuenta los frames que entrega la sesión en `ms` milisegundos. */
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

  /** Cierra la sesión, como cuando el jugador se quita el visor. */
  async endSession() {
    await device.activeSession?.end()
  },
}

;(window as unknown as { __xrTest: typeof api }).__xrTest = api
