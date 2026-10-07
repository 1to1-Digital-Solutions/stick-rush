import { describe, expect, it } from 'vitest'
import { problemasDeLaSalida, type PanelBox } from './exitCorner'
import { MENU_PANEL } from '../components/xr/XRMenu'
import { ALTO_DE_LINEA } from '../components/xr/canvasPanel'
import {
  RETAKE_DELTA,
  RETAKE_SECONDS,
  XR_HOOP_DOWN_OFFSET,
  XR_HOOP_UP_OFFSET,
  XR_MENU_EXIT_OFFSET,
  XR_MENU_MUSIC_OFFSET,
  XR_MENU_SOUND_OFFSET,
  XR_MENU_TUTORIAL_OFFSET,
  startTracking,
  trackHeight,
  worldRise,
  xrUiRise,
  xrUiRiseOverWorld,
  PISTA_ANCHO,
  PISTA_Y,
  XR_MENU_HIT,
  XR_MENU_SPOT,
  MENU_LABELS,
  MENU_TEXT,
  ROW_LABEL_RISE,
  XR_DIFFICULTY_ROW_Y,
  XR_ENDLESS_TOGGLE_OFFSET,
  XR_MENU_PLAY_HIT,
  XR_MENU_PLAY_OFFSET,
  XR_MODE_TOGGLE_OFFSET,
  XR_ROW_HIT_HEIGHT,
  XR_SCENERY_PICKER_OFFSET,
  XR_STICK_ROW_Y,
  menuLabelsFor,
  menuLabelText,
  XR_PLAYERS_TOGGLE_OFFSET,
  XR_DUEL_POSITION,
  XR_CONFIRM_POSITION,
  XR_HUD_PANEL,
  XR_HUD_POSITION,
  XR_HUD_WITH_SIGN,
  xrHudLayout,
} from './xrLayout'
import { MIN_EYE_HEIGHT } from './hoopHeight'

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

/**
 * Las cajas de pulsación son **invisibles**, así que una que pise a su vecina no se ve:
 * se nota jugando, como una opción del menú que no responde. Es lo que se reportó del
 * visor —«hay objetos invisibles que bloquean opciones del menú»—, y aquí se mide.
 */
describe('las cajas de pulsación del menú no se pisan', () => {
  const NOMBRES = Object.keys(XR_MENU_HIT)

  function caja(nombre: string) {
    const [x, y] = XR_MENU_SPOT[nombre]
    const [ancho, alto] = XR_MENU_HIT[nombre]
    return { x, y, ancho, alto }
  }

  it('ninguna se mete en la de al lado', () => {
    for (let i = 0; i < NOMBRES.length; i++) {
      for (let j = i + 1; j < NOMBRES.length; j++) {
        const a = caja(NOMBRES[i])
        const b = caja(NOMBRES[j])
        const pisa =
          Math.abs(a.x - b.x) * 2 < a.ancho + b.ancho && Math.abs(a.y - b.y) * 2 < a.alto + b.alto
        expect(pisa, `${NOMBRES[i]} pisa a ${NOMBRES[j]}`).toBe(false)
      }
    }
  })

  it('y ninguna cae encima de la línea que explica el modo', () => {
    // La línea va centrada, así que solo se le pueden echar encima los botones que
    // pasen por su banda de x.
    for (const nombre of NOMBRES) {
      const { x, y, ancho, alto } = caja(nombre)
      const enSuAncho = Math.abs(x) * 2 < ancho + PISTA_ANCHO
      const enSuAlto = y - alto / 2 < PISTA_Y
      expect(enSuAncho && enSuAlto, `${nombre} cae sobre la línea del modo`).toBe(false)
    }
  })

  it('todas caben dentro del panel', () => {
    for (const nombre of NOMBRES) {
      const { x, y, ancho, alto } = caja(nombre)
      expect(Math.abs(x) + ancho / 2, `${nombre} se sale por el lado`).toBeLessThanOrEqual(
        MENU_PANEL[0] / 2,
      )
      expect(Math.abs(y) + alto / 2, `${nombre} se sale por arriba o por abajo`).toBeLessThanOrEqual(
        MENU_PANEL[1] / 2,
      )
    }
  })
})

describe('el mundo a la altura de quien juega', () => {
  it('de pie no se mueve nada, mida lo que mida', () => {
    // Es lo que ve quien no ha pedido nada, que son casi todos: la escena
    // exactamente donde ha estado siempre.
    expect(worldRise(1.2, false)).toBe(0)
    expect(worldRise(1.6, false)).toBe(0)
    expect(worldRise(2.0, false)).toBe(0)
  })

  it('sentado, el mundo baja hasta los ojos', () => {
    // Un jugador sentado mide sobre metro veinte de ojos: el mundo tiene que
    // bajar los cuarenta centímetros que le faltan para alcanzarlo.
    expect(worldRise(1.2, true)).toBeCloseTo(-0.4, 10)
  })

  it('a quien es más alto le sube, por lo mismo', () => {
    expect(worldRise(1.8, true)).toBeCloseTo(0.2, 10)
  })

  it('sin medida buena no se inventa nada', () => {
    // Sin suelo en el espacio de referencia, o con el visor sobre la mesa, la
    // cota no es una estatura: se juega con la escena donde estaba.
    for (const cota of [null, undefined, Number.NaN, 0, 5]) {
      expect(worldRise(cota, true)).toBe(0)
    }
  })
})

describe('cuándo se vuelve a medir', () => {
  const paso = (
    state: ReturnType<typeof startTracking>,
    cota: number | null,
    segundos = 1 / 72,
  ) => trackHeight(state, cota, 1, segundos)

  it('la primera medida buena se usa tal cual', () => {
    // Entrar y ver el mundo a la altura de los ojos, no una escena subiendo
    // despacio desde donde sea.
    expect(paso(startTracking(), 1.75).held).toBeCloseTo(1.75, 6)
  })

  it('sin medida buena no se toca nada', () => {
    const inicial = startTracking()

    expect(paso(inicial, null)).toBe(inicial)
    expect(paso(inicial, 0.3)).toBe(inicial)
  })

  it('moverse mientras se juega no mueve el mundo', () => {
    // Ponerse de puntillas o agacharse a por algo: la escena se queda quieta,
    // que si no el objetivo se escapa justo al ir a apuntarlo.
    let state = paso(startTracking(), 1.7)
    for (let t = 0; t < 2; t += 1 / 72) state = paso(state, 1.7 + RETAKE_DELTA * 0.8)

    expect(state.held).toBeCloseTo(1.7, 6)
  })

  it('un cambio grande y corto tampoco', () => {
    let state = paso(startTracking(), 1.7)
    for (let t = 0; t < RETAKE_SECONDS / 2; t += 1 / 72) state = paso(state, 1.2)

    expect(state.held).toBeCloseTo(1.7, 6)
  })

  it('pero sentarse a media partida sí', () => {
    let state = paso(startTracking(), 1.7)
    for (let t = 0; t < RETAKE_SECONDS * 2; t += 1 / 72) state = paso(state, 1.2)

    expect(state.held).toBeCloseTo(1.2, 6)
  })
})

describe('la interfaz cuando el mundo ya se ha movido', () => {
  it('con el mundo quieto, la interfaz se coloca ella sola', () => {
    expect(xrUiRiseOverWorld(1.4, false)).toBeCloseTo(xrUiRise(1.4), 10)
  })

  it('con el mundo bajado, no se corrige otra vez', () => {
    // Sumar las dos correcciones dejaba el menú a la altura de las rodillas,
    // justo para quien menos puede agacharse a buscarlo.
    expect(xrUiRiseOverWorld(1.2, true)).toBe(0)
    expect(xrUiRiseOverWorld(1.9, true)).toBe(0)
  })

  it('sin medida buena no se mueve nada, se pida lo que se pida', () => {
    expect(xrUiRiseOverWorld(null, true)).toBe(0)
    expect(xrUiRiseOverWorld(null, false)).toBe(0)
  })
})


/**
 * Dónde cae la salida, que hasta ahora dependía del juego.
 *
 * La regla —abajo a la derecha, al final de la fila de las acciones— y el porqué están en
 * `exitCorner.ts`, el mismo fichero en los trece. Aquí solo se le da el reparto de ESTE panel,
 * traducido a lo que la regla sabe leer.
 */
describe('la salida', () => {
  const comoCaja = (nombre: string): PanelBox => ({
    x: XR_MENU_SPOT[nombre][0],
    y: XR_MENU_SPOT[nombre][1],
    width: XR_MENU_HIT[nombre][0],
    height: XR_MENU_HIT[nombre][1],
  })

  it('está en la esquina de abajo a la derecha del panel del menú', () => {
    const nombres = Object.keys(XR_MENU_HIT)

    expect(
      problemasDeLaSalida(
        comoCaja('exit'),
        nombres.filter((nombre) => nombre !== 'exit').map(comoCaja),
        { width: MENU_PANEL[0], height: MENU_PANEL[1] },
      ),
    ).toEqual([])
  })
})

describe('los nombres de las filas, según el modo', () => {
  const nombres = (mode: Parameters<typeof menuLabelsFor>[0]) => menuLabelsFor(mode).map(({ text }) => text)

  it('la práctica y los niveles nombran todas sus filas, sin la de contra quién', () => {
    expect(menuLabelsFor('practice')).toEqual(MENU_LABELS.filter(({ text }) => text !== 'Players'))
    expect(menuLabelsFor('levels')).toEqual(MENU_LABELS.filter(({ text }) => text !== 'Players'))
  })

  it('el desafío no nombra filas que no enseña: va fijo, pregunta contra quién y se le da a empezar', () => {
    expect(nombres('challenge')).toEqual(['Hoop', 'Mode', 'Players', 'Around'])
  })

  it('contra quién va en el hueco de sin fin, que el desafío no enseña, y el aviso a dos donde el de salir', () => {
    expect(XR_PLAYERS_TOGGLE_OFFSET).toEqual(XR_ENDLESS_TOGGLE_OFFSET)
    expect(XR_DUEL_POSITION).toEqual(XR_CONFIRM_POSITION)
  })
})

describe('el menú empieza por el modo', () => {
  /** Las filas de arriba abajo, con lo que ocupa en alto la caja más alta de cada una. */
  const filas = [
    {
      nombre: 'modo',
      y: XR_MODE_TOGGLE_OFFSET[1],
      alto: Math.max(XR_MENU_HIT.mode[1], XR_MENU_HIT.endless[1], XR_MENU_HIT.scenery[1]),
    },
    { nombre: 'palos', y: XR_STICK_ROW_Y, alto: XR_ROW_HIT_HEIGHT.sticks },
    { nombre: 'velocidad', y: XR_DIFFICULTY_ROW_Y, alto: XR_ROW_HIT_HEIGHT.difficulty },
    { nombre: 'empezar', y: XR_MENU_PLAY_OFFSET[1], alto: XR_MENU_PLAY_HIT[1] },
  ]

  it('el modo va el primero bajo el aro, y lo que pregunta la práctica, debajo', () => {
    expect(XR_ENDLESS_TOGGLE_OFFSET[1]).toBe(XR_MODE_TOGGLE_OFFSET[1])
    expect(XR_SCENERY_PICKER_OFFSET[1]).toBe(XR_MODE_TOGGLE_OFFSET[1])
    expect(filas.map(({ nombre }) => nombre)).toEqual(
      [...filas].sort((a, b) => b.y - a.y).map(({ nombre }) => nombre),
    )
  })

  it('ninguna caja de una fila se mete en la de debajo', () => {
    for (let i = 1; i < filas.length; i++) {
      const arriba = filas[i - 1]
      const abajo = filas[i]
      expect(arriba.y - arriba.alto / 2, `${arriba.nombre} pisa ${abajo.nombre}`).toBeGreaterThan(
        abajo.y + abajo.alto / 2,
      )
    }
  })

  it('el nombre de los palos no se mete en la fila del modo', () => {
    // Las cajas de la fila del modo son botones de verdad; lo que hay entre las filas de
    // abajo son rótulos que no se pulsan, y eso lo mide `menu.legible.test.ts`.
    // El renglón mide más que la letra: se mide con su alto de línea, como lo apunta el lienzo.
    const techoDelNombre = XR_STICK_ROW_Y + ROW_LABEL_RISE + MENU_TEXT.label / ALTO_DE_LINEA / 2
    expect(techoDelNombre).toBeLessThan(filas[0].y - filas[0].alto / 2)
  })
})

describe('el reparto del marcador', () => {
  it('sin cartel es el de siempre: centrado, con su fila de vidas o estrellas y más alto al acabar', () => {
    expect(xrHudLayout({ finished: false, row: false, sign: false })).toEqual({ height: XR_HUD_PANEL.run, centre: 0, content: 0.04 })
    expect(xrHudLayout({ finished: false, row: true, sign: false }).height).toBeCloseTo(XR_HUD_PANEL.run + XR_HUD_PANEL.livesRow)
    expect(xrHudLayout({ finished: true, row: false, sign: false })).toEqual({ height: XR_HUD_PANEL.finished, centre: 0, content: 0.1 })
    expect(xrHudLayout({ finished: true, row: true, sign: false }).height).toBeCloseTo(XR_HUD_PANEL.finished + XR_HUD_PANEL.livesRow)
  })

  it('con el cartel encima encoge a lo que lleva, y las fichas no se mueven al acabar', () => {
    const jugando = xrHudLayout({ finished: false, row: false, sign: true })
    const acabada = xrHudLayout({ finished: true, row: false, sign: true })

    expect(jugando.height).toBeLessThan(XR_HUD_PANEL.run)
    expect(acabada.height).toBeLessThan(XR_HUD_PANEL.finished)
    expect(acabada.content).toBe(jugando.content)
    // Su borde de arriba es el mismo jugando que acabada: el cartel de encima no se toca.
    expect(acabada.centre + acabada.height / 2).toBeCloseTo(jugando.centre + jugando.height / 2)
    expect(xrHudLayout({ finished: false, row: true, sign: true })).toEqual(jugando)
  })

  it('el panel envuelve lo que lleva: las fichas y la racha, y al acabar los botones', () => {
    // Las fichas (3 cm de radio, crecidas) y los rombos de la racha, 6 cm por encima.
    const fichas = XR_HUD_WITH_SIGN.content
    for (const reparto of [XR_HUD_WITH_SIGN.run, XR_HUD_WITH_SIGN.finished]) {
      expect(reparto.centre + reparto.height / 2).toBeGreaterThan(fichas + 0.06 + 0.012)
      expect(reparto.centre - reparto.height / 2).toBeLessThan(fichas - 0.045)
    }
    // Los botones del final van 12 cm por debajo del marcador y su caja mide 11 de alto.
    expect(XR_HUD_WITH_SIGN.finished.centre - XR_HUD_WITH_SIGN.finished.height / 2).toBeLessThan(-0.12 - 0.055)
    // Y entre las fichas y los botones no se pisan.
    expect(fichas - 0.045).toBeGreaterThan(-0.12 + 0.055)
  })

  it('y no baja más que el de siempre: con el jugador más bajo sigue por encima del suelo', () => {
    const acabada = xrHudLayout({ finished: true, row: false, sign: true })
    const elDeSiempre = xrHudLayout({ finished: true, row: true, sign: false })
    const suelo = (reparto: typeof acabada) => XR_HUD_POSITION[1] + reparto.centre - reparto.height / 2 + xrUiRise(MIN_EYE_HEIGHT)

    expect(suelo(acabada)).toBeGreaterThan(suelo(elDeSiempre))
    expect(suelo(acabada)).toBeGreaterThan(0)
  })
})

describe('el rótulo de la fila del modo', () => {
  it('dice cuál hay elegido, no «Modo»: el que cuenta para medalla se llama por su nombre', () => {
    expect(menuLabelText('Mode', 'challenge')).toBe('Challenge')
    expect(menuLabelText('Mode', 'practice')).toBe('Practice')
    expect(menuLabelText('Mode', 'levels')).toBe('Levels')
  })

  it('los demás rótulos dicen lo que son, se juegue a lo que se juegue', () => {
    for (const { text } of MENU_LABELS) {
      if (text !== 'Mode') expect(menuLabelText(text, 'challenge')).toBe(text)
    }
  })
})
