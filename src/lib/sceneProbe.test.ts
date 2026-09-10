import { afterEach, describe, expect, it } from 'vitest'

import { publishStick, stickProbeRequested } from './sceneProbe'

/**
 * La foto de los palos solo existe si alguien la pide.
 *
 * Es lo que separa una sonda de tests de una fuga: la escena escribe noventa
 * veces por segundo, así que tiene que costar cero cuando nadie mira, y no debe
 * dejar rastro en el `window` de un jugador de verdad.
 */

const UN_PALO = { x: 0.1, y: 1.2, z: -0.8, catchable: true }

afterEach(() => {
  delete window.__stickRushSticks
})

describe('la foto de los palos', () => {
  it('nadie la pide: la escena no escribe nada', () => {
    expect(stickProbeRequested()).toBe(false)
    publishStick('1-0', UN_PALO)
    expect('__stickRushSticks' in window).toBe(false)
  })

  it('pedida, publica cada palo por su clave', () => {
    window.__stickRushSticks = {}
    expect(stickProbeRequested()).toBe(true)

    publishStick('1-0', UN_PALO)
    publishStick('1-1', { ...UN_PALO, x: -0.4, catchable: false })

    expect(window.__stickRushSticks).toEqual({
      '1-0': UN_PALO,
      '1-1': { ...UN_PALO, x: -0.4, catchable: false },
    })
  })

  it('el palo que se va borra su clave', () => {
    // Dejarla puesta le diría a quien mire que sigue habiendo un palo ahí,
    // quieto para siempre, y un test iría a cogerlo.
    window.__stickRushSticks = {}
    publishStick('1-0', UN_PALO)
    publishStick('1-0', null)

    expect(window.__stickRushSticks).toEqual({})
  })

  it('sobrevive a que la pidan sin dejar el hueco preparado', () => {
    // `window.__stickRushSticks = undefined` crea la propiedad sin objeto: la
    // sonda está pedida y no hay dónde escribir.
    window.__stickRushSticks = undefined
    publishStick('1-0', UN_PALO)
    expect(window.__stickRushSticks).toEqual({ '1-0': UN_PALO })

    window.__stickRushSticks = undefined
    publishStick('1-0', null)
    expect(window.__stickRushSticks).toEqual({})
  })
})
