import { describe, expect, it } from 'vitest'
import {
  DRAW_DISTANCE,
  SIGN_PANEL,
  drawSign,
  signScale,
  signAspect,
} from './GoalSign'
import { LINE_HEIGHT } from './canvasPanel'
import { MIN_ANGLE, recordingCanvas, legibilityProblems, type DrawnText } from './legibility'
import {
  VISTA_SIN_GIRAR,
  apartadoDeLaMirada,
  esquinasDelCartel,
  partidaDelCartel,
  poseDelCartel,
  sitioDelCartel,
  type LoQueSeJuega,
} from '../../lib/cartelDeLaMaquina'
import { MACHINE_RADIUS, PLAYER_OFFSET_Z } from '../../lib/gameConfig'
import { CHALLENGE_LIVES, CHALLENGE_SETUP, GAME_MODE_ORDER } from '../../lib/gameMode'
import { REFERENCE_EYE_HEIGHT } from '../../lib/hoopHeight'
import { goalSign, type Goal, type GoalSignView } from '../../lib/goal'
import { EYE_HEIGHTS, eyesAt, letterAngle } from '../../lib/panelReading'
import { maxScore } from '../../lib/scoring'
import { traductorSuave } from '../../lib/textos'
import { xrUiRise } from '../../lib/xrLayout'

/**
 * El cartel de encima del marcador, medido donde se lee de verdad.
 *
 * `cartel.legible.test.ts` mide las frases comunes a todos los juegos; aquí van las de Stick
 * Rush —la misión del reto, las vidas con los palos que quedan, el nombre de cada modo— con sus
 * cifras de cuatro dígitos, y lo que solo se sabe con la máquina delante: cuántos grados ocupa
 * cada letra a su distancia real (97 cm, por debajo de la mirada) y que el cartel entero cabe en
 * lo que se ve sin girar la cabeza, más lejos que cualquier palo.
 */

const IDIOMAS = ['en', 'es'] as const

/** Lo más que se puede sacar en el reto: la cifra más larga que llega al cartel. */
const TECHO = maxScore(CHALLENGE_SETUP.difficulty, CHALLENGE_SETUP.stickCount)

/** Los listones de Stick Rush en el salón, con un récord por encima del oro. */
const OBJETIVO: Goal = {
  medals: { bronze: 1900, silver: 3750, gold: 5200 },
  better: 'higher',
  unit: 'points in challenge',
  record: TECHO - 1,
  mode: 'challenge',
}

function juego(cambios: Partial<LoQueSeJuega>): LoQueSeJuega {
  return {
    objetivo: OBJETIVO,
    gameMode: 'challenge',
    aDos: false,
    gameState: 'playing',
    points: 0,
    lives: CHALLENGE_LIVES,
    resolved: 0,
    stickCount: CHALLENGE_SETUP.stickCount,
    record: TECHO - 1,
    ...cambios,
  }
}

/** Todo lo que el cartel llega a decir en este juego, en ese idioma. */
function vistas(lang: (typeof IDIOMAS)[number]): GoalSignView[] {
  const t = traductorSuave(lang)
  const todas: GoalSignView[] = []
  const decir = (cambios: Partial<LoQueSeJuega>) => {
    const partida = partidaDelCartel(juego(cambios), t)
    if (partida != null) todas.push(goalSign(partida, t))
  }
  for (const objetivo of [OBJETIVO, { ...OBJETIVO, record: 2400 }, { ...OBJETIVO, record: null }, null]) {
    for (const record of [0, 2400, TECHO - 1]) {
      decir({ objetivo, record, gameState: 'countdown' })
      for (const points of [0, 150, 1899, 1900, 3749, 3750, 5199, 5200, TECHO - 1, TECHO]) {
        for (const [lives, resolved] of [[3, 1], [2, 7], [1, 12], [0, 13]]) {
          decir({ objetivo, record, points, lives, resolved })
          decir({ objetivo, record, points, lives, resolved, gameState: 'finished' })
        }
      }
    }
  }
  // Lo que no cuenta para medalla: los otros modos, y el reto a dos.
  for (const gameMode of GAME_MODE_ORDER) decir({ gameMode, lives: gameMode === 'challenge' ? 3 : null, aDos: gameMode === 'challenge' })
  return todas
}

function medir(vista: GoalSignView): DrawnText[] {
  const { ctx, drawnTexts: escritos } = recordingCanvas()
  drawSign(ctx, vista)
  return escritos
}

const SITIO = sitioDelCartel()

/**
 * Los grados que ocupa cada letra del cartel colgado en su sitio, vista desde esos ojos.
 *
 * @param subida cuánto ha subido la interfaz con quien juega (`xrUiRise`).
 */
function gradosDesde(escritos: readonly DrawnText[], ojos: number = REFERENCE_EYE_HEIGHT, subida = 0): number[] {
  const escala = signScale(SITIO.distancia)
  const pose = poseDelCartel({ ...SITIO, position: [SITIO.position[0], SITIO.position[1] + subida, SITIO.position[2]] })
  return escritos.map((escrito) =>
    letterAngle(pose, eyesAt(ojos), escrito.x * escala, escrito.y * escala, (escrito.height / LINE_HEIGHT) * escala),
  )
}

describe('el cartel de encima del marcador se lee', () => {
  it('todo lo que dice cabe y no se pisa, en los dos idiomas', () => {
    for (const lang of IDIOMAS) {
      const todas = vistas(lang)
      expect(todas.length, 'no se ha medido nada').toBeGreaterThan(100)
      for (const vista of todas) {
        const escritos = medir(vista)
        expect(escritos.length, 'no se ha medido nada').toBeGreaterThan(0)
        expect(
          legibilityProblems(escritos, { panel: SIGN_PANEL, distance: DRAW_DISTANCE }),
          `${lang}: ${vista.title} / ${vista.detail}`,
        ).toEqual([])
      }
    }
  })

  it('a su distancia real cada letra ocupa lo mismo que dibujada, y por encima de lo que se lee', () => {
    expect(SITIO.distancia).toBeGreaterThan(0.9)
    expect(SITIO.distancia).toBeLessThan(1)
    for (const lang of IDIOMAS) {
      for (const vista of vistas(lang)) {
        const escritos = medir(vista)
        const grados = gradosDesde(escritos)
        grados.forEach((angulo, i) => {
          const dibujada = (2 * Math.atan(escritos[i].height / LINE_HEIGHT / (2 * DRAW_DISTANCE)) * 180) / Math.PI
          expect(angulo, `${lang}: «${escritos[i].text}»`).toBeGreaterThan(MIN_ANGLE)
          expect(angulo, `${lang}: «${escritos[i].text}»`).toBeCloseTo(dibujada, 1)
        })
      }
    }
  })

  it('lo que se mira mientras se juega —el listón, las vidas y los palos— se lee de un vistazo', () => {
    const t = traductorSuave('es')
    const partida = partidaDelCartel(juego({ points: 2100, lives: 2, resolved: 6 }), t)
    const escritos = medir(goalSign(partida!, t))

    expect(escritos.map((escrito) => escrito.text)).toEqual(['Plata a 3750 · llevas 2100', 'Vidas ♥♥♡ · Palos 7'])
    const [liston, queda] = gradosDesde(escritos)
    // Cuatro cifras en español van sin punto, como en la chapa del salón: la línea no encoge de su 1,4°.
    expect(liston).toBeGreaterThan(1.39)
    expect(queda).toBeGreaterThan(1.15)
  })

  it('la misión encoge para caber y se queda en un grado, como los listones de debajo', () => {
    for (const lang of IDIOMAS) {
      const t = traductorSuave(lang)
      const partida = partidaDelCartel(juego({ gameState: 'countdown' }), t)
      const [mision, listones] = gradosDesde(medir(goalSign(partida!, t)))
      expect(mision, lang).toBeGreaterThan(0.95)
      // Los listones, en inglés con sus comas, se quedan en 0,9°: por encima del mínimo (0,75°).
      expect(listones, lang).toBeGreaterThan(0.9)
    }
  })

  it('la primera vez, el bronce en palos, legible con los ojos a 1,4 y a 1,9 m sin que la interfaz suba', () => {
    for (const lang of IDIOMAS) {
      const t = traductorSuave(lang)
      const partida = partidaDelCartel(juego({ gameState: 'countdown', objetivo: { ...OBJETIVO, record: null }, record: 0 }), t)
      const vista = goalSign(partida!, t)
      expect(vista.detail, lang).toBe(lang === 'es' ? 'Bronce ≈ 13 palos · Oro 5200' : 'Bronze ≈ 13 sticks · Gold 5,200')
      const escritos = medir(vista)
      expect(legibilityProblems(escritos, { panel: SIGN_PANEL, distance: DRAW_DISTANCE }), lang).toEqual([])
      for (const ojos of [1.4, 1.9]) {
        for (const angulo of gradosDesde(escritos, ojos)) expect(angulo, `${lang}, ojos a ${ojos}`).toBeGreaterThan(MIN_ANGLE)
      }
    }
  })

  it('el control: la misión larga, con sus artículos y su «se acaba», no llegaba a leerse', () => {
    const larga = { title: 'Catch all 13 sticks. Three on the floor and it is over', detail: null, bar: null, medal: null, subdued: false }
    expect(gradosDesde(medir(larga))[0]).toBeLessThan(MIN_ANGLE)
    expect(legibilityProblems(medir(larga), { panel: SIGN_PANEL, distance: DRAW_DISTANCE })).not.toEqual([])
  })

  it('juegue quien juegue: la interfaz sube con los ojos y la letra ocupa lo mismo', () => {
    const escritos = medir(vistas('es')[3])
    const deReferencia = gradosDesde(escritos)
    for (const ojos of EYE_HEIGHTS) {
      gradosDesde(escritos, ojos, xrUiRise(ojos)).forEach((angulo, i) => expect(angulo).toBeCloseTo(deReferencia[i], 5))
    }
  })

  it('y si el visor no dice la altura y la interfaz no sube, más alto o más bajo se sigue leyendo', () => {
    for (const lang of IDIOMAS) {
      for (const vista of vistas(lang)) {
        const escritos = medir(vista)
        for (const ojos of [1.4, 1.9]) {
          for (const angulo of gradosDesde(escritos, ojos)) expect(angulo, `${lang}: ${vista.title}`).toBeGreaterThan(MIN_ANGLE)
        }
      }
    }
  })
})

describe('el cartel de verdad, en su sitio', () => {
  it('entero dentro de lo que se ve sin girar la cabeza desde la postura de juego', () => {
    for (const esquina of esquinasDelCartel(signAspect())) {
      expect(apartadoDeLaMirada(esquina)).toBeLessThanOrEqual(VISTA_SIN_GIRAR)
      // Y por debajo de la mirada: no tapa el aro ni los palos que cuelgan de él.
      expect(esquina.y).toBeLessThan(REFERENCE_EYE_HEIGHT - 0.35)
    }
  })

  it('no tapa el blanco: ninguna esquina queda más cerca que el palo más lejano', () => {
    const elPaloMasLejano = MACHINE_RADIUS + PLAYER_OFFSET_Z
    for (const esquina of esquinasDelCartel(signAspect())) {
      expect(Math.hypot(esquina.x, esquina.z)).toBeGreaterThan(elPaloMasLejano + 0.1)
    }
  })

  it('mide a esa distancia lo que mide en el ojo: 24° de ancho por 4,5° de alto', () => {
    const { width: ancho, height: alto } = signAspect()
    const angulo = (metros: number) => (2 * Math.atan(metros / 2) * 180) / Math.PI
    // El ancho se cuenta como la letra, en grados pequeños sumados: de punta a punta son 23,7°.
    expect(angulo(ancho)).toBeGreaterThan(23.5)
    expect(angulo(ancho)).toBeLessThanOrEqual(24)
    expect(angulo(alto)).toBeCloseTo(4.5, 1)
    expect(SIGN_PANEL.width * signScale(SITIO.distancia)).toBeCloseTo(ancho * SITIO.distancia)
  })
})
