import { describe, expect, it } from 'vitest'
import { problemasDeLaSalida, type PanelBox } from './exitCorner'
import { ALTO_DE_LINEA } from '../components/xr/canvasPanel'
import {
  RETAKE_DELTA,
  RETAKE_SECONDS,
  XR_HOOP_DOWN_OFFSET,
  XR_HOOP_UP_OFFSET,
  XR_MENU_EXIT_OFFSET,
  XR_MENU_MUSIC_OFFSET,
  XR_MENU_OPCIONES_OFFSET,
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
  ATENUAR_POR_SEGUNDO,
  MENU_PANEL,
  PALO_TRAS_EL_MENU,
  XR_MENU_POSE,
  opacidadHacia,
  paloTapaElMenu,
  rumbosDelMenu,
  type Vec3,
} from './xrLayout'
import { MIN_EYE_HEIGHT, REFERENCE_EYE_HEIGHT, hoopHeightFor } from './hoopHeight'
import { GRADOS_DEL_MENU, gradosDelFrente } from './plantillaDelMenu'
import { traductor } from './textos'
import { MAX_STICKS, PLAYER_OFFSET_Z, STICK_CORD_LENGTH, STICK_LENGTH, STICK_RADIUS } from './gameConfig'
import { EYE_HEIGHTS } from './panelReading'
import { buildStickLayout } from './stickLayout'
import { SWING_AMPLITUDE } from './stickSwing'

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

  it('mantiene salir y «Más opciones» cada uno en una punta de la fila de abajo', () => {
    // La regla que ya había: son las dos cosas que cuesta caro confundir.
    expect(XR_MENU_EXIT_OFFSET[1]).toBe(XR_MENU_OPCIONES_OFFSET[1])
    expect(separacion(XR_MENU_EXIT_OFFSET, XR_MENU_OPCIONES_OFFSET)).toBeGreaterThan(0.5)
  })

  it('no mete la música en la fila de abajo, que ya está llena', () => {
    // Ahí solo quedaban quince centímetros entre empezar y «Más opciones», que es
    // menos de lo que mide un botón de esquina.
    expect(XR_MENU_MUSIC_OFFSET[1]).not.toBe(XR_MENU_OPCIONES_OFFSET[1])
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
  const nombres = (mode: Parameters<typeof menuLabelsFor>[0], masOpciones = false) =>
    menuLabelsFor(mode, masOpciones).map(({ text }) => text)

  it('desplegadas, la práctica y los niveles nombran todas sus filas, sin la de contra quién', () => {
    expect(menuLabelsFor('practice', true)).toEqual(MENU_LABELS.filter(({ text }) => text !== 'Players'))
    expect(menuLabelsFor('levels', true)).toEqual(MENU_LABELS.filter(({ text }) => text !== 'Players'))
  })

  it('plegadas, como abre el menú, solo lo del modo: en los niveles, su escalera y su velocidad', () => {
    expect(nombres('practice')).toEqual(['Mode'])
    expect(nombres('levels')).toEqual(['Sticks', 'Speed', 'Mode'])
  })

  it('el desafío no nombra filas que no enseña: va fijo, pregunta contra quién y se le da a empezar', () => {
    expect(nombres('challenge')).toEqual(['Mode', 'Players'])
    // Es una partida fija: lo plegado no se enseña aunque se pida.
    expect(nombres('challenge', true)).toEqual(['Mode', 'Players'])
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
  it('dice «Modo» y cuál hay elegido: el que cuenta para medalla se llama por su nombre', () => {
    expect(menuLabelText('Mode', 'challenge', traductor('en'))).toBe('Mode: Challenge')
    expect(menuLabelText('Mode', 'practice', traductor('en'))).toBe('Mode: Practice')
    expect(menuLabelText('Mode', 'levels', traductor('es'))).toBe('Modo: Niveles')
    expect(menuLabelText('Mode', 'challenge', traductor('es'))).toBe('Modo: Reto')
  })

  it('los demás rótulos dicen lo que son, se juegue a lo que se juegue', () => {
    for (const { text } of MENU_LABELS) {
      if (text !== 'Mode') expect(menuLabelText(text, 'challenge', traductor('en'))).toBe(text)
    }
  })
})

describe('el menú del visor nace de frente', () => {
  it(`a ${GRADOS_DEL_MENU}° o menos de la mirada, a metro y medio, y de cara a quien juega`, () => {
    expect(gradosDelFrente(XR_MENU_POSE.position)).toBeLessThanOrEqual(GRADOS_DEL_MENU)
    expect(Math.hypot(XR_MENU_POSE.position[0], XR_MENU_POSE.position[2])).toBeCloseTo(1.5)
    expect(XR_MENU_POSE.yaw).toBeCloseTo(Math.atan2(-XR_MENU_POSE.position[0], -XR_MENU_POSE.position[2]))
  })

  it('el control: a 55°, donde estuvo, no pasaría', () => {
    const a = (55 * Math.PI) / 180
    expect(gradosDelFrente([-Math.sin(a) * 1.5, REFERENCE_EYE_HEIGHT, -Math.cos(a) * 1.5])).toBeGreaterThan(GRADOS_DEL_MENU)
  })
})

describe('los palos que tapan el menú del visor se atenúan', () => {
  /** Lo que se mece el pie del palo colgado, sumado a su grosor: unos tres centímetros. */
  const HOLGURA = STICK_RADIUS + (STICK_CORD_LENGTH + STICK_LENGTH) * SWING_AMPLITUDE

  /** Los puntos de la placa del menú, en las coordenadas de la máquina (quien juega, `PLAYER_OFFSET_Z` atrás). */
  function puntosDeLaPlaca(ojos: number): [number, number, number][] {
    const { position, yaw, scale } = XR_MENU_POSE
    const subida = xrUiRise(ojos)
    const puntos: [number, number, number][] = []
    for (let i = 0; i <= 12; i++) {
      for (let j = 0; j <= 10; j++) {
        const lx = ((i / 12 - 0.5) * MENU_PANEL[0]) * scale
        const ly = ((j / 10 - 0.5) * MENU_PANEL[1]) * scale
        puntos.push([
          position[0] + Math.cos(yaw) * lx,
          position[1] + subida + ly,
          position[2] - Math.sin(yaw) * lx + PLAYER_OFFSET_Z,
        ])
      }
    }
    return puntos
  }

  /** Si el palo que cuelga de ese gancho se cruza con la línea de los ojos a ese punto de la placa. */
  function seCruza(gancho: [number, number, number], ojo: [number, number, number], punto: [number, number, number]): boolean {
    const [gx, gy, gz] = gancho
    const arriba = gy - STICK_CORD_LENGTH
    const abajo = arriba - STICK_LENGTH
    // Donde la línea pasa más cerca del eje del palo, en planta.
    const dx = punto[0] - ojo[0]
    const dz = punto[2] - ojo[2]
    const t = ((gx - ojo[0]) * dx + (gz - ojo[2]) * dz) / (dx * dx + dz * dz)
    if (t <= 0 || t >= 1) return false
    const y = ojo[1] + t * (punto[1] - ojo[1])
    const cerca = Math.hypot(ojo[0] + t * dx - gx, ojo[2] + t * dz - gz)
    return cerca < HOLGURA && y <= arriba + HOLGURA && y >= abajo - HOLGURA
  }

  const CASOS = EYE_HEIGHTS.flatMap((ojos) =>
    Array.from({ length: MAX_STICKS - 4 }, (_, i) => ({ ojos, palos: i + 5 })),
  )

  it('ningún palo que se queda entero se ve por delante de la placa, a ninguna altura ni con ningún número de palos', () => {
    for (const { ojos, palos } of CASOS) {
      const ojo: [number, number, number] = [0, ojos, PLAYER_OFFSET_Z]
      const placa = puntosDeLaPlaca(ojos)
      for (const { anchor } of buildStickLayout(palos, 1, hoopHeightFor({ eyeHeight: ojos }))) {
        if (paloTapaElMenu(anchor)) continue
        expect(
          placa.some((punto) => seCruza(anchor, ojo, punto)),
          `${palos} palos, ojos a ${ojos}: el palo de ${anchor.map((v) => v.toFixed(2)).join(', ')} tapa el menú`,
        ).toBe(false)
      }
    }
  })

  it('y los que se atenúan sí lo tapaban: solo los de ese lado, el frente sigue colgando', () => {
    for (const { ojos, palos } of CASOS) {
      const ojo: [number, number, number] = [0, ojos, PLAYER_OFFSET_Z]
      const placa = puntosDeLaPlaca(ojos)
      const ganchos = buildStickLayout(palos, 1, hoopHeightFor({ eyeHeight: ojos })).map((palo) => palo.anchor)
      const atenuados = ganchos.filter((gancho) => paloTapaElMenu(gancho))
      expect(atenuados.length, `${palos} palos`).toBeGreaterThan(0)
      expect(atenuados.length, `${palos} palos`).toBeLessThanOrEqual(Math.ceil(palos / 2))
      expect(atenuados.some((gancho) => placa.some((punto) => seCruza(gancho, ojo, punto))), `${palos} palos`).toBe(true)
      // Todos del frente a la izquierda, que es donde está la columna: los de la derecha, enteros.
      for (const [x] of atenuados) expect(x).toBeLessThan(0.1)
    }
  })

  it('la placa ocupa de casi el frente a 61° a la izquierda, con el margen', () => {
    const [desde, hasta] = rumbosDelMenu()
    expect(desde).toBeGreaterThan(-3)
    expect(desde).toBeLessThan(0)
    expect(hasta).toBeGreaterThan(60)
    expect(hasta).toBeLessThan(65)
  })

  it('el control: con la columna a la derecha, los palos de la derecha sí taparían', () => {
    const [x, y, z] = XR_MENU_POSE.position
    const aLaDerecha = { ...XR_MENU_POSE, position: [-x, y, z] as Vec3, yaw: -XR_MENU_POSE.yaw }
    const deLaDerecha = buildStickLayout(13, 1).find(({ anchor }) => anchor[0] > 0.3)!
    expect(paloTapaElMenu(deLaDerecha.anchor, aLaDerecha)).toBe(true)
    expect(paloTapaElMenu(deLaDerecha.anchor)).toBe(false)
  })

  it('se atenúan y vuelven poco a poco, en un cuarto de segundo', () => {
    expect(opacidadHacia(1, PALO_TRAS_EL_MENU, 0.1)).toBeCloseTo(0.6)
    expect(opacidadHacia(0.6, PALO_TRAS_EL_MENU, 1)).toBe(PALO_TRAS_EL_MENU)
    expect(opacidadHacia(PALO_TRAS_EL_MENU, 1, 0.1)).toBeCloseTo(0.55)
    expect(opacidadHacia(0.9, 1, 1)).toBe(1)
    expect(opacidadHacia(0.5, 1, -1)).toBe(0.5)
    expect(1 / ATENUAR_POR_SEGUNDO).toBeLessThanOrEqual(0.25)
  })
})
