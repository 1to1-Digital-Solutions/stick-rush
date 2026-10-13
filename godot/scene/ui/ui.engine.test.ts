/**
 * La interfaz de Stick Rush en Godot, medida con el instrumento de la web y pulsada con el ratón.
 *
 * **Medida con lo mismo que la web**: los paneles de aquí apuntan lo que escriben con la letra del
 * motor (`panel.escritos`) y se pasan a los mismos guardianes que los `*.legible.test.ts` de la web
 * —`legibilidad.ts` (nada se pisa ni se sale, ninguna letra por debajo de lo que se lee a su
 * distancia), `panelReading.ts` (cada letra con su escorzo, desde tres alturas de ojos, de pie y con
 * el mundo a los ojos, con el tamaño de su lista y sin meterse en un botón) y `exitCorner.ts` (la
 * salida, abajo a la derecha)—. El menú en la columna del visor y en el sitio de escritorio, en los
 * dos idiomas y en los tres modos; el aviso; el tutorial en sus dos pasos, con mando y con las manos;
 * y la letra del final.
 *
 * **Pulsada con el ratón**: la interfaz entera montada con una cámara de verdad y la partida de
 * `game/run.ts`, y los clics por el mismo `PunteroDeRaton` que en plano.
 *
 * Corre dentro del motor, con los tests de dominio (`npm run godot:build -- --tests`).
 */
import {
  Camera3D,
  Engine,
  InputEventMouseButton,
  InputEventMouseMotion,
  MouseButton,
  Node,
  Node3D,
  OS,
  SceneTree,
  Vector2,
  Vector3,
} from 'godot'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { legibilityProblems } from '@kit/lib/ui/legibility'
import { LINE_HEIGHT, type Escrito, drawnTexts } from '@kit/lib/ui/text'
import { PANEL_DEL_TUTORIAL } from '@kit/lib/ui/tutorial'
import { PointerAim } from '@kit/runtime/ui/pointerAim'

import { LANGS, VOLUME_KEYS } from '@/lib/settings'
import { exitProblems } from '@/lib/exitCorner'
import { DIFFICULTY_ORDER, MAX_STICKS, MIN_STICKS } from '@/lib/gameConfig'
import { CHALLENGE_LIVES, CHALLENGE_SETUP, GAME_MODE_ORDER } from '@/lib/gameMode'
import { VISTA_SIN_GIRAR, apartadoDeLaMirada, esquinasDelCartel, partidaDelCartel, poseDelCartel, sitioDelCartel, type LoQueSeJuega } from '@/lib/machineSign'
import { goalSign, type Goal } from '@/lib/goal'
import { maxScore } from '@/lib/scoring'
import { traductorSuave } from '@/lib/textos'
import { HOOP_ADJUST_STEP } from '@/lib/hoopHeight'
import { centreInside, sizesOffList, textsOnButtons, unreadableTexts, worstReadingDistance, type PanelPose } from '@/lib/panelReading'
import { gameStorage } from '@/lib/storage'
import { setGameName } from '@/lib/menuTemplate'
import { TUTORIAL_STEPS } from '@/lib/tutorial'
import {
  CONFIRM_BOXES,
  CONFIRM_TEXT,
  DUEL_TEXT,
  MENU_TEXT,
  MENU_TITLE,
  TUTORIAL_TEXT,
  XR_DUEL_POSITION,
  XR_DUEL_SIZE,
  XR_CONFIRM_POSITION,
  XR_CONFIRM_SIZE,
  XR_HUD_POSITION,
  XR_MENU_DESK_POSE,
  XR_MENU_HIT,
  XR_MENU_POSE,
  XR_MENU_SPOT,
  XR_TUTORIAL_POSITION,
  XR_HUD_WITH_SIGN,
  xrPanelViews,
  type MenuPose,
} from '@/lib/xrLayout'

import { COUNTDOWN_SECONDS, Partida } from '../game/run'
import { createDuel, duelSummary, recordTurn } from '@/lib/duel'
import { getDuelTally } from '@/lib/duelTally'
import { LANG_KEY, currentLang, volumeLevels } from '@kit/runtime/settings'
import { AvisoDeSalir, PanelDelDuelo } from './notice'
import { CARTEL, Cartel, PROPORCION_DEL_CARTEL } from './sign'
import { InterfazDelJuego, type EscenaDelJuego } from './ui'
import { LETRA_DEL_MARCADOR, Marcador, type EstadoDelMarcador } from './scoreboard'
import { MENU_PANEL, MenuDelJuego, type EstadoDelMenu } from './menu'
import { MEDIDAS_DE_STICK_RUSH, TutorialDelJuego } from './tutorial'

type Vistas = { donde: string; pose: PanelPose; ojos: { x: number; y: number; z: number } }[]

/** Lo que la web mide de un panel: que se lea desde donde se juega con el visor. */
function medir(escritos: readonly Escrito[], panel: { width: number; height: number }, vistas: Vistas): string[] {
  const distancia = Math.max(...vistas.map(({ pose, ojos }) => worstReadingDistance(drawnTexts(escritos), pose, ojos, LINE_HEIGHT)))
  return [
    ...legibilityProblems(escritos, { panel, distance: distancia }),
    ...vistas.flatMap(({ pose, ojos, donde }) => unreadableTexts(drawnTexts(escritos), pose, ojos, LINE_HEIGHT).map((p) => `${donde}: ${p}`)),
  ]
}

/** Lo escrito en un panel escalado, como lo mide `menu.legible.test.ts` (`aEscala`). */
function aEscala(escritos: readonly Escrito[], k: number): Escrito[] {
  return escritos.map((e) => ({ ...e, x: e.x * k, y: e.y * k, ancho: e.ancho * k, alto: e.alto * k }))
}

const nada = () => {}

function estadoDelMenu(cambios: Partial<EstadoDelMenu> = {}): EstadoDelMenu {
  return {
    lang: 'en',
    modo: 'practice',
    dificultad: 'easy',
    palos: MIN_STICKS,
    sinFin: false,
    nivel: 1,
    abierto: 1,
    estrellas: Array.from({ length: 15 }, () => 0 as const),
    ajusteDelAro: 0,
    habitacion: false,
    escenario: 'scene',
    jugadores: 1,
    masOpciones: false,
    ...cambios,
  }
}

describe('el menú mide lo que la web', () => {
  const menu = new MenuDelJuego(
    {
      siguienteModo: nada,
      elegirDificultad: nada,
      elegirPalos: nada,
      alternarSinFin: nada,
      alternarJugadores: nada,
      alternarOpciones: nada,
      elegirNivel: nada,
      elegirEscenario: nada,
      moverElAro: nada,
      verElTutorial: nada,
      jugar: nada,
      salir: nada,
    },
    new PointerAim(),
  )
  const SITIOS: { nombre: string; pose: MenuPose }[] = [
    { nombre: 'columna del visor', pose: XR_MENU_POSE },
    { nombre: 'escritorio', pose: XR_MENU_DESK_POSE },
  ]

  it('los nombres de las filas y la explicación del modo, en los dos idiomas', () => {
    menu.pintar(estadoDelMenu({ lang: 'es', masOpciones: true }))
    const textos = menu.panel.escritos.map((e) => e.texto)
    // La fila del modo dice «Modo» y cuál hay elegido, y su explicación empieza por si da medalla.
    expect(textos).toEqual(expect.arrayContaining(['Aro', 'Palos', 'Velocidad', 'Modo: Práctica', 'Alrededor', 'Menos']))
    expect(textos.some((t) => t.startsWith('Sin medalla. Caen todos'))).toBe(true)
    // Plegado, como abre: el modo y el botón de «Más opciones».
    menu.pintar(estadoDelMenu({ lang: 'es' }))
    expect(menu.panel.escritos.map((e) => e.texto)).toEqual(expect.arrayContaining(['Modo: Práctica', 'Más', 'opciones']))
    expect(menu.panel.escritos.map((e) => e.texto)).not.toContain('Aro')
    // El desafío va fijo: sin las filas que no se eligen, sin sus nombres y sin «Más opciones».
    menu.pintar(estadoDelMenu({ modo: 'challenge', masOpciones: true }))
    expect(menu.panel.escritos.map((e) => e.texto)).not.toContain('Sticks')
    expect(menu.panel.escritos.map((e) => e.texto)).not.toContain('Hoop')
    expect(menu.panel.escritos.map((e) => e.texto)).not.toContain('More')
    expect(menu.panel.escritos.map((e) => e.texto)).toContain('Mode: Challenge')
    menu.pintar(estadoDelMenu({ lang: 'es', modo: 'challenge' }))
    expect(menu.panel.escritos.map((e) => e.texto)).toContain('Modo: Reto')
    expect(menu.panel.escritos.some((e) => e.texto.startsWith('Cuenta para medalla.'))).toBe(true)
  })

  it('se lee en la columna del visor y en escritorio, en cada idioma y modo, sin tamaños fuera de la lista', () => {
    for (const lang of LANGS) {
      for (const [modo, jugadores] of [...GAME_MODE_ORDER.map((m) => [m, 1] as const), ['challenge', 2] as const]) {
        for (const masOpciones of [false, true]) {
          menu.pintar(estadoDelMenu({ lang, modo, jugadores, masOpciones }))
          const escritos = menu.panel.escritos
          const donde = `${lang} ${modo}${masOpciones ? ' desplegado' : ''}`
          expect(sizesOffList(drawnTexts(escritos), LINE_HEIGHT, Object.values(MENU_TEXT)), donde).toEqual([])
          for (const { nombre, pose } of SITIOS) {
            const escalados = aEscala(escritos, pose.scale)
            const panel = { width: MENU_PANEL[0] * pose.scale, height: MENU_PANEL[1] * pose.scale }
            expect(medir(escalados, panel, xrPanelViews(pose.position, pose.yaw)), `${donde}, ${nombre}`).toEqual([])
          }
        }
      }
    }
  })

  it('a dos: la fila de contra quién con su nombre y la explicación de la partida a dos', () => {
    menu.pintar(estadoDelMenu({ lang: 'es', modo: 'challenge', jugadores: 2 }))
    const textos = menu.panel.escritos.map((e) => e.texto)
    expect(textos).toContain('Jugadores')
    expect(textos.some((t) => t.startsWith('Pasaos el mando'))).toBe(true)
    menu.pintar(estadoDelMenu({ lang: 'es', modo: 'practice', jugadores: 2 }))
    expect(menu.panel.escritos.map((e) => e.texto)).not.toContain('Jugadores')
  })

  it('ningún rótulo se mete en un botón de la web', () => {
    const botones = Object.keys(XR_MENU_HIT).map((id) => ({ x: XR_MENU_SPOT[id][0], y: XR_MENU_SPOT[id][1], width: XR_MENU_HIT[id][0], height: XR_MENU_HIT[id][1] }))
    // El único texto de un botón es el nombre de «Más opciones», escrito en su placa.
    const [ox, oy] = XR_MENU_SPOT.opciones
    const esElSuyo: typeof centreInside = (texto, boton) => boton.x === ox && boton.y === oy && centreInside(texto, boton)
    for (const lang of LANGS) {
      for (const modo of GAME_MODE_ORDER) {
        for (const masOpciones of [false, true]) {
          menu.pintar(estadoDelMenu({ lang, modo, masOpciones }))
          expect(textsOnButtons(drawnTexts(menu.panel.escritos), botones, esElSuyo), `${lang} ${modo}`).toEqual([])
        }
      }
    }
  })

  it('el nombre de la cabina, arriba a la izquierda y sin traducir; uno largo cabe sin encogerse', () => {
    const titulo = () => menu.panel.escritos.find((e) => e.y === MENU_TITLE.y)?.texto
    for (const lang of LANGS) {
      menu.pintar(estadoDelMenu({ lang }))
      expect(titulo(), lang).toBe('Stick Rush')
    }
    setGameName('Atrapa los palos que caen del aro')
    try {
      for (const lang of LANGS) {
        for (const masOpciones of [false, true]) {
          menu.pintar(estadoDelMenu({ lang, masOpciones }))
          const escritos = menu.panel.escritos
          expect(titulo(), lang).toBe('Atrapa los palos que caen del aro')
          expect(sizesOffList(drawnTexts(escritos), LINE_HEIGHT, Object.values(MENU_TEXT)), lang).toEqual([])
          const pose = XR_MENU_POSE
          const panel = { width: MENU_PANEL[0] * pose.scale, height: MENU_PANEL[1] * pose.scale }
          expect(medir(aEscala(escritos, pose.scale), panel, xrPanelViews(pose.position, pose.yaw)), lang).toEqual([])
        }
      }
    } finally {
      setGameName(null)
    }
  })

  it('la salida, abajo a la derecha: la última de su fila y nada por debajo', () => {
    const salida = menu.boton('exit').caja
    const resto = [...menu.botones.values()].filter((b) => b.id !== 'exit').map((b) => b.caja)
    expect(exitProblems(salida, resto, { width: MENU_PANEL[0], height: MENU_PANEL[1] })).toEqual([])
  })

  it('lo de la práctica y lo de alrededor, tras «Más opciones»; con el reto, ni el botón', () => {
    menu.pintar(estadoDelMenu())
    expect([menu.boton('sticks:5').nodo.visible, menu.boton('hoopUp').nodo.visible, menu.boton('scenery:scene').nodo.visible]).toEqual([false, false, false])
    expect(menu.boton('opciones').nodo.visible).toBe(true)
    menu.pintar(estadoDelMenu({ masOpciones: true }))
    expect([menu.boton('sticks:5').nodo.visible, menu.boton('hoopUp').nodo.visible, menu.boton('scenery:scene').nodo.visible]).toEqual([true, true, true])
    menu.pintar(estadoDelMenu({ modo: 'challenge', masOpciones: true }))
    expect([menu.boton('opciones').nodo.visible, menu.boton('hoopUp').nodo.visible, menu.boton('players').nodo.visible]).toEqual([false, false, true])
  })

  it('solo la práctica pregunta palos y velocidad; los niveles, su escalera; y lo apagado no se pulsa', () => {
    menu.pintar(estadoDelMenu({ masOpciones: true }))
    expect(menu.boton('sticks:5').nodo.visible && menu.boton('difficulty:easy').nodo.visible && !menu.boton('level:1').nodo.visible).toBe(true)
    expect([menu.boton('sticks:4').apagado, menu.boton(`sticks:${MAX_STICKS}`).apagado]).toEqual([true, false])
    expect(menu.boton('scenery:passthrough').apagado).toBe(true)
    menu.pintar(estadoDelMenu({ modo: 'levels', abierto: 3, nivel: 2, masOpciones: true }))
    expect([menu.boton('sticks:5').nodo.visible, menu.boton('level:1').nodo.visible, menu.boton('level:3').apagado, menu.boton('level:4').apagado]).toEqual([
      false,
      true,
      false,
      true,
    ])
    expect(DIFFICULTY_ORDER.filter((d) => !menu.boton(`difficulty:${d}`).apagado)).toEqual(['easy'])
    menu.pintar(estadoDelMenu({ modo: 'challenge' }))
    expect([menu.boton('difficulty:easy').nodo.visible, menu.boton('endless').nodo.visible]).toEqual([false, false])
    // Contra quién, solo en el desafío, en el hueco de sin fin.
    expect(menu.boton('players').nodo.visible).toBe(true)
    menu.pintar(estadoDelMenu({ modo: 'practice' }))
    expect(menu.boton('players').nodo.visible).toBe(false)
    menu.pintar(estadoDelMenu({ ajusteDelAro: 0.2, masOpciones: true }))
    expect([menu.boton('hoopUp').apagado, menu.boton('hoopDown').apagado]).toEqual([true, false])
  })
})

describe('el aviso, el tutorial y el final miden lo que la web', () => {
  it('el aviso de dejar la partida, en los dos idiomas', () => {
    const aviso = new AvisoDeSalir({ dejar: nada, seguir: nada }, new PointerAim())
    const botones = Object.values(CONFIRM_BOXES).map(({ position, size }) => ({ x: position[0], y: position[1], width: size[0], height: size[1] }))
    for (const lang of LANGS) {
      aviso.escribir(lang)
      const escritos = aviso.panel.escritos
      expect(medir(escritos, { width: XR_CONFIRM_SIZE[0], height: XR_CONFIRM_SIZE[1] }, xrPanelViews(XR_CONFIRM_POSITION)), lang).toEqual([])
      expect(sizesOffList(drawnTexts(escritos), LINE_HEIGHT, Object.values(CONFIRM_TEXT)), lang).toEqual([])
      expect(textsOnButtons(drawnTexts(escritos), botones), lang).toEqual([])
    }
    aviso.nodo.free()
  })

  it('el tutorial, en sus pasos, con mando y con las manos, en los dos idiomas', () => {
    const tutorial = new TutorialDelJuego({ siguiente: nada, saltar: nada }, new PointerAim())
    expect(MEDIDAS_DE_STICK_RUSH.boton.width).toBe(0.33)
    for (const lang of LANGS) {
      for (const manos of [false, true]) {
        for (const paso of TUTORIAL_STEPS) {
          tutorial.actualizar(paso, lang, manos, 0.016)
          const escritos = tutorial.vista.panel.escritos
          const donde = `${lang} ${manos ? 'manos' : 'mando'} ${paso}`
          expect(medir(escritos, PANEL_DEL_TUTORIAL, xrPanelViews(XR_TUTORIAL_POSITION)), donde).toEqual([])
          expect(sizesOffList(drawnTexts(escritos), LINE_HEIGHT, Object.values(TUTORIAL_TEXT)), donde).toEqual([])
        }
      }
    }
    tutorial.vista.nodo.free()
  })

  it('el final a dos se lee: pasar el mando, ganar y empatar, en los dos idiomas', () => {
    const duelo = new PanelDelDuelo()
    const pareja = { wins: [128, 99] as const, ties: 17 }
    const duelos = {
      pasa: recordTurn(createDuel(1), 18888),
      gana: recordTurn(recordTurn(createDuel(1), 18888), 29999),
      empate: recordTurn(recordTurn(createDuel(1), 20000), 20000),
    }
    for (const lang of LANGS) {
      for (const [nombre, d] of Object.entries(duelos)) {
        duelo.escribir(duelSummary(d, pareja, lang))
        const escritos = duelo.panel.escritos
        const donde = `${lang} ${nombre}`
        expect(medir(escritos, { width: XR_DUEL_SIZE[0], height: XR_DUEL_SIZE[1] }, xrPanelViews(XR_DUEL_POSITION)), donde).toEqual([])
        expect(sizesOffList(drawnTexts(escritos), LINE_HEIGHT, Object.values(DUEL_TEXT)), donde).toEqual([])
      }
    }
    duelo.escribir(duelSummary(duelos.pasa, pareja, 'es'))
    expect(duelo.panel.escritos.map((e) => e.texto)).toEqual(['Jugador 1: 18.888 puntos', 'Pásale el mando a Jugador 2.'])
    duelo.nodo.free()
  })

  it('la letra del final se lee, en los dos idiomas y con lo más largo que puede decir', () => {
    const marcador = new Marcador({ repetir: nada, volverAlMenu: nada }, new PointerAim())
    for (const lang of LANGS) {
      // El rótulo de repetir cambia con el modo: «Otro reto» y «Otra partida», la más larga.
      for (const [titulo, modo] of (lang === 'es' ? ['Te has quedado sin vidas', '¡Reto superado!', 'Nivel 15'] : ['You are out of lives', 'Level 15']).flatMap((t) => (['challenge', 'practice'] as const).map((m) => [t, m] as const))) {
        const estado: EstadoDelMarcador = {
          lang,
          modo,
          terminada: true,
          fichas: Array.from({ length: 5 }, () => 'caught' as const),
          racha: 5,
          lleno: 1,
          marca: 0.5,
          record: true,
          vidas: 0,
          estrellas: null,
          titulo,
          puntos: 123456,
        }
        marcador.pintar(estado)
        const escritos = marcador.panel.escritos
        const problemas = medir(escritos, marcador.medida, xrPanelViews(XR_HUD_POSITION))
        expect(problemas, `${lang} «${titulo}»: ${problemas.join('; ')}`).toEqual([])
        expect(sizesOffList(drawnTexts(escritos), LINE_HEIGHT, Object.values(LETRA_DEL_MARCADOR)), titulo).toEqual([])
      }
    }
    marcador.nodo.free()
  })
})

describe('el cartel del objetivo mide lo que la web', () => {
  const TECHO = maxScore(CHALLENGE_SETUP.difficulty, CHALLENGE_SETUP.stickCount)
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

  it('tiene las medidas del de la web: 24° por 4,5° a la distancia de dibujo, y la misma proporción', () => {
    const angulo = (metros: number, distancia: number) => (2 * Math.atan(metros / (2 * distancia)) * 180) / Math.PI
    expect(angulo(CARTEL.alto, CARTEL.distancia)).toBeCloseTo(4.5, 1)
    expect(angulo(CARTEL.titulo, CARTEL.distancia)).toBeCloseTo(1.4, 2)
    expect(angulo(CARTEL.detalle, CARTEL.distancia)).toBeCloseTo(1.2, 2)
    expect(PROPORCION_DEL_CARTEL.width).toBeCloseTo(CARTEL.ancho / 2)
    // En su sitio, dentro de lo que se ve sin girar la cabeza, como en la web.
    for (const esquina of esquinasDelCartel(PROPORCION_DEL_CARTEL)) expect(apartadoDeLaMirada(esquina)).toBeLessThanOrEqual(VISTA_SIN_GIRAR)
  })

  it('todo lo que dice se lee con la letra del motor, en los dos idiomas y donde cuelga: dos líneas jugando, tres con el pie del final', () => {
    const cartel = new Cartel()
    const sitio = sitioDelCartel()
    cartel.colocar(sitio)
    const escala = sitio.distancia / CARTEL.distancia
    const vistas = xrPanelViews(sitio.position).map((vista) => ({ ...vista, pose: { ...vista.pose, rotation: poseDelCartel(sitio).rotation } }))
    const panel = { width: CARTEL.ancho * escala, height: CARTEL.alto * escala }
    let medidas = 0
    for (const lang of LANGS) {
      const t = traductorSuave(lang)
      const decir = (cambios: Partial<LoQueSeJuega>) => {
        const partida = partidaDelCartel(juego(cambios), t)
        if (partida == null) return
        const vista = goalSign(partida, t)
        cartel.actualizar(vista, null, lang, 0)
        const escritos = aEscala(cartel.panel.escritos, escala)
        const distancia = Math.max(...vistas.map(({ pose, ojos }) => worstReadingDistance(drawnTexts(escritos), pose, ojos, LINE_HEIGHT)))
        const problemas = legibilityProblems(escritos, { panel, distance: distancia })
        expect(problemas, `${lang}: ${vista.title} / ${vista.detail}: ${problemas.join('; ')}`).toEqual([])
        expect(escritos.length).toBeLessThanOrEqual(vista.footer == null ? 2 : 3)
        medidas++
      }
      for (const objetivo of [OBJETIVO, { ...OBJETIVO, record: null }, null]) {
        decir({ objetivo, gameState: 'countdown' })
        for (const points of [0, 1899, 3750, 5199, 5200, TECHO]) {
          for (const [lives, resolved] of [[3, 1], [1, 12], [0, 13]]) {
            decir({ objetivo, points, lives, resolved })
            decir({ objetivo, points, lives, resolved, gameState: 'finished' })
          }
        }
      }
      for (const gameMode of GAME_MODE_ORDER) decir({ gameMode, lives: gameMode === 'challenge' ? 3 : null, aDos: gameMode === 'challenge' })
    }
    expect(medidas).toBeGreaterThan(200)
    cartel.nodo.free()
  })

  it('celebra el listón que se cruza: lo devuelve una vez, crece y vuelve, y recién montado no celebra nada', () => {
    const cartel = new Cartel()
    cartel.colocar(sitioDelCartel())
    const t = traductorSuave('en')
    const vista = goalSign(partidaDelCartel(juego({ points: 2000, resolved: 5 }), t)!, t)
    const escala = cartel.nodo.scale.x
    // Montado con una medalla ya ganada: no se ha visto cruzar el listón.
    expect(cartel.actualizar(vista, 'bronze', 'en', 0.016)).toBeNull()
    expect(cartel.nodo.visible).toBe(true)
    expect(cartel.actualizar(vista, 'silver', 'en', 0.016)).toBe('silver')
    expect(cartel.celebrando).toBe('silver')
    expect(cartel.actualizar(vista, 'silver', 'en', 0.2)).toBeNull()
    expect(cartel.nodo.scale.x).toBeGreaterThan(escala)
    for (let i = 0; i < 10; i++) cartel.actualizar(vista, 'silver', 'en', 0.2)
    expect(cartel.celebrando).toBeNull()
    expect(cartel.nodo.scale.x).toBeCloseTo(escala)
    // Mientras celebra, el título dice la medalla: el color solo no se entiende.
    cartel.actualizar(vista, 'bronze', 'en', 0.016)
    cartel.actualizar(vista, 'silver', 'en', 0.016)
    expect(vista.cheer).toBe('Bronze!')
    expect(cartel.panel.escritos[0]!.texto).toBe(vista.cheer)
    // Sin nada que decir se esconde.
    cartel.actualizar(null, null, 'en', 0.016)
    expect(cartel.nodo.visible).toBe(false)
    cartel.nodo.free()
  })

  it('el marcador calla lo que ya dice el cartel: sin barra, sin vidas y sin letra, y encoge', () => {
    const marcador = new Marcador({ repetir: nada, volverAlMenu: nada }, new PointerAim())
    const estado: EstadoDelMarcador = {
      lang: 'es',
      modo: 'challenge',
      terminada: false,
      fichas: Array.from({ length: MAX_STICKS }, () => 'pending' as const),
      racha: 3,
      lleno: 0.4,
      marca: 0.5,
      record: false,
      vidas: 2,
      estrellas: null,
      titulo: 'Te has quedado sin vidas',
      puntos: 2100,
    }
    marcador.pintar(estado)
    const entero = marcador.medida.height
    marcador.pintar({ ...estado, enElCartel: true })
    expect(marcador.medida.height).toBeCloseTo(XR_HUD_WITH_SIGN.run.height)
    expect(marcador.medida.height).toBeLessThan(entero)
    marcador.pintar({ ...estado, enElCartel: true, terminada: true })
    expect(marcador.medida.height).toBeCloseTo(XR_HUD_WITH_SIGN.finished.height)
    // Solo los rótulos de los botones: cómo ha acabado y los puntos los dice el cartel.
    expect(marcador.panel.escritos.map((e) => e.texto)).toEqual(['Otro reto', 'Menú'])
    expect(marcador.repetir.nodo.visible).toBe(true)
    // Sin cartel, el final sigue diciendo cómo ha acabado y los puntos.
    marcador.pintar({ ...estado, terminada: true })
    expect(marcador.panel.escritos.map((e) => e.texto)).toEqual(['Otro reto', 'Menú', 'Te has quedado sin vidas', '2100'])
    marcador.nodo.free()
  })
})

describe('los ajustes del salón', () => {
  beforeEach(() => gameStorage()?.clear())

  it('el idioma es el guardado, y el de la línea de órdenes manda', () => {
    // Sin nada guardado, el del sistema: depende de la máquina que corre el test.
    expect(['en', 'es']).toContain(currentLang())
    gameStorage()!.setItem(LANG_KEY, 'en')
    expect(currentLang()).toBe('en')
    gameStorage()!.setItem(LANG_KEY, 'es')
    expect(currentLang()).toBe('es')
    expect(currentLang('en')).toBe('en')
  })

  it('los volúmenes, de 0 a 1', () => {
    expect(volumeLevels()).toEqual({ sfx: 1, ambience: 0.6, muted: false })
    gameStorage()!.setItem(VOLUME_KEYS.sfx, '50')
    expect(volumeLevels().sfx).toBe(0.5)
  })
})

describe('la interfaz con el ratón', () => {
  let raiz: Node3D
  let camara: Camera3D
  let interfaz: InterfazDelJuego
  let partida: Partida
  let salidas: number

  beforeEach(() => {
    gameStorage()?.clear()
    // Lo que se comprueba está en inglés: sin idioma guardado, el juego habla el del sistema.
    gameStorage()?.setItem(LANG_KEY, 'en')
    const tree = Engine.get_main_loop() as SceneTree
    raiz = new Node3D()
    ;(tree.current_scene ?? (tree.root as Node)).add_child(raiz)
    camara = new Camera3D()
    camara.position = new Vector3(0, 1.9, 3.05)
    camara.fov = 52
    raiz.add_child(camara)
    camara.current = true
    salidas = 0
    partida = new Partida({ semillas: () => 42 })
    // El menú abre en el reto; casi todo lo de aquí se pulsa en la práctica, que es donde se elige.
    partida.setGameMode('practice')
    const escena: EscenaDelJuego = { salir: () => salidas++ }
    interfaz = new InterfazDelJuego(partida, escena, { padre: raiz, camara, visor: false })
  })

  afterEach(() => {
    interfaz.soltar()
    raiz.get_parent()?.remove_child(raiz)
    raiz.free()
  })

  /** Un clic en el botón `id`: moverse, apretar en un fotograma y soltar en el siguiente. */
  function clic(id: string): void {
    // La puntería no cuenta un segundo roce en menos de 300 ms (el doble roce de la web).
    OS.delay_msec(310)
    const boton = interfaz.punteria.boton(id)!
    expect(boton.nodo.is_visible_in_tree(), `${id} a la vista`).toBe(true)
    const at: Vector2 = camara.unproject_position(boton.nodo.global_position)
    const mover = new InputEventMouseMotion()
    mover.position = at
    interfaz.recibir(mover)
    for (const apretado of [true, false]) {
      const e = new InputEventMouseButton()
      e.position = at
      e.button_index = MouseButton.MOUSE_BUTTON_LEFT
      e.pressed = apretado
      interfaz.recibir(e)
      interfaz.actualizar(0.016)
    }
  }

  it('empieza en el menú; elegir y jugar empieza la partida con lo elegido', () => {
    expect(partida.gameState).toBe('menu')
    // Lo de la práctica y el aro, plegados tras «Más opciones».
    clic('opciones')
    clic('difficulty:expert')
    clic('sticks:11')
    clic('hoopUp')
    expect(partida.hoopAdjustment).toBeCloseTo(HOOP_ADJUST_STEP)
    clic('play')
    expect([partida.gameState, partida.activeDifficulty, partida.activeStickCount, partida.semilla]).toEqual(['countdown', 'expert', 11, 42])
    expect(interfaz.cuenta.nodo.visible).toBe(true)
  })

  it('abre en el reto: jugar sin tocar nada cuelga el cartel con la misión, y el marcador calla lo suyo', () => {
    const delReto = new Partida({ semillas: () => 42 })
    const otra = new InterfazDelJuego(delReto, { salir: nada }, { padre: raiz, camara, visor: false })
    expect([delReto.gameState, delReto.gameMode, otra.cartel.nodo.visible]).toEqual(['menu', 'challenge', false])
    delReto.startGame()
    otra.actualizar(0.016)
    expect(otra.cartel.nodo.visible).toBe(true)
    expect(otra.cartel.panel.escritos.map((e) => e.texto)).toEqual(['Catch 13 sticks. Drop three and out'])
    expect(otra.estadoDelMarcador().enElCartel).toBe(true)
    delReto.tick(COUNTDOWN_SECONDS)
    delReto.catchStick(0.5)
    otra.actualizar(0.016)
    expect(otra.cartel.panel.escritos.map((e) => e.texto)).toEqual([`You have ${delReto.points}`, 'Lives ♥♥♥ · Sticks 12'])
    // Sin salón no hay listones: nada que celebrar.
    expect(otra.listonCruzado).toBeNull()
    for (let i = 0; i < 3; i++) delReto.missStick()
    otra.actualizar(0.016)
    expect(delReto.gameState).toBe('finished')
    // Sin récord de antes, la primera marca es récord, y el cartel lo dice.
    expect(otra.cartel.panel.escritos.map((e) => e.texto)).toEqual([`You scored ${delReto.points}`, 'First record!'])
    // Al acabar, repetir está a la vista y empieza otro reto sin pasar por el menú.
    expect(otra.marcador.repetir.nodo.is_visible_in_tree()).toBe(true)
    delReto.startGame()
    expect([delReto.gameState, delReto.gameMode]).toEqual(['countdown', 'challenge'])
    otra.soltar()
    otra.raiz.get_parent()?.remove_child(otra.raiz)
    otra.raiz.free()
  })

  it('en la práctica, sin salón, no hay cartel y el marcador va entero', () => {
    clic('play')
    partida.tick(COUNTDOWN_SECONDS)
    interfaz.actualizar(0.016)
    expect(interfaz.cartel.nodo.visible).toBe(false)
    expect(interfaz.estadoDelMarcador().enElCartel).toBe(false)
  })

  it('el modo va pasando: práctica, niveles, desafío; el desafío va fijo', () => {
    clic('mode')
    expect(partida.gameMode).toBe('levels')
    clic('mode')
    expect(partida.gameMode).toBe('challenge')
    clic('play')
    expect([partida.activeDifficulty, partida.activeStickCount, partida.lives]).toEqual(['medium', MAX_STICKS, 3])
  })

  it('a dos: el desafío con los mismos palos para los dos, el aviso entre tandas y quién gana', () => {
    clic('mode')
    clic('mode')
    clic('players')
    expect(partida.players).toBe(2)
    clic('play')
    expect(partida.player).toBe(0)
    const semilla = partida.stickSeed
    partida.tick(COUNTDOWN_SECONDS)
    for (let i = 0; i < MAX_STICKS; i++) partida.catchStick(0.5)
    interfaz.actualizar(0.016)
    expect(partida.gameState).toBe('finished')
    // El aviso de pasar el mando, delante; el marcador, con su botón de jugar, debajo.
    expect(interfaz.duelo.nodo.visible).toBe(true)
    expect(interfaz.duelo.panel.escritos.map((e) => e.texto)).toContain('Pass the controller to Player 2.')
    clic('again')
    expect([partida.player, partida.stickSeed]).toEqual([1, semilla])
    expect(interfaz.duelo.nodo.visible).toBe(false)
    partida.tick(COUNTDOWN_SECONDS)
    for (let i = 0; i < 3; i++) partida.missStick()
    interfaz.actualizar(0.016)
    expect(interfaz.duelo.panel.escritos[0].texto).toBe('Player 1 wins')
    expect(getDuelTally()).toEqual({ wins: [1, 0], ties: 0 })
    expect(partida.bestPoints).toBe(0)
  })

  it('la flecha de la esquina sale; Escape en el menú, también', () => {
    clic('exit')
    expect(salidas).toBe(1)
    interfaz.escape()
    expect(salidas).toBe(2)
  })

  it('jugando, volver pregunta; seguir vuelve a jugar y salir vuelve al menú', () => {
    clic('play')
    partida.tick(COUNTDOWN_SECONDS)
    interfaz.actualizar(0.016)
    expect(interfaz.marcador.nodo.visible).toBe(true)
    clic('quit')
    expect([partida.prompt, interfaz.aviso.nodo.visible]).toEqual(['quit', true])
    clic('confirm:stay')
    expect(partida.prompt).toBeNull()
    interfaz.escape()
    interfaz.actualizar(0.016)
    clic('confirm:leave')
    expect(partida.gameState).toBe('menu')
    expect(interfaz.menu.nodo.is_visible_in_tree()).toBe(true)
  })

  it('la partida sin fin se termina con su botón; en el final, repetir y volver al menú', () => {
    clic('opciones')
    clic('endless')
    clic('play')
    partida.tick(COUNTDOWN_SECONDS)
    interfaz.actualizar(0.016)
    clic('end-run')
    expect(partida.gameState).toBe('finished')
    interfaz.actualizar(0.016)
    clic('again')
    expect([partida.gameState, partida.runId]).toEqual(['countdown', 2])
    partida.tick(COUNTDOWN_SECONDS)
    partida.endRun()
    interfaz.actualizar(0.016)
    clic('home')
    expect(partida.gameState).toBe('menu')
  })
})
