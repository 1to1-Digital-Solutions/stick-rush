import { afterEach, describe, expect, it } from 'vitest'

import { SCENERIES, readScenery } from './ajustes'
import { OWN_SCENERY_KEY, forgetOwnScenery, sceneryModeOf, sceneryOf } from './sceneryPreference'

/**
 * El escenario del arcade visto desde Stick Rush (`sceneryPreference.ts`).
 *
 * La preferencia y la regla del decorado se prueban con el puente (`ajustes.test.ts` y
 * `ajustesCliente.test.tsx`). Lo que queda aquí es lo que es de este juego: la traducción a
 * `scene` y `passthrough`, y que la clave propia del juego no mande y desaparezca.
 */

afterEach(() => {
  window.localStorage.clear()
})

describe('la traducción en el borde', () => {
  it('el sitio dibujado del arcade es la plaza, y la habitación es el passthrough', () => {
    expect(sceneryModeOf('place')).toBe('scene')
    expect(sceneryModeOf('room')).toBe('passthrough')
  })

  it('va y vuelve sin perder nada', () => {
    for (const scenery of SCENERIES) expect(sceneryOf(sceneryModeOf(scenery))).toBe(scenery)
  })

  it('lo que elige el menú del juego se escribe con los valores del arcade', () => {
    // Escritos a mano: si se escribiera `passthrough` en la clave del arcade, el salón lo leería
    // como basura y volvería al sitio dibujado.
    expect(sceneryOf('scene')).toBe('place')
    expect(sceneryOf('passthrough')).toBe('room')
  })
})

describe('la clave propia del juego', () => {
  it('es la del juego, escrita a mano', () => {
    // Si se apartara, se quedaría sin borrar la de verdad y se borraría una que no existe.
    expect(OWN_SCENERY_KEY).toBe('stick-rush:scenery')
  })

  it('no manda: con ella en passthrough y la del arcade sin poner, se ve la plaza', () => {
    window.localStorage.setItem(OWN_SCENERY_KEY, 'passthrough')

    expect(sceneryModeOf(readScenery(window.localStorage))).toBe('scene')
  })

  it('se borra sin trasladarla a la del arcade', () => {
    window.localStorage.setItem(OWN_SCENERY_KEY, 'passthrough')

    forgetOwnScenery(window.localStorage)

    expect(window.localStorage.getItem(OWN_SCENERY_KEY)).toBeNull()
    expect(window.localStorage.getItem('xrcade:scenery')).toBeNull()
  })

  it('no toca lo que se eligió en el salón', () => {
    window.localStorage.setItem('xrcade:scenery', 'room')

    forgetOwnScenery(window.localStorage)

    expect(readScenery(window.localStorage)).toBe('room')
  })

  it('sin almacenamiento, o con uno que lanza, no revienta', () => {
    const roto = {
      removeItem() {
        throw new Error('bloqueado')
      },
    }

    expect(() => forgetOwnScenery(null)).not.toThrow()
    expect(() => forgetOwnScenery(roto)).not.toThrow()
  })
})
