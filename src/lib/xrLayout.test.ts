import { describe, expect, it } from 'vitest'
import {
  XR_HOOP_DOWN_OFFSET,
  XR_HOOP_UP_OFFSET,
  XR_MENU_EXIT_OFFSET,
  XR_MENU_MUSIC_OFFSET,
  XR_MENU_SOUND_OFFSET,
  XR_MENU_TUTORIAL_OFFSET,
} from './xrLayout'

/**
 * Del panel del menú solo se puede comprobar sin visor lo que es aritmética:
 * dónde cae cada botón. Importa porque en el visor se apunta a pulso a un
 * metro, y dos botones a pocos centímetros son el mismo botón: se ve dónde
 * apunta el rayo, no dónde acaba la zona sensible.
 *
 * Las medidas son las de las cajas que declara `XRMenu.tsx`: los botones de
 * esquina miden 16 cm de ancho, así que dos centros a menos de esa distancia se
 * pisan de verdad.
 */
const CORNER_BUTTON_WIDTH = 0.16

/** Cuánto hay entre dos botones de la misma fila, de centro a centro. */
function separacion(a: readonly number[], b: readonly number[]): number {
  return Math.abs(a[0] - b[0])
}

describe('las esquinas del panel del menú', () => {
  it('pone el tutorial y la música una en cada punta de la fila del aro', () => {
    expect(XR_MENU_TUTORIAL_OFFSET[1]).toBe(XR_MENU_MUSIC_OFFSET[1])
    expect(XR_MENU_TUTORIAL_OFFSET[0]).toBeLessThan(0)
    expect(XR_MENU_MUSIC_OFFSET[0]).toBeGreaterThan(0)
  })

  it('deja la música lejos de las flechas del aro, que son sus vecinas', () => {
    for (const flecha of [XR_HOOP_UP_OFFSET, XR_HOOP_DOWN_OFFSET]) {
      expect(separacion(XR_MENU_MUSIC_OFFSET, flecha)).toBeGreaterThan(
        CORNER_BUTTON_WIDTH,
      )
    }
  })

  it('mantiene salir y silenciar cada uno en una punta de la fila de abajo', () => {
    // La regla que ya había: son las dos cosas que cuesta caro confundir.
    expect(XR_MENU_EXIT_OFFSET[1]).toBe(XR_MENU_SOUND_OFFSET[1])
    expect(separacion(XR_MENU_EXIT_OFFSET, XR_MENU_SOUND_OFFSET)).toBeGreaterThan(0.5)
  })

  it('no mete la música en la fila de abajo, que ya está llena', () => {
    // Ahí solo quedaban quince centímetros entre empezar y silenciar, que es
    // menos de lo que mide un botón de esquina.
    expect(XR_MENU_MUSIC_OFFSET[1]).not.toBe(XR_MENU_SOUND_OFFSET[1])
  })
})
