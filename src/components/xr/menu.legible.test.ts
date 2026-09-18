import { describe, expect, it } from 'vitest'
import { dibujarLosNombres } from './XRMenu'
import { ALTO_DE_LINEA } from './canvasPanel'
import { lienzoQueApunta, problemasDeLegibilidad, type Escrito } from './legibilidad'
import { MENU_PANEL } from './XRMenu'
import { GAME_MODE_HINTS, GAME_MODE_ORDER } from '../../lib/gameMode'
import { MENU_TEXT, XR_MENU_HIT, XR_MENU_POSITION, XR_MENU_SPOT, xrPanelViews } from '../../lib/xrLayout'
import {
  MIN_READING_DEGREES,
  eyesAt,
  noTextOwnsAButton,
  sizesOffList,
  textsOnButtons,
  unreadableTexts,
  worstReadingDistance,
} from '../../lib/panelReading'
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
/** Desde dónde se lee: el panel delante de los ojos, a tres alturas y con el mundo de pie o no. */
const VISTAS = xrPanelViews(XR_MENU_POSITION)

/** A qué distancia se miden los problemas: la de lectura del texto que peor se lee, con el escorzo. */
function distancia(escritos: readonly Escrito[]): number {
  return Math.max(...VISTAS.map(({ pose, ojos }) => worstReadingDistance(escritos, pose, ojos, ALTO_DE_LINEA)))
}

describe('los nombres de las filas del menú se leen', () => {
  it('en los dos idiomas', () => {
    for (const lang of IDIOMAS) {
      for (const gameMode of GAME_MODE_ORDER) {
        const { ctx, escritos } = lienzoQueApunta()
        dibujarLosNombres(ctx, traductor(lang), gameMode)
        expect(escritos.length, 'no se ha medido nada').toBeGreaterThan(0)
        expect(
          problemasDeLegibilidad(escritos, { panel: PANEL_MEDIDO, distancia: distancia(escritos) }),
          `${lang} ${gameMode}`,
        ).toEqual([])
      }
    }
  })

  /**
   * Y lo que se ha venido a arreglar: dentro del visor los modos eran **solo nombres**
   * y lo que los distingue solo lo contaba la pantalla de la web.
   */
  it('dicen qué es el modo elegido', () => {
    for (const lang of IDIOMAS) {
      const t = traductor(lang)
      for (const gameMode of GAME_MODE_ORDER) {
        const { ctx, escritos } = lienzoQueApunta()
        dibujarLosNombres(ctx, t, gameMode)
        const frase = t(GAME_MODE_HINTS[gameMode])
        expect(escritos.some((e) => frase.startsWith(e.texto.trim())), `${lang} ${gameMode}`).toBe(
          true,
        )
      }
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

/** Todo lo que puede escribir el panel: cada modo, en los dos idiomas. */
function todosLosMomentos(): { donde: string; escritos: Escrito[] }[] {
  return IDIOMAS.flatMap((lang) =>
    GAME_MODE_ORDER.map((gameMode) => {
      const { ctx, escritos } = lienzoQueApunta()
      dibujarLosNombres(ctx, traductor(lang), gameMode)
      return { donde: `${lang} ${gameMode}`, escritos }
    }),
  )
}

/**
 * Que cada letra se lea de un vistazo **desde donde se juega**, tal como la apunta el lienzo: el
 * tamaño con que se escribió —encogida incluida—, en su fila y con el escorzo.
 */
describe('cada letra del menú se lee de un vistazo', () => {
  it(`ninguna baja de ${MIN_READING_DEGREES}°, en ningún modo, idioma ni altura de ojos`, () => {
    for (const { donde, escritos } of todosLosMomentos()) {
      for (const vista of VISTAS) {
        expect(unreadableTexts(escritos, vista.pose, vista.ojos, ALTO_DE_LINEA), `${donde}, ${vista.donde}`).toEqual([])
      }
    }
  })

  it('y todas se escriben con un tamaño de la lista, sin encogerse', () => {
    for (const { donde, escritos } of todosLosMomentos()) {
      expect(sizesOffList(escritos, ALTO_DE_LINEA, Object.values(MENU_TEXT)), donde).toEqual([])
    }
  })

  it('y ningún rótulo se mete en un botón: la explicación pasa entre salir y silenciar', () => {
    // Los botones son geometría y el instrumento no los ve. Aquí ningún texto es de un botón, así
    // que cuenta cualquier roce.
    const botones = Object.keys(XR_MENU_HIT).map((nombre) => ({
      x: XR_MENU_SPOT[nombre][0],
      y: XR_MENU_SPOT[nombre][1],
      width: XR_MENU_HIT[nombre][0],
      height: XR_MENU_HIT[nombre][1],
    }))
    for (const { donde, escritos } of todosLosMomentos()) {
      expect(textsOnButtons(escritos, botones, noTextOwnsAButton), donde).toEqual([])
    }
  })

  it('el control: la explicación a 22 mm, abajo del todo, no llegaba', () => {
    const { escritos } = todosLosMomentos().find(({ donde }) => donde === 'es levels')!
    const ultima = escritos.reduce((abajo, e) => (e.y < abajo.y ? e : abajo))
    expect(unreadableTexts([{ ...ultima, alto: 0.022 * ALTO_DE_LINEA }], { position: XR_MENU_POSITION }, eyesAt(1.6), ALTO_DE_LINEA)).toHaveLength(1)
  })
})
