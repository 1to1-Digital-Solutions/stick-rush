import { describe, expect, it } from 'vitest'
import { dibujarLosNombres } from './XRMenu'
import { ALTO_DE_LINEA } from './canvasPanel'
import { lienzoQueApunta, problemasDeLegibilidad, type Escrito } from './legibilidad'
import { MENU_PANEL } from './XRMenu'
import { GAME_MODE_HINTS, GAME_MODE_ORDER } from '../../lib/gameMode'
import {
  MENU_TEXT,
  XR_MENU_DESK_POSE,
  XR_MENU_HIT,
  XR_MENU_POSE,
  XR_MENU_SPOT,
  type MenuPose,
  xrPanelViews,
} from '../../lib/xrLayout'
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
import { PLAYER_COUNT_HINTS } from '../../lib/duel'

/**
 * Los rótulos del panel del menú, medidos en vez de mirados.
 *
 * En los dos idiomas: el español es más largo y es donde un nombre se sale del
 * panel, se pisa con el de al lado o se encoge hasta no leerse a la distancia a
 * la que se juega. Eso, con el visor puesto, cuesta una sesión de pruebas.
 */

const IDIOMAS = ['en', 'es'] as const
const PANEL_MEDIDO = { width: MENU_PANEL[0], height: MENU_PANEL[1] }

/**
 * Los dos sitios donde se lee el menú: la columna del visor —a metro y medio, a la izquierda,
 * girada y más grande— y delante, sin visor (el salón en escritorio). A tres alturas de ojos y
 * con el mundo de pie o no.
 */
const SITIOS: { nombre: string; pose: MenuPose }[] = [
  { nombre: 'columna del visor', pose: XR_MENU_POSE },
  { nombre: 'escritorio', pose: XR_MENU_DESK_POSE },
]

function vistasDe(pose: MenuPose) {
  return xrPanelViews(pose.position, pose.yaw)
}

/** Lo escrito, a la escala a la que se pinta el panel: la escala del grupo lo agranda todo. */
function aEscala(escritos: readonly Escrito[], escala: number): Escrito[] {
  return escritos.map((e) => ({ ...e, x: e.x * escala, y: e.y * escala, ancho: e.ancho * escala, alto: e.alto * escala }))
}

/** A qué distancia se miden los problemas: la de lectura del texto que peor se lee, con el escorzo. */
function distancia(escritos: readonly Escrito[], pose: MenuPose): number {
  return Math.max(...vistasDe(pose).map(({ pose: vista, ojos }) => worstReadingDistance(escritos, vista, ojos, ALTO_DE_LINEA)))
}

describe('los nombres de las filas del menú se leen', () => {
  it('en los dos idiomas', () => {
    for (const lang of IDIOMAS) {
      for (const gameMode of GAME_MODE_ORDER) {
        const { ctx, escritos } = lienzoQueApunta()
        dibujarLosNombres(ctx, traductor(lang), gameMode)
        expect(escritos.length, 'no se ha medido nada').toBeGreaterThan(0)
        for (const { nombre, pose } of SITIOS) {
          const escalados = aEscala(escritos, pose.scale)
          const panel = { width: PANEL_MEDIDO.width * pose.scale, height: PANEL_MEDIDO.height * pose.scale }
          expect(
            problemasDeLegibilidad(escalados, { panel, distancia: distancia(escalados, pose) }),
            `${lang} ${gameMode}, ${nombre}`,
          ).toEqual([])
        }
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

/** Todo lo que puede escribir el panel: cada modo, y el desafío a dos, en los dos idiomas. */
function todosLosMomentos(): { donde: string; escritos: Escrito[] }[] {
  return IDIOMAS.flatMap((lang) =>
    [...GAME_MODE_ORDER, 'a dos' as const].map((momento) => {
      const gameMode = momento === 'a dos' ? 'challenge' : momento
      const { ctx, escritos } = lienzoQueApunta()
      dibujarLosNombres(ctx, traductor(lang), gameMode, momento === 'a dos' ? 2 : 1)
      return { donde: `${lang} ${momento}`, escritos }
    }),
  )
}

describe('a dos, el menú dice lo que toca', () => {
  it('nombra la fila de contra quién y explica la partida a dos, en los dos idiomas', () => {
    for (const lang of IDIOMAS) {
      const t = traductor(lang)
      const { ctx, escritos } = lienzoQueApunta()
      dibujarLosNombres(ctx, t, 'challenge', 2)
      const textos = escritos.map((e) => e.texto)
      expect(textos, lang).toContain(t('Players'))
      const frase = t(PLAYER_COUNT_HINTS[2])
      expect(escritos.some((e) => frase.startsWith(e.texto.trim())), lang).toBe(true)
    }
  })

  it('y solo en el desafío: en la práctica, a dos no cuenta', () => {
    const { ctx, escritos } = lienzoQueApunta()
    dibujarLosNombres(ctx, traductor('en'), 'practice', 2)
    expect(escritos.map((e) => e.texto)).not.toContain('Players')
  })
})

/**
 * Que cada letra se lea de un vistazo **desde donde se juega**, tal como la apunta el lienzo: el
 * tamaño con que se escribió —encogida incluida—, en su fila y con el escorzo.
 */
describe('cada letra del menú se lee de un vistazo', () => {
  it(`ninguna baja de ${MIN_READING_DEGREES}°, en ningún modo, idioma ni altura de ojos`, () => {
    for (const { donde, escritos } of todosLosMomentos()) {
      for (const { nombre, pose } of SITIOS) {
        for (const vista of vistasDe(pose)) {
          expect(
            unreadableTexts(aEscala(escritos, pose.scale), vista.pose, vista.ojos, ALTO_DE_LINEA),
            `${donde}, ${nombre}, ${vista.donde}`,
          ).toEqual([])
        }
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
    const pequena = [{ ...ultima, alto: 0.022 * ALTO_DE_LINEA }]
    expect(unreadableTexts(pequena, { position: XR_MENU_DESK_POSE.position }, eyesAt(1.6), ALTO_DE_LINEA)).toHaveLength(1)
  })

  it('y en la columna, sin agrandar el panel, el texto no llegaría', () => {
    // El control de la escala: a metro y medio, el panel a su tamaño de diseño no se lee.
    const { escritos } = todosLosMomentos().find(({ donde }) => donde === 'es levels')!
    const fallos = vistasDe(XR_MENU_POSE).flatMap((vista) =>
      unreadableTexts(escritos, vista.pose, vista.ojos, ALTO_DE_LINEA),
    )
    expect(fallos.length).toBeGreaterThan(0)
  })
})
