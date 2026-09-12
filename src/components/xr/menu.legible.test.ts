import { describe, expect, it } from 'vitest'
import { dibujarLosNombres } from './XRMenu'
import { lienzoQueApunta, problemasDeLegibilidad } from './legibilidad'
import { MENU_PANEL } from './XRMenu'
import { traductor } from '../../lib/textos'

/**
 * Los rótulos del panel del menú, medidos en vez de mirados.
 *
 * En los dos idiomas: el español es más largo y es donde un nombre se sale del
 * panel, se pisa con el de al lado o se encoge hasta no leerse a la distancia a
 * la que se juega. Eso, con el visor puesto, cuesta una sesión de pruebas.
 */

const IDIOMAS = ['en', 'es'] as const
const PANEL_MEDIDO = { width: MENU_PANEL[0], height: MENU_PANEL[1] }

describe('los nombres de las filas del menú se leen', () => {
  it('en los dos idiomas', () => {
    for (const lang of IDIOMAS) {
      const { ctx, escritos } = lienzoQueApunta()
      dibujarLosNombres(ctx, traductor(lang))
      expect(escritos.length, 'no se ha medido nada').toBeGreaterThan(0)
      expect(problemasDeLegibilidad(escritos, { panel: PANEL_MEDIDO }), lang).toEqual([])
    }
  })

  /**
   * El control de la propia medida: un panel del que no se leyera nada daría
   * cero problemas igual que uno perfecto. Estrechado a la mitad tiene que cantar.
   */
  it('y la medida se entera cuando no caben', () => {
    const { ctx, escritos } = lienzoQueApunta()
    dibujarLosNombres(ctx, traductor('es'))
    const estrecho = { width: PANEL_MEDIDO.width / 3, height: PANEL_MEDIDO.height }
    expect(problemasDeLegibilidad(escritos, { panel: estrecho }).join(' ')).toContain(
      'se sale del panel',
    )
  })
})
