import { describe, expect, it } from 'vitest'
import {
  XR_ANCHOR_DEADZONE,
  angleDelta,
  approachAngle,
  followRatio,
  initialAnchorState,
  normalizeAngle,
  stepAnchor,
  type AnchorState,
} from './xrAnchor'

/**
 * La interfaz inmersiva tiene que caer siempre dentro del campo de visión.
 *
 * Esto no es cosmético: colgada de `<XROrigin>` en una posición fija, al entrar
 * en el visor aparecía a la espalda del jugador —el −Z del origen lo decide la
 * calibración de la sala, no hacia dónde mire—. No veía el menú, no podía
 * elegir nada y el botón de salir era inalcanzable. Los tests de aquí fijan que
 * eso no vuelva a pasar, y se ejecutan sin navegador ni visor.
 */

/** Simula unos segundos de reencuadre a 90 fps. */
function settle(state: AnchorState, gazeYaw: number, seconds = 3): AnchorState {
  const step = 1 / 90
  let current = state
  for (let t = 0; t < seconds; t += step) {
    current = stepAnchor(current, gazeYaw, step)
  }
  return current
}

describe('aritmética de ángulos', () => {
  it('normaliza cualquier vuelta al rango [−π, π)', () => {
    expect(normalizeAngle(0)).toBeCloseTo(0)
    expect(normalizeAngle(Math.PI * 2)).toBeCloseTo(0)
    expect(normalizeAngle(-Math.PI * 2.5)).toBeCloseTo(-Math.PI / 2)
    // La antípoda es el mismo ángulo por ±π; se resuelve como −π.
    expect(Math.abs(normalizeAngle(Math.PI * 3))).toBeCloseTo(Math.PI)
  })

  it('sobrevive a una cámara que aún no ha dado una pose válida', () => {
    // En el primer frame de la sesión la matriz puede venir sin inicializar.
    expect(normalizeAngle(Number.NaN)).toBe(0)
    expect(normalizeAngle(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('va por el camino corto aunque haya que cruzar por detrás', () => {
    // De 170° a −170° son 20° girando por detrás, no 340° dando la vuelta.
    const from = (170 * Math.PI) / 180
    const to = (-170 * Math.PI) / 180
    expect(Math.abs(angleDelta(from, to))).toBeCloseTo((20 * Math.PI) / 180, 5)
  })

  it('no se pasa de largo al acercarse', () => {
    // Con la fracción al máximo llega justo al objetivo, nunca más allá.
    expect(approachAngle(0, 1, 1)).toBeCloseTo(1)
    expect(approachAngle(0, 1, 0)).toBeCloseTo(0)
    // Fracciones fuera de rango no rompen nada.
    expect(approachAngle(0, 1, 5)).toBeCloseTo(1)
    expect(approachAngle(0, 1, -3)).toBeCloseTo(0)
  })

  it('el reencuadre tarda lo mismo a 72 fps que a 120', () => {
    // Con `factor * delta` a pelo, un visor rápido reencuadraría más despacio
    // que uno lento. La exponencial recorre lo mismo en el mismo tiempo real.
    const slow = settle(initialAnchorState(0), 2, 1)
    const fastStep = 1 / 120
    let fast = initialAnchorState(0)
    for (let t = 0; t < 1; t += fastStep) {
      fast = stepAnchor(fast, 2, fastStep)
    }
    expect(fast.yaw).toBeCloseTo(slow.yaw, 2)
  })

  it('un delta absurdo no dispara el reencuadre más allá del objetivo', () => {
    expect(followRatio(0)).toBe(0)
    expect(followRatio(-1)).toBe(0)
    expect(followRatio(1000)).toBeLessThanOrEqual(1)
  })
})

describe('la interfaz alcanza al jugador mire donde mire', () => {
  it('entrar de espaldas al origen la trae delante', () => {
    // El caso real que rompía el visor: la sesión arranca con el jugador
    // mirando justo al contrario que el −Z del espacio de la sala.
    const anchored = settle(initialAnchorState(0), Math.PI)
    expect(Math.abs(angleDelta(anchored.yaw, Math.PI))).toBeLessThan(
      XR_ANCHOR_DEADZONE,
    )
  })

  it('acaba quieta y alineada, no persiguiendo para siempre', () => {
    const anchored = settle(initialAnchorState(0), Math.PI)
    expect(anchored.following).toBe(false)
    expect(angleDelta(anchored.yaw, Math.PI)).toBeCloseTo(0, 2)
  })

  it('desde cualquier orientación de partida termina de frente', () => {
    for (let deg = -180; deg <= 180; deg += 15) {
      const gaze = (deg * Math.PI) / 180
      const anchored = settle(initialAnchorState(0), gaze)
      expect(Math.abs(angleDelta(anchored.yaw, gaze))).toBeLessThan(
        XR_ANCHOR_DEADZONE,
      )
    }
  })
})

describe('pero no se pega a la cara', () => {
  it('mirar de reojo no la mueve: hay que poder apuntarle', () => {
    // Si la interfaz siguiera la mirada frame a frame, el objetivo huiría del
    // rayo y no habría forma de pulsar un botón.
    const state = initialAnchorState(0)
    const nudged = stepAnchor(state, XR_ANCHOR_DEADZONE * 0.9, 1 / 90)
    expect(nudged).toBe(state)
  })

  it('una vez que arranca, no se detiene en el borde de la zona muerta', () => {
    // Sin histéresis la interfaz se pararía nada más volver a entrar en la zona
    // muerta y quedaría permanentemente torcida en el borde.
    let state = initialAnchorState(0)
    state = stepAnchor(state, Math.PI, 1 / 90)
    expect(state.following).toBe(true)

    const anchored = settle(state, Math.PI)
    expect(anchored.following).toBe(false)
    expect(angleDelta(anchored.yaw, Math.PI)).toBeCloseTo(0, 2)
  })

  it('el giro es progresivo, no un salto', () => {
    // Un tirón instantáneo de 180° marea. En un frame debe recorrer solo una
    // parte del camino.
    const state = stepAnchor(initialAnchorState(0), Math.PI, 1 / 90)
    expect(Math.abs(state.yaw)).toBeGreaterThan(0)
    expect(Math.abs(state.yaw)).toBeLessThan(Math.PI / 2)
  })
})
