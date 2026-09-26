/**
 * Los nombres de WebXR que la lógica de la web nombra en sus tipos (`haptics.ts`: de qué mano viene
 * un puntero y con qué vibra) y que el `navegador.d.ts` del kit no trae. Solo para comprobar tipos:
 * en el motor no se ejecuta nada de esto (la vibración va por `XRPlayer.vibrar`).
 */
type XRHandedness = 'none' | 'left' | 'right'

interface XRInputSource {
  readonly handedness: XRHandedness
  readonly gamepad?: {
    readonly hapticActuators?: readonly { pulse(value: number, duration: number): Promise<boolean> }[]
  }
}
