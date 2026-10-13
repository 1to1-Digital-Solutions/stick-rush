import { afterEach, describe, expect, it } from 'vitest'
import { dibujarLosNombres } from './XRMenu'
import { LINE_HEIGHT } from './canvasPanel'
import { recordingCanvas, legibilityProblems, type DrawnText } from './legibility'
import { MENU_PANEL } from './XRMenu'
import { GAME_MODE_HINTS, GAME_MODE_ORDER } from '../../lib/gameMode'
import {
  MENU_TEXT,
  MENU_TITLE,
  XR_MENU_DESK_POSE,
  XR_MENU_HIT,
  XR_MENU_OPCIONES_OFFSET,
  XR_MENU_POSE,
  XR_MENU_SPOT,
  type MenuPose,
  xrPanelViews,
} from '../../lib/xrLayout'
import {
  MIN_READING_DEGREES,
  centreInside,
  eyesAt,
  sizesOffList,
  textsOnButtons,
  unreadableTexts,
  worstReadingDistance,
} from '../../lib/panelReading'
import { traductor } from '../../lib/textos'
import { PLAYER_COUNT_HINTS } from '../../lib/duel'
import { MENU_EN } from '../../lib/menuWords'
import { setGameName } from '../../lib/menuTemplate'

/** Plegado, como abre, y desplegado tras «Más opciones». */
const PLEGADOS = [false, true] as const

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
function aEscala(escritos: readonly DrawnText[], escala: number): DrawnText[] {
  return escritos.map((e) => ({ ...e, x: e.x * escala, y: e.y * escala, width: e.width * escala, height: e.height * escala }))
}

/** A qué distancia se miden los problemas: la de lectura del texto que peor se lee, con el escorzo. */
function distancia(escritos: readonly DrawnText[], pose: MenuPose): number {
  return Math.max(...vistasDe(pose).map(({ pose: vista, ojos }) => worstReadingDistance(escritos, vista, ojos, LINE_HEIGHT)))
}

describe('los nombres de las filas del menú se leen', () => {
  it('en los dos idiomas', () => {
    for (const lang of IDIOMAS) {
      for (const gameMode of GAME_MODE_ORDER) {
        for (const masOpciones of PLEGADOS) {
          const { ctx, drawnTexts: escritos } = recordingCanvas()
          dibujarLosNombres(ctx, traductor(lang), gameMode, 1, masOpciones)
          expect(escritos.length, 'no se ha medido nada').toBeGreaterThan(0)
          for (const { nombre, pose } of SITIOS) {
            const escalados = aEscala(escritos, pose.scale)
            const panel = { width: PANEL_MEDIDO.width * pose.scale, height: PANEL_MEDIDO.height * pose.scale }
            expect(
              legibilityProblems(escalados, { panel, distance: distancia(escalados, pose) }),
              `${lang} ${gameMode} ${masOpciones ? 'desplegado' : 'plegado'}, ${nombre}`,
            ).toEqual([])
          }
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
        const { ctx, drawnTexts: escritos } = recordingCanvas()
        dibujarLosNombres(ctx, t, gameMode)
        const frase = t(GAME_MODE_HINTS[gameMode])
        expect(escritos.some((e) => frase.startsWith(e.text.trim())), `${lang} ${gameMode}`).toBe(
          true,
        )
      }
    }
  })

  it('la fila del modo dice «Modo» y cuál hay elegido: el que cuenta para medalla, «Reto»', () => {
    const escrito = (lang: (typeof IDIOMAS)[number], gameMode: (typeof GAME_MODE_ORDER)[number]) => {
      const { ctx, drawnTexts: escritos } = recordingCanvas()
      dibujarLosNombres(ctx, traductor(lang), gameMode)
      return escritos.map((e) => e.text)
    }

    expect(escrito('es', 'challenge')).toContain('Modo: Reto')
    expect(escrito('en', 'challenge')).toContain('Mode: Challenge')
    expect(escrito('es', 'practice')).toContain('Modo: Práctica')
    expect(escrito('es', 'levels')).toContain('Modo: Niveles')
    // Lo que explica debajo empieza por si cuenta para medalla.
    expect(escrito('es', 'challenge').join(' ')).toContain('Cuenta para medalla.')
    expect(escrito('es', 'practice').join(' ')).toContain('Sin medalla.')
  })

  /**
   * El control de la propia medida: un panel del que no se leyera nada daría
   * cero problemas igual que uno perfecto. Estrechado a la mitad tiene que cantar.
   */
  it('y la medida se entera cuando no caben', () => {
    const { ctx, drawnTexts: escritos } = recordingCanvas()
    dibujarLosNombres(ctx, traductor('es'))
    const estrecho = { width: PANEL_MEDIDO.width / 3, height: PANEL_MEDIDO.height }
    expect(legibilityProblems(escritos, { panel: estrecho }).join(' ')).toContain(
      'runs off the panel',
    )
  })
})

/**
 * Todo lo que puede escribir el panel: cada modo, y el desafío a dos, en los dos idiomas, plegado
 * y desplegado.
 */
function todosLosMomentos(): { donde: string; escritos: DrawnText[] }[] {
  return IDIOMAS.flatMap((lang) =>
    [...GAME_MODE_ORDER, 'a dos' as const].flatMap((momento) =>
      PLEGADOS.map((masOpciones) => {
        const gameMode = momento === 'a dos' ? 'challenge' : momento
        const { ctx, drawnTexts: escritos } = recordingCanvas()
        dibujarLosNombres(ctx, traductor(lang), gameMode, momento === 'a dos' ? 2 : 1, masOpciones)
        return { donde: `${lang} ${momento}${masOpciones ? ' desplegado' : ''}`, escritos }
      }),
    ),
  )
}

/**
 * El nombre de la cabina, arriba a la izquierda, como en los demás juegos del salón: antes solo se
 * leía en la portada web. Es un nombre propio: no pasa por `t()`.
 */
describe('el panel dice cómo se llama la cabina', () => {
  afterEach(() => setGameName(null))

  const titulo = (escritos: readonly DrawnText[]) => escritos.find((e) => e.y === MENU_TITLE.y)

  it('en cada modo e idioma, sin traducirlo', () => {
    for (const { donde, escritos } of todosLosMomentos()) {
      expect(titulo(escritos)?.text, donde).toBe('Stick Rush')
    }
  })

  it('el que le da el salón, y uno largo cabe sin encogerse ni pisar nada', () => {
    // El nombre más largo que puede traer una cabina del catálogo, y algo más.
    setGameName('Atrapa los palos que caen del aro')
    for (const { donde, escritos } of todosLosMomentos()) {
      expect(titulo(escritos)?.text, donde).toBe('Atrapa los palos que caen del aro')
      expect(sizesOffList(escritos, LINE_HEIGHT, Object.values(MENU_TEXT)), donde).toEqual([])
      for (const { nombre, pose } of SITIOS) {
        const escalados = aEscala(escritos, pose.scale)
        const panel = { width: PANEL_MEDIDO.width * pose.scale, height: PANEL_MEDIDO.height * pose.scale }
        expect(legibilityProblems(escalados, { panel, distance: distancia(escalados, pose) }), `${donde}, ${nombre}`).toEqual([])
        for (const vista of vistasDe(pose)) {
          expect(unreadableTexts(escalados, vista.pose, vista.ojos, LINE_HEIGHT), `${donde}, ${nombre}, ${vista.donde}`).toEqual([])
        }
      }
    }
  })
})

describe('el botón de «Más opciones»', () => {
  const escrito = (lang: (typeof IDIOMAS)[number], gameMode: (typeof GAME_MODE_ORDER)[number], masOpciones: boolean) => {
    const { ctx, drawnTexts: escritos } = recordingCanvas()
    dibujarLosNombres(ctx, traductor(lang), gameMode, 1, masOpciones)
    return escritos.map((e) => e.text).join(' ')
  }

  it('dice qué hace, en su placa y en los dos idiomas: desplegar o volver a plegar', () => {
    for (const gameMode of ['practice', 'levels'] as const) {
      expect(escrito('en', gameMode, false), gameMode).toContain('More options')
      expect(escrito('es', gameMode, false), gameMode).toContain('Más opciones')
      expect(escrito('en', gameMode, true), gameMode).toContain('Fewer options')
      expect(escrito('es', gameMode, true), gameMode).toContain('Menos opciones')
    }
  })

  it('y con el reto no está: es una partida fija', () => {
    for (const lang of IDIOMAS) {
      for (const masOpciones of PLEGADOS) {
        const dicho = escrito(lang, 'challenge', masOpciones)
        expect(dicho).not.toContain(traductor(lang)(MENU_EN.moreOptions).split(' ')[0])
        expect(dicho).not.toContain(traductor(lang)(MENU_EN.fewerOptions).split(' ')[0])
      }
    }
  })

  it('lo plegado no se nombra hasta que se pide', () => {
    expect(escrito('es', 'practice', false)).not.toContain('Aro')
    expect(escrito('es', 'practice', false)).not.toContain('Velocidad')
    expect(escrito('es', 'practice', true)).toContain('Aro')
    expect(escrito('es', 'practice', true)).toContain('Velocidad')
  })
})

describe('a dos, el menú dice lo que toca', () => {
  it('nombra la fila de contra quién y explica la partida a dos, en los dos idiomas', () => {
    for (const lang of IDIOMAS) {
      const t = traductor(lang)
      const { ctx, drawnTexts: escritos } = recordingCanvas()
      dibujarLosNombres(ctx, t, 'challenge', 2)
      const textos = escritos.map((e) => e.text)
      expect(textos, lang).toContain(t('Players'))
      const frase = t(PLAYER_COUNT_HINTS[2])
      expect(escritos.some((e) => frase.startsWith(e.text.trim())), lang).toBe(true)
    }
  })

  it('y solo en el desafío: en la práctica, a dos no cuenta', () => {
    const { ctx, drawnTexts: escritos } = recordingCanvas()
    dibujarLosNombres(ctx, traductor('en'), 'practice', 2)
    expect(escritos.map((e) => e.text)).not.toContain('Players')
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
            unreadableTexts(aEscala(escritos, pose.scale), vista.pose, vista.ojos, LINE_HEIGHT),
            `${donde}, ${nombre}, ${vista.donde}`,
          ).toEqual([])
        }
      }
    }
  })

  it('y todas se escriben con un tamaño de la lista, sin encogerse', () => {
    for (const { donde, escritos } of todosLosMomentos()) {
      expect(sizesOffList(escritos, LINE_HEIGHT, Object.values(MENU_TEXT)), donde).toEqual([])
    }
  })

  it('y ningún rótulo se mete en un botón: la explicación pasa entre salir y «Más opciones»', () => {
    // Los botones son geometría y el instrumento no los ve. El único texto de un botón es el de
    // «Más opciones», escrito en su placa; en los demás cuenta cualquier roce.
    const [ox, oy] = XR_MENU_OPCIONES_OFFSET
    const esElSuyo: typeof centreInside = (texto, boton) => boton.x === ox && boton.y === oy && centreInside(texto, boton)
    const botones = Object.keys(XR_MENU_HIT).map((nombre) => ({
      x: XR_MENU_SPOT[nombre][0],
      y: XR_MENU_SPOT[nombre][1],
      width: XR_MENU_HIT[nombre][0],
      height: XR_MENU_HIT[nombre][1],
    }))
    for (const { donde, escritos } of todosLosMomentos()) {
      expect(textsOnButtons(escritos, botones, esElSuyo), donde).toEqual([])
    }
  })

  it('el control: la explicación a 22 mm, abajo del todo, no llegaba', () => {
    const { escritos } = todosLosMomentos().find(({ donde }) => donde === 'es levels')!
    const ultima = escritos.reduce((abajo, e) => (e.y < abajo.y ? e : abajo))
    const pequena = [{ ...ultima, height: 0.022 * LINE_HEIGHT }]
    expect(unreadableTexts(pequena, { position: XR_MENU_DESK_POSE.position }, eyesAt(1.6), LINE_HEIGHT)).toHaveLength(1)
  })

  it('y en la columna, sin agrandar el panel, el texto no llegaría', () => {
    // El control de la escala: a metro y medio, el panel a su tamaño de diseño no se lee.
    const { escritos } = todosLosMomentos().find(({ donde }) => donde === 'es levels')!
    const fallos = vistasDe(XR_MENU_POSE).flatMap((vista) =>
      unreadableTexts(escritos, vista.pose, vista.ojos, LINE_HEIGHT),
    )
    expect(fallos.length).toBeGreaterThan(0)
  })
})
