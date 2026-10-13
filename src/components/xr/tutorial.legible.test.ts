import { describe, expect, it } from 'vitest'

import {
  MIN_READING_DEGREES,
  sizesOffList,
  textsOnButtons,
  unreadableTexts,
  worstReadingDistance,
  type PanelButton,
} from '../../lib/panelReading'
import { traductor, type TextKey } from '../../lib/textos'
import { FRASES, FRASES_CON_LAS_MANOS, TUTORIAL_STEPS, type TutorialStepKey } from '../../lib/tutorial'
import {
  TUTORIAL_BOTON,
  TUTORIAL_TEXT,
  XR_TUTORIAL_NEXT_OFFSET,
  XR_TUTORIAL_POSITION,
  XR_TUTORIAL_SKIP_OFFSET,
  xrPanelViews,
} from '../../lib/xrLayout'
import { LINE_HEIGHT } from './canvasPanel'
import { recordingCanvas, legibilityProblems, type DrawnText } from './legibility'
import { ALTO_DEL_MANDO } from './mandoDibujado'
import { ALTO_DE_LA_MANO } from './manoDibujada'
import { dibujarElPaso, PANEL_HEIGHT, PANEL_WIDTH, repartoDelPaso } from './XRTutorial'

/**
 * El panel del tutorial, **medido** en vez de mirado.
 *
 * Es donde el español se sale: la frase del agarre ocupa dos renglones en inglés y tres en
 * español, y el gesto que va debajo tiene que bajar con ella o se le mete dentro. Y son dos
 * juegos de frases, uno por forma de jugar —con mando y con las manos desnudas—, así que se
 * recorren los dos pasos por las dos variantes y por los dos idiomas.
 */

const IDIOMAS = ['en', 'es'] as const
const PANEL_MEDIDO = { width: PANEL_WIDTH, height: PANEL_HEIGHT }
/** Desde dónde se lee: el panel delante de los ojos, a tres alturas y con el mundo de pie o no. */
const VISTAS = xrPanelViews(XR_TUTORIAL_POSITION)

const VARIANTES = [
  { nombre: 'con mando', frases: FRASES, conLasManos: false, altoDelGesto: ALTO_DEL_MANDO },
  { nombre: 'con las manos', frases: FRASES_CON_LAS_MANOS, conLasManos: true, altoDelGesto: ALTO_DE_LA_MANO },
] as const

/** Los dos botones de salida, tal como los coloca el panel. */
const BOTONES: readonly (PanelButton & { texto: TextKey })[] = [
  { x: XR_TUTORIAL_NEXT_OFFSET[0], y: XR_TUTORIAL_NEXT_OFFSET[1], ...TUTORIAL_BOTON, texto: 'Next' },
  { x: XR_TUTORIAL_SKIP_OFFSET[0], y: XR_TUTORIAL_SKIP_OFFSET[1], ...TUTORIAL_BOTON, texto: 'Skip tutorial' },
]

interface Momento {
  donde: string
  step: TutorialStepKey
  lang: (typeof IDIOMAS)[number]
  variante: (typeof VARIANTES)[number]
}

function todosLosMomentos(): Momento[] {
  return IDIOMAS.flatMap((lang) =>
    VARIANTES.flatMap((variante) =>
      TUTORIAL_STEPS.map((step) => ({ donde: `${lang} ${variante.nombre} ${step}`, step, lang, variante })),
    ),
  )
}

function pintar({ step, lang, variante }: Momento) {
  const { ctx, drawnTexts: escritos } = recordingCanvas()
  const t = traductor(lang)
  dibujarElPaso(ctx, step, variante.frases, t, variante.conLasManos)
  return { escritos, reparto: repartoDelPaso(ctx, step, variante.frases, t) }
}

/** A qué distancia se miden los problemas: la de lectura del texto que peor se lee. */
function distancia(escritos: readonly DrawnText[]): number {
  return Math.max(...VISTAS.map(({ pose, ojos }) => worstReadingDistance(escritos, pose, ojos, LINE_HEIGHT)))
}

describe('el panel del tutorial se lee', () => {
  it('nada se pisa ni se sale, en los dos idiomas y con mando o sin él', () => {
    for (const momento of todosLosMomentos()) {
      const { escritos } = pintar(momento)
      expect(escritos.length, `${momento.donde}: no se ha medido nada`).toBeGreaterThan(0)
      expect(
        legibilityProblems(escritos, { panel: PANEL_MEDIDO, distance: distancia(escritos) }),
        momento.donde,
      ).toEqual([])
    }
  })

  it(`y cada letra, de un vistazo: ninguna baja de ${MIN_READING_DEGREES}°`, () => {
    for (const momento of todosLosMomentos()) {
      const { escritos } = pintar(momento)
      for (const vista of VISTAS) {
        expect(unreadableTexts(escritos, vista.pose, vista.ojos, LINE_HEIGHT), `${momento.donde}, ${vista.donde}`).toEqual([])
      }
    }
  })

  it('con un tamaño de la lista, sin encogerse para caber', () => {
    const tamanos = Object.values(TUTORIAL_TEXT)
    for (const momento of todosLosMomentos()) {
      expect(sizesOffList(pintar(momento).escritos, LINE_HEIGHT, tamanos), momento.donde).toEqual([])
    }
  })

  it('y la frase no se mete en los botones de abajo', () => {
    for (const momento of todosLosMomentos()) {
      expect(textsOnButtons(pintar(momento).escritos, BOTONES), momento.donde).toEqual([])
    }
  })
})

describe('el reparto del panel sigue a la frase', () => {
  it('el gesto cabe entre la frase y los botones', () => {
    for (const momento of todosLosMomentos()) {
      const { gesto, sueloDeLaFrase } = pintar(momento).reparto
      const medio = momento.variante.altoDelGesto / 2
      expect(gesto + medio, `${momento.donde}: el gesto se mete en la frase`).toBeLessThanOrEqual(sueloDeLaFrase + 1e-9)
      expect(gesto - medio, `${momento.donde}: el gesto se mete en los botones`).toBeGreaterThanOrEqual(
        XR_TUTORIAL_SKIP_OFFSET[1] + TUTORIAL_BOTON.height / 2 - 1e-9,
      )
    }
  })

  it('la frase se ancla por arriba: siempre empieza a la misma altura', () => {
    // Centrada, la que pasa de dos líneas a tres crece hacia arriba y se mete debajo del
    // contador. El español las tiene casi siempre.
    const techos = todosLosMomentos().map((momento) => pintar(momento).reparto.techoDeLaFrase)
    expect(new Set(techos).size).toBe(1)
  })

  it('el control: una frase más larga baja el gesto', () => {
    // El reparto tiene que **seguir a la frase**, no estar escrito a mano. Hoy las dos lenguas
    // caben en los mismos renglones —que es por lo que no se ve sin medirlo—, así que el
    // control se hace con una frase inventada: si el gesto no bajara con ella, tampoco bajaría
    // el día que una traducción gane una línea.
    const { ctx } = recordingCanvas()
    const corta = repartoDelPaso(ctx, 'grab', FRASES, () => 'Grab a stick')
    const larga = repartoDelPaso(
      ctx,
      'grab',
      FRASES,
      () => 'Hold the grip button on a stick and keep your hand closed around it while the machine keeps throwing them at you',
    )
    expect(larga.sueloDeLaFrase).toBeLessThan(corta.sueloDeLaFrase)
    expect(larga.gesto).toBeLessThan(corta.gesto)
  })
})

describe('lo que el panel enseña', () => {
  it('por cuál paso se va, que es lo que dice cuánto queda', () => {
    for (const [indice, step] of TUTORIAL_STEPS.entries()) {
      const { escritos } = pintar({ donde: step, step, lang: 'en', variante: VARIANTES[0] })
      expect(
        escritos.some((escrito) => escrito.text === `${indice + 1}/${TUTORIAL_STEPS.length}`),
        step,
      ).toBe(true)
    }
  })

  it('y los dos botones de salida están siempre', () => {
    // Un paso que no se consiga dejaría a alguien encerrado en él.
    for (const momento of todosLosMomentos()) {
      const { escritos } = pintar(momento)
      const t = traductor(momento.lang)
      for (const boton of BOTONES) {
        expect(escritos.some((escrito) => escrito.text === t(boton.texto)), `${momento.donde}: ${boton.texto}`).toBe(true)
      }
    }
  })

  it('sin paso que enseñar no escribe nada', () => {
    const { ctx, drawnTexts: escritos } = recordingCanvas()
    dibujarElPaso(ctx, null, FRASES, traductor('es'), false)
    expect(escritos).toEqual([])
  })
})
