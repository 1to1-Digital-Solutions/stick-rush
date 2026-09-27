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
 * `juego/partida.ts`, y los clics por el mismo `PunteroDeRaton` que en plano.
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

import { problemasDeLegibilidad } from '@kit/lib/ui/instrumento'
import { ALTO_DE_LINEA, type Escrito } from '@kit/lib/ui/texto'
import { PANEL_DEL_TUTORIAL } from '@kit/lib/ui/tutorial'
import { Punteria } from '@kit/runtime/ui/punteria'

import { LANGS, VOLUME_KEYS } from '@/lib/ajustes'
import { problemasDeLaSalida } from '@/lib/exitCorner'
import { DIFFICULTY_ORDER, MAX_STICKS, MIN_STICKS } from '@/lib/gameConfig'
import { GAME_MODE_ORDER } from '@/lib/gameMode'
import { HOOP_ADJUST_STEP } from '@/lib/hoopHeight'
import { noTextOwnsAButton, sizesOffList, textsOnButtons, unreadableTexts, worstReadingDistance, type PanelPose } from '@/lib/panelReading'
import { gameStorage } from '@/lib/storage'
import { TUTORIAL_STEPS } from '@/lib/tutorial'
import {
  CONFIRM_BOXES,
  CONFIRM_TEXT,
  DUEL_TEXT,
  MENU_TEXT,
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
  xrPanelViews,
  type MenuPose,
} from '@/lib/xrLayout'

import { COUNTDOWN_SECONDS, Partida } from '../juego/partida'
import { createDuel, duelSummary, recordTurn } from '@/lib/duel'
import { getDuelTally } from '@/lib/duelTally'
import { CLAVE_DEL_IDIOMA, idioma, niveles } from './ajustes'
import { AvisoDeSalir, PanelDelDuelo } from './aviso'
import { InterfazDelJuego, type EscenaDelJuego } from './interfaz'
import { LETRA_DEL_MARCADOR, Marcador, type EstadoDelMarcador } from './marcador'
import { MENU_PANEL, MenuDelJuego, type EstadoDelMenu } from './menu'
import { MEDIDAS_DE_STICK_RUSH, TutorialDelJuego } from './tutorial'

type Vistas = { donde: string; pose: PanelPose; ojos: { x: number; y: number; z: number } }[]

/** Lo que la web mide de un panel: que se lea desde donde se juega con el visor. */
function medir(escritos: readonly Escrito[], panel: { width: number; height: number }, vistas: Vistas): string[] {
  const distancia = Math.max(...vistas.map(({ pose, ojos }) => worstReadingDistance(escritos, pose, ojos, ALTO_DE_LINEA)))
  return [
    ...problemasDeLegibilidad(escritos, { panel, distancia }),
    ...vistas.flatMap(({ pose, ojos, donde }) => unreadableTexts(escritos, pose, ojos, ALTO_DE_LINEA).map((p) => `${donde}: ${p}`)),
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
      elegirNivel: nada,
      elegirEscenario: nada,
      moverElAro: nada,
      verElTutorial: nada,
      jugar: nada,
      salir: nada,
    },
    new Punteria(),
  )
  const SITIOS: { nombre: string; pose: MenuPose }[] = [
    { nombre: 'columna del visor', pose: XR_MENU_POSE },
    { nombre: 'escritorio', pose: XR_MENU_DESK_POSE },
  ]

  it('los nombres de las filas y la explicación del modo, en los dos idiomas', () => {
    menu.pintar(estadoDelMenu({ lang: 'es' }))
    const textos = menu.panel.escritos.map((e) => e.texto)
    expect(textos).toEqual(expect.arrayContaining(['Aro', 'Palos', 'Velocidad', 'Modo', 'Alrededor']))
    expect(textos.some((t) => t.startsWith('Caen todos'))).toBe(true)
    // El desafío va fijo: sin las filas que no se eligen, sin sus nombres.
    menu.pintar(estadoDelMenu({ modo: 'challenge' }))
    expect(menu.panel.escritos.map((e) => e.texto)).not.toContain('Sticks')
  })

  it('se lee en la columna del visor y en escritorio, en cada idioma y modo, sin tamaños fuera de la lista', () => {
    for (const lang of LANGS) {
      for (const [modo, jugadores] of [...GAME_MODE_ORDER.map((m) => [m, 1] as const), ['challenge', 2] as const]) {
        menu.pintar(estadoDelMenu({ lang, modo, jugadores }))
        const escritos = menu.panel.escritos
        expect(sizesOffList(escritos, ALTO_DE_LINEA, Object.values(MENU_TEXT)), `${lang} ${modo}`).toEqual([])
        for (const { nombre, pose } of SITIOS) {
          const escalados = aEscala(escritos, pose.scale)
          const panel = { width: MENU_PANEL[0] * pose.scale, height: MENU_PANEL[1] * pose.scale }
          expect(medir(escalados, panel, xrPanelViews(pose.position, pose.yaw)), `${lang} ${modo}, ${nombre}`).toEqual([])
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
    for (const lang of LANGS) {
      for (const modo of GAME_MODE_ORDER) {
        menu.pintar(estadoDelMenu({ lang, modo }))
        expect(textsOnButtons(menu.panel.escritos, botones, noTextOwnsAButton), `${lang} ${modo}`).toEqual([])
      }
    }
  })

  it('la salida, abajo a la derecha: la última de su fila y nada por debajo', () => {
    const salida = menu.boton('exit').caja
    const resto = [...menu.botones.values()].filter((b) => b.id !== 'exit').map((b) => b.caja)
    expect(problemasDeLaSalida(salida, resto, { width: MENU_PANEL[0], height: MENU_PANEL[1] })).toEqual([])
  })

  it('solo la práctica pregunta palos y velocidad; los niveles, su escalera; y lo apagado no se pulsa', () => {
    menu.pintar(estadoDelMenu())
    expect(menu.boton('sticks:5').nodo.visible && menu.boton('difficulty:easy').nodo.visible && !menu.boton('level:1').nodo.visible).toBe(true)
    expect([menu.boton('sticks:4').apagado, menu.boton(`sticks:${MAX_STICKS}`).apagado]).toEqual([true, false])
    expect(menu.boton('scenery:passthrough').apagado).toBe(true)
    menu.pintar(estadoDelMenu({ modo: 'levels', abierto: 3, nivel: 2 }))
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
    menu.pintar(estadoDelMenu({ ajusteDelAro: 0.2 }))
    expect([menu.boton('hoopUp').apagado, menu.boton('hoopDown').apagado]).toEqual([true, false])
  })
})

describe('el aviso, el tutorial y el final miden lo que la web', () => {
  it('el aviso de dejar la partida, en los dos idiomas', () => {
    const aviso = new AvisoDeSalir({ dejar: nada, seguir: nada }, new Punteria())
    const botones = Object.values(CONFIRM_BOXES).map(({ position, size }) => ({ x: position[0], y: position[1], width: size[0], height: size[1] }))
    for (const lang of LANGS) {
      aviso.escribir(lang)
      const escritos = aviso.panel.escritos
      expect(medir(escritos, { width: XR_CONFIRM_SIZE[0], height: XR_CONFIRM_SIZE[1] }, xrPanelViews(XR_CONFIRM_POSITION)), lang).toEqual([])
      expect(sizesOffList(escritos, ALTO_DE_LINEA, Object.values(CONFIRM_TEXT)), lang).toEqual([])
      expect(textsOnButtons(escritos, botones), lang).toEqual([])
    }
    aviso.nodo.free()
  })

  it('el tutorial, en sus pasos, con mando y con las manos, en los dos idiomas', () => {
    const tutorial = new TutorialDelJuego({ siguiente: nada, saltar: nada }, new Punteria())
    expect(MEDIDAS_DE_STICK_RUSH.boton.width).toBe(0.33)
    for (const lang of LANGS) {
      for (const manos of [false, true]) {
        for (const paso of TUTORIAL_STEPS) {
          tutorial.actualizar(paso, lang, manos, 0.016)
          const escritos = tutorial.vista.panel.escritos
          const donde = `${lang} ${manos ? 'manos' : 'mando'} ${paso}`
          expect(medir(escritos, PANEL_DEL_TUTORIAL, xrPanelViews(XR_TUTORIAL_POSITION)), donde).toEqual([])
          expect(sizesOffList(escritos, ALTO_DE_LINEA, Object.values(TUTORIAL_TEXT)), donde).toEqual([])
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
        expect(sizesOffList(escritos, ALTO_DE_LINEA, Object.values(DUEL_TEXT)), donde).toEqual([])
      }
    }
    duelo.escribir(duelSummary(duelos.pasa, pareja, 'es'))
    expect(duelo.panel.escritos.map((e) => e.texto)).toEqual(['Jugador 1: 18.888 puntos', 'Pásale el mando a Jugador 2.'])
    duelo.nodo.free()
  })

  it('la letra del final se lee, en los dos idiomas y con lo más largo que puede decir', () => {
    const marcador = new Marcador({ repetir: nada, volverAlMenu: nada }, new Punteria())
    for (const lang of LANGS) {
      for (const titulo of lang === 'es' ? ['Te has quedado sin vidas', '¡Reto superado!', 'Nivel 15'] : ['You are out of lives', 'Level 15']) {
        const estado: EstadoDelMarcador = {
          lang,
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
        expect(sizesOffList(escritos, ALTO_DE_LINEA, Object.values(LETRA_DEL_MARCADOR)), titulo).toEqual([])
      }
    }
    marcador.nodo.free()
  })
})

describe('los ajustes del salón', () => {
  beforeEach(() => gameStorage()?.clear())

  it('el idioma es el guardado, y el de la línea de órdenes manda', () => {
    expect(idioma()).toBe('en')
    gameStorage()!.setItem(CLAVE_DEL_IDIOMA, 'es')
    expect(idioma()).toBe('es')
    expect(idioma('en')).toBe('en')
  })

  it('los volúmenes, de 0 a 1', () => {
    expect(niveles()).toEqual({ sfx: 1, ambience: 0.6, muted: false })
    gameStorage()!.setItem(VOLUME_KEYS.sfx, '50')
    expect(niveles().sfx).toBe(0.5)
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
    clic('difficulty:expert')
    clic('sticks:11')
    clic('hoopUp')
    expect(partida.hoopAdjustment).toBeCloseTo(HOOP_ADJUST_STEP)
    clic('play')
    expect([partida.gameState, partida.activeDifficulty, partida.activeStickCount, partida.semilla]).toEqual(['countdown', 'expert', 11, 42])
    expect(interfaz.cuenta.nodo.visible).toBe(true)
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
