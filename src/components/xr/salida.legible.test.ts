import { describe, expect, it } from 'vitest'
import { dibujarElAviso } from './XRHud'
import { XR_CONFIRM_SIZE as CONFIRM_SIZE } from '../../lib/xrLayout'
import { lienzoQueApunta, problemasDeLegibilidad } from './legibilidad'
import { traductor } from '../../lib/textos'

/**
 * El aviso de dejar la partida, medido en vez de mirado.
 *
 * Es uno de los dos paneles que el propio `legibilidad.ts` nombra como sitios donde el
 * problema ya pasó —«el texto se superpone», «no se entiende nada»— y no lo medía nadie en
 * este juego. Se mide en los dos idiomas: el español es más largo que el inglés casi
 * siempre, y es donde el texto se sale.
 */

const IDIOMAS = ['en', 'es'] as const

describe('el aviso de dejar la partida', () => {
  it('se lee en los dos idiomas', () => {
    for (const lang of IDIOMAS) {
      const { ctx, escritos } = lienzoQueApunta()
      dibujarElAviso(ctx, traductor(lang))

      expect(escritos.length, 'no se ha medido nada').toBeGreaterThan(0)
      const panel = { width: CONFIRM_SIZE[0], height: CONFIRM_SIZE[1] }
      expect(problemasDeLegibilidad(escritos, { panel }), lang).toEqual([])
    }
  })
})
