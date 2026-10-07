/**
 * El menú de Stick Rush en Godot: el panel del visor de la web (`XRMenu.tsx`), con el reparto de
 * `lib/xrLayout.ts` sin tocar una cota y los botones del kit.
 *
 * Lo mismo que la web y en el mismo sitio:
 *
 * - **arriba**, el aro: bajarlo, la regla de cuánto queda de recorrido y subirlo, con el botón de
 *   volver a ver el tutorial en la esquina de la izquierda;
 * - **el modo primero**, que decide si hay algo más que preguntar: con los corazones apagados en la
 *   práctica, encendidos en el desafío y las estrellas en los niveles; la tanda o sin fin, solo en la
 *   práctica; **contra quién, solo en el desafío**, en el mismo hueco —una ficha sola o dos
 *   enfrentadas, el icono de los hermanos—; y qué se ve alrededor, la plaza o tu habitación (apagada
 *   sin realidad aumentada);
 * - **solo la práctica pregunta** cuántos palos —trece palos en miniatura, encendidos hasta el
 *   elegido— y a qué velocidad —cinco fichas con barras que crecen, del verde al rojo—; en los
 *   niveles, la fila de los palos es la escalera, con sus estrellas, y la velocidad se ve apagada;
 *   el desafío va fijo y es darle a jugar;
 * - **abajo**, jugar en medio y **salir en la esquina de abajo a la derecha**, la de los dieciséis
 *   (`exitCorner.ts`).
 *
 * Encima, en letra, los nombres de las filas y la explicación del modo (`dibujarLosNombres` de la
 * web, `MENU_LABELS`, `MENU_TEXT`, `PISTA_Y`). **Simplificado respecto de la web**: sin los botones
 * de silenciar y de la música, que en Godot son los volúmenes del salón. El resto va sin letra, como
 * en la web: cada ajuste se dice con lo que significa.
 *
 * Todo lo escrito queda apuntado en `panel.escritos` para medirlo con el instrumento de la web
 * (`interfaz.motor.test.ts`).
 */
import { Vector3, type MeshInstance3D, type Node3D } from 'godot'

import { piezasDelMando } from '@kit/lib/ui/tutorial'
import { Boton } from '@kit/runtime/ui/boton'
import { botonDeSalir } from '@kit/runtime/ui/iconos'
import { figura } from '@kit/runtime/ui/malla'
import { Panel } from '@kit/runtime/ui/panel'
import { ORDEN } from '@kit/runtime/ui/texto3d'
import type { Punteria } from '@kit/runtime/ui/punteria'

import type { Lang } from '@/lib/ajustes'
import {
  DIFFICULTY_COLORS,
  DIFFICULTY_ORDER,
  LIFE_COLOR,
  MAX_STICKS,
  MIN_STICKS,
  STICK_COLOR,
  type Difficulty,
} from '@/lib/gameConfig'
import { CHALLENGE_LIVES, GAME_MODE_HINTS, picksSetup, type GameMode } from '@/lib/gameMode'
import { PLAYER_COUNT_HINTS, eligeJugadores, juegaADos, type PlayerCount } from '@/lib/duel'
import { HOOP_ADJUST_RANGE } from '@/lib/hoopHeight'
import { LEVEL_COUNT, type Stars } from '@/lib/levels'
import { traductor } from '@/lib/textos'
import {
  BANDA_DE_LA_PISTA,
  MENU_TEXT,
  PISTA_ANCHO,
  PISTA_Y,
  ROW_LABEL_RISE,
  XR_DIFFICULTY_ROW_Y,
  XR_DIFFICULTY_SPACING,
  XR_HOOP_GAUGE_OFFSET,
  XR_LEVEL_PICKER_SPACING,
  XR_MENU_HIT,
  XR_MENU_PLAY_HIT,
  XR_MENU_SPOT,
  XR_ROW_HIT_HEIGHT,
  XR_SCENERY_PICKER_OFFSET,
  XR_STICK_PICKER_SPACING,
  XR_STICK_ROW_Y,
  menuLabelsFor,
  menuLabelText,
  type Vec3,
} from '@/lib/xrLayout'

import {
  iconoDeCorazon,
  iconoDeEscenario,
  iconoDeEstrella,
  iconoDeFlecha,
  iconoDeHabitacion,
  iconoDeJugadores,
  rectangulo,
  triangulosDelAroSinFin,
} from './iconos'

/** Lo que ocupa la placa del menú (`MENU_PANEL` de `XRMenu.tsx`). */
export const MENU_PANEL: readonly [number, number] = [1.06, 0.92 + BANDA_DE_LA_PISTA]

/** Los colores de `XRUi.tsx` y `XRMenu.tsx`. */
export const COLORES = {
  panel: '#0f1f2b',
  ficha: '#1c2634',
  apagado: '#3d4654',
  suave: '#94a3b8',
  claro: '#e2e8f0',
  estrella: '#fbbf24',
  estrellaGastada: '#3f4a5a',
  azul: '#1d4ed8',
  retoFondo: '#4c1d24',
  nivelesFondo: '#3b2f0b',
  jugar: '#15803d',
  neutro: '#334155',
  gris: '#64748b',
  corazonApagado: '#55606f',
} as const

/** Alto de la regla del aro y el recorrido de su marca (`HOOP_GAUGE_HEIGHT`, `HOOP_GAUGE_TRAVEL`). */
const HOOP_GAUGE_HEIGHT = 0.085
const HOOP_GAUGE_TRAVEL = HOOP_GAUGE_HEIGHT / 2 - 0.014
/** Separación y tamaño de los corazones del modo (`MODE_HEART_SPACING`, `MODE_HEART_SIZE`). */
const MODE_HEART_SPACING = 0.045
const MODE_HEART_SIZE = 0.016

/** Lo que enseña el menú: lo elegido y lo guardado. */
export interface EstadoDelMenu {
  lang: Lang
  modo: GameMode
  dificultad: Difficulty
  palos: number
  sinFin: boolean
  /** El nivel que se jugaría y hasta cuál está abierto. */
  nivel: number
  abierto: number
  estrellas: readonly Stars[]
  /** La corrección de la altura del aro, en metros. */
  ajusteDelAro: number
  /** Si el visor da la habitación: sin ella, el botón se apaga. */
  habitacion: boolean
  /** Lo que se ve alrededor. */
  escenario: 'scene' | 'passthrough'
  /** Cuántos juegan: solo cuenta en el desafío (`juegaADos`). */
  jugadores: PlayerCount
}

export interface AccionesDelMenu {
  siguienteModo(): void
  elegirDificultad(dificultad: Difficulty): void
  elegirPalos(palos: number): void
  alternarSinFin(): void
  /** Solo, o a dos pasándose el mando. */
  alternarJugadores(): void
  elegirNivel(nivel: number): void
  elegirEscenario(escenario: 'scene' | 'passthrough'): void
  /** +1 sube el aro un paso; −1 lo baja. */
  moverElAro(pasos: 1 | -1): void
  verElTutorial(): void
  jugar(): void
  salir(): void
}

/** Una caja de botón de la web (sitio y tamaño de su zona sensible), en coordenadas del panel. */
function caja(sitio: Vec3 | readonly [number, number], tamano: readonly [number, number, ...number[]]) {
  return { x: sitio[0], y: sitio[1], width: tamano[0], height: tamano[1] }
}

export class MenuDelJuego {
  readonly panel: Panel
  readonly nodo: Node3D
  readonly botones = new Map<string, Boton>()
  private readonly placas = new Map<string, MeshInstance3D>()
  private readonly palos: MeshInstance3D[] = []
  private readonly estrellasDelNivel: MeshInstance3D[][] = []
  private readonly barras = new Map<Difficulty, MeshInstance3D[]>()
  private readonly corazones: MeshInstance3D[] = []
  private readonly estrellasDelModo: MeshInstance3D[] = []
  private readonly aroEntero: MeshInstance3D
  private readonly aroMedio: MeshInstance3D
  private readonly marcaDelAro: MeshInstance3D
  private readonly iconosDelEscenario = new Map<string, MeshInstance3D>()
  /** El icono de contra quién: la mesa, la ficha de este lado y la de enfrente (solo a dos). */
  private readonly pareja: MeshInstance3D[]

  constructor(acciones: AccionesDelMenu, punteria: Punteria) {
    this.panel = new Panel({ ancho: MENU_PANEL[0], alto: MENU_PANEL[1], fondo: COLORES.panel, opacidad: 1 })
    this.nodo = this.panel.nodo

    // El aro: bajar, la regla y subir.
    for (const [id, arriba] of [['hoopDown', false], ['hoopUp', true]] as const) {
      const b = this.anadir(id, caja(XR_MENU_SPOT[id], XR_MENU_HIT[id]), () => acciones.moverElAro(arriba ? 1 : -1))
      this.placa(b, id, 0.1, 0.085, COLORES.ficha)
      b.dibujo(iconoDeFlecha(0.026, arriba ? 'up' : 'down', '#ffffff'), '#ffffff')
    }
    const [gx, gy] = XR_HOOP_GAUGE_OFFSET
    const riel = rectangulo(0.012, HOOP_GAUGE_HEIGHT, COLORES.ficha, gx, gy)
    riel.position = new Vector3(0, 0, 0.004)
    this.nodo.add_child(riel)
    this.marcaDelAro = rectangulo(0.05, 0.009, STICK_COLOR)
    this.nodo.add_child(this.marcaDelAro)

    // Volver a ver el tutorial: el mando en miniatura, quieto.
    const tutorial = this.anadir('tutorial', caja(XR_MENU_SPOT.tutorial, XR_MENU_HIT.tutorial), () => acciones.verElTutorial())
    this.placa(tutorial, 'tutorial', 0.11, 0.095, COLORES.neutro)
    for (const pieza of piezasDelMando(null, 0.075)) tutorial.dibujo(figura(pieza.triangulos, COLORES.claro), COLORES.claro)

    // El modo, con lo que pone en juego.
    const modo = this.anadir('mode', caja(XR_MENU_SPOT.mode, XR_MENU_HIT.mode), () => acciones.siguienteModo())
    this.placa(modo, 'mode', 0.17, 0.1, COLORES.ficha)
    const ancho = (CHALLENGE_LIVES - 1) * MODE_HEART_SPACING
    for (let i = 0; i < CHALLENGE_LIVES; i++) {
      const corazon = modo.dibujo(iconoDeCorazon(MODE_HEART_SIZE, LIFE_COLOR), LIFE_COLOR)
      corazon.position = new Vector3(i * MODE_HEART_SPACING - ancho / 2, 0, 0.004)
      this.corazones.push(corazon)
      const estrella = modo.dibujo(iconoDeEstrella(0.016, COLORES.estrella), COLORES.estrella)
      estrella.position = new Vector3((i - 1) * MODE_HEART_SPACING, 0, 0.004)
      this.estrellasDelModo.push(estrella)
    }

    // Tanda o sin fin, solo en la práctica.
    const sinFin = this.anadir('endless', caja(XR_MENU_SPOT.endless, XR_MENU_HIT.endless), () => acciones.alternarSinFin())
    this.placa(sinFin, 'endless', 0.13, 0.1, COLORES.ficha)
    this.aroEntero = sinFin.dibujo(figura(triangulosDelAroSinFin(true), '#ffffff'), '#ffffff')
    this.aroMedio = sinFin.dibujo(figura(triangulosDelAroSinFin(false), COLORES.gris), COLORES.gris)

    // Contra quién, solo en el desafío: en el hueco de sin fin, con su misma caja.
    const jugadores = this.anadir('players', caja(XR_MENU_SPOT.endless, XR_MENU_HIT.endless), () => acciones.alternarJugadores())
    this.placa(jugadores, 'players', 0.13, 0.1, COLORES.ficha)
    this.pareja = iconoDeJugadores(0.016, '#ffffff', '#ffffff', '#ffffff').map((pieza) => {
      jugadores.dibujo(pieza, '#ffffff')
      return pieza
    })

    // La plaza o tu habitación.
    for (const [i, escenario] of (['scene', 'passthrough'] as const).entries()) {
      const [sx, sy] = XR_SCENERY_PICKER_OFFSET
      const id = `scenery:${escenario}`
      const b = this.anadir(id, { x: sx + i * 0.15 - 0.075, y: sy, width: 0.14, height: 0.12 }, () => acciones.elegirEscenario(escenario))
      this.placa(b, id, 0.12, 0.1, COLORES.ficha)
      const icono = escenario === 'scene' ? iconoDeEscenario(0.028, '#ffffff') : iconoDeHabitacion(0.028, '#ffffff')
      this.iconosDelEscenario.set(id, b.dibujo(icono, '#ffffff'))
    }

    // Los palos: trece en miniatura, encendidos hasta el elegido.
    const anchoDePalos = (MAX_STICKS - 1) * XR_STICK_PICKER_SPACING
    for (let i = 0; i < MAX_STICKS; i++) {
      const cuantos = i + 1
      const b = this.anadir(
        `sticks:${cuantos}`,
        { x: i * XR_STICK_PICKER_SPACING - anchoDePalos / 2, y: XR_STICK_ROW_Y, width: XR_STICK_PICKER_SPACING, height: XR_ROW_HIT_HEIGHT.sticks },
        () => acciones.elegirPalos(cuantos),
      )
      this.palos.push(b.dibujo(rectangulo(0.016, 0.11, STICK_COLOR), STICK_COLOR))
    }

    // La escalera de los niveles, en la fila de los palos, con sus estrellas encima.
    const anchoDeNiveles = (LEVEL_COUNT - 1) * XR_LEVEL_PICKER_SPACING
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const nivel = i + 1
      const id = `level:${nivel}`
      const b = this.anadir(
        id,
        { x: i * XR_LEVEL_PICKER_SPACING - anchoDeNiveles / 2, y: XR_STICK_ROW_Y, width: XR_LEVEL_PICKER_SPACING, height: XR_ROW_HIT_HEIGHT.sticks },
        () => acciones.elegirNivel(nivel),
      )
      this.placas.set(id, b.dibujo(rectangulo(0.03, 0.05, COLORES.apagado, 0, -0.02), COLORES.apagado, 1, { prioridad: ORDEN.placa }))
      const suyas: MeshInstance3D[] = []
      for (let s = 0; s < 3; s++) suyas.push(b.dibujo(rectangulo(0.014, 0.008, COLORES.estrellaGastada, 0, 0.03 + s * 0.016), COLORES.estrellaGastada))
      this.estrellasDelNivel.push(suyas)
    }

    // La velocidad: cinco fichas con barras que crecen.
    const anchoDeVelocidades = (DIFFICULTY_ORDER.length - 1) * XR_DIFFICULTY_SPACING
    DIFFICULTY_ORDER.forEach((nivel, i) => {
      const id = `difficulty:${nivel}`
      const b = this.anadir(
        id,
        { x: i * XR_DIFFICULTY_SPACING - anchoDeVelocidades / 2, y: XR_DIFFICULTY_ROW_Y, width: XR_DIFFICULTY_SPACING * 0.92, height: XR_ROW_HIT_HEIGHT.difficulty },
        () => acciones.elegirDificultad(nivel),
      )
      this.placa(b, id, XR_DIFFICULTY_SPACING * 0.82, 0.13, COLORES.ficha)
      const barras: MeshInstance3D[] = []
      for (let barra = 0; barra <= i; barra++) {
        const alto = 0.028 + barra * 0.017
        const pieza = b.dibujo(rectangulo(0.013, alto, DIFFICULTY_COLORS[nivel], (barra - i / 2) * 0.022, -0.04 + alto / 2), DIFFICULTY_COLORS[nivel])
        barras.push(pieza)
      }
      this.barras.set(nivel, barras)
    })

    // Jugar, y salir en la esquina.
    const jugar = this.anadir('play', caja(XR_MENU_SPOT.play, XR_MENU_PLAY_HIT), () => acciones.jugar())
    this.placa(jugar, 'play', 0.32, 0.1, COLORES.jugar)
    jugar.dibujo(iconoDeFlecha(0.032, 'right', '#ffffff'), '#ffffff')
    const salir = botonDeSalir({
      caja: caja(XR_MENU_SPOT.exit, XR_MENU_HIT.exit),
      color: COLORES.neutro,
      opacidad: 1,
      flecha: COLORES.claro,
      id: 'exit',
      alPulsar: () => acciones.salir(),
    })
    this.panel.boton(salir)
    this.botones.set('exit', salir)

    punteria.anadir(...this.botones.values())
  }

  /** Un botón con la zona sensible de la web y la placa transparente: lo que se ve es su dibujo. */
  private anadir(id: string, zona: { x: number; y: number; width: number; height: number }, alPulsar: () => void): Boton {
    const boton = new Boton({ id, caja: zona, color: COLORES.panel, opacidad: 0, alPulsar })
    this.panel.boton(boton)
    this.botones.set(id, boton)
    return boton
  }

  /** La placa de la web, más pequeña que su zona sensible, como dibujo del botón, debajo de los demás. */
  private placa(boton: Boton, id: string, ancho: number, alto: number, color: string): void {
    const placa = boton.dibujo(rectangulo(ancho, alto, color), color, 1, { prioridad: ORDEN.placa })
    this.placas.set(id, placa)
  }

  boton(id: string): Boton {
    return this.botones.get(id)!
  }

  /** Pinta un estado: qué filas se ven, qué está elegido, qué se apaga y qué se escribe. */
  pintar(estado: EstadoDelMenu): void {
    const practica = picksSetup(estado.modo)
    const niveles = estado.modo === 'levels'
    const reto = estado.modo === 'challenge'

    // El aro: en los topes, su botón se apaga; la marca dice cuánto queda.
    this.boton('hoopDown').apagado = estado.ajusteDelAro <= -HOOP_ADJUST_RANGE
    this.boton('hoopUp').apagado = estado.ajusteDelAro >= HOOP_ADJUST_RANGE
    const [gx, gy] = XR_HOOP_GAUGE_OFFSET
    this.marcaDelAro.position = new Vector3(gx, gy + (estado.ajusteDelAro / HOOP_ADJUST_RANGE) * HOOP_GAUGE_TRAVEL, 0.006)

    // El modo.
    const modo = this.boton('mode')
    modo.colorDelDibujo(this.placas.get('mode')!, reto ? COLORES.retoFondo : niveles ? COLORES.nivelesFondo : COLORES.ficha)
    for (const [i, corazon] of this.corazones.entries()) {
      corazon.visible = !niveles
      const k = reto ? 1 : 0.75
      corazon.scale = new Vector3(k, k, 1)
      modo.colorDelDibujo(corazon, reto ? LIFE_COLOR : COLORES.corazonApagado)
      this.estrellasDelModo[i].visible = niveles
    }

    // Tanda o sin fin.
    const sinFin = this.boton('endless')
    sinFin.nodo.visible = practica
    sinFin.colorDelDibujo(this.placas.get('endless')!, estado.sinFin ? COLORES.azul : COLORES.ficha)
    this.aroEntero.visible = estado.sinFin
    this.aroMedio.visible = !estado.sinFin

    // Contra quién: a dos, la placa se enciende además de salir la segunda ficha.
    const jugadores = this.boton('players')
    const aDos = estado.jugadores === 2
    jugadores.nodo.visible = eligeJugadores(estado.modo)
    jugadores.colorDelDibujo(this.placas.get('players')!, aDos ? COLORES.jugar : COLORES.ficha)
    this.pareja.forEach((pieza, i) => {
      jugadores.colorDelDibujo(pieza, aDos ? '#ffffff' : COLORES.suave)
      if (i === 2) pieza.visible = aDos
    })

    // Alrededor.
    for (const escenario of ['scene', 'passthrough'] as const) {
      const id = `scenery:${escenario}`
      const b = this.boton(id)
      const elegido = estado.escenario === escenario
      const sin = escenario === 'passthrough' && !estado.habitacion
      // Apagada de verdad sin realidad aumentada: por opacidad y por color, no solo por color.
      b.apagado = sin
      b.colorDelDibujo(this.placas.get(id)!, elegido ? COLORES.azul : COLORES.ficha)
      b.colorDelDibujo(this.iconosDelEscenario.get(id)!, sin ? COLORES.gris : '#ffffff')
      // Lo elegido sale hacia quien mira, como en la web (`position` con la `z` de lo elegido).
      b.adelanto = elegido ? 0.02 : 0
    }

    // Los palos, solo en la práctica.
    this.palos.forEach((palo, i) => {
      const cuantos = i + 1
      const b = this.boton(`sticks:${cuantos}`)
      b.nodo.visible = practica
      b.apagado = cuantos < MIN_STICKS
      const encendido = cuantos <= estado.palos
      palo.scale = new Vector3(1, encendido ? 1 : 0.075 / 0.11, 1)
      palo.position = new Vector3(0, encendido ? 0.008 : 0, palo.position.z)
      b.colorDelDibujo(palo, encendido ? STICK_COLOR : COLORES.apagado)
    })

    // La escalera, solo en los niveles.
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const nivel = i + 1
      const b = this.boton(`level:${nivel}`)
      b.nodo.visible = niveles
      const bloqueado = nivel > estado.abierto
      const elegido = nivel === estado.nivel
      b.apagado = bloqueado
      const casilla = this.placas.get(`level:${nivel}`)!
      casilla.scale = new Vector3(1, elegido ? 0.07 / 0.05 : 1, 1)
      b.colorDelDibujo(casilla, elegido ? STICK_COLOR : bloqueado ? COLORES.ficha : COLORES.apagado)
      // Lo elegido sale hacia quien mira, como en la web (`position` con la `z` de lo elegido).
      b.adelanto = elegido ? 0.02 : 0
      const ganadas = estado.estrellas[i] ?? 0
      this.estrellasDelNivel[i].forEach((estrella, s) => {
        estrella.visible = !bloqueado
        b.colorDelDibujo(estrella, s < ganadas ? COLORES.estrella : COLORES.estrellaGastada)
      })
    }

    // La velocidad: en la práctica se elige; en los niveles se ve apagada la del nivel.
    for (const nivel of DIFFICULTY_ORDER) {
      const b = this.boton(`difficulty:${nivel}`)
      b.nodo.visible = practica || niveles
      const elegido = nivel === estado.dificultad
      b.apagado = niveles && !elegido
      b.colorDelDibujo(this.placas.get(`difficulty:${nivel}`)!, elegido ? DIFFICULTY_COLORS[nivel] : COLORES.ficha)
      for (const barra of this.barras.get(nivel)!) b.colorDelDibujo(barra, elegido ? '#ffffff' : DIFFICULTY_COLORS[nivel])
      b.adelanto = elegido ? 0.022 : 0
    }

    this.escribir(estado)
  }

  /** Los nombres de las filas y la explicación del modo: el `dibujarLosNombres` de la web. */
  private escribir(estado: EstadoDelMenu): void {
    const t = traductor(estado.lang)
    const { panel } = this
    panel.borrarTextos()
    for (const { text, x, y } of menuLabelsFor(estado.modo)) {
      // La fila del modo dice cuál hay elegido —«Reto», «Práctica»—, no «Modo».
      panel.escribir(t(menuLabelText(text, estado.modo)), x, y + ROW_LABEL_RISE, { alto: MENU_TEXT.label, color: COLORES.suave, anchoMax: 0.3 })
    }
    // A dos, la explicación es la de la partida a dos: el modo ya lo dice su interruptor.
    const pista = juegaADos(estado.modo, estado.jugadores) ? PLAYER_COUNT_HINTS[2] : GAME_MODE_HINTS[estado.modo]
    panel.parrafo(t(pista), 0, PISTA_Y, {
      alto: MENU_TEXT.hint,
      color: COLORES.suave,
      anchoMax: PISTA_ANCHO,
      ancla: 'top',
    })
  }
}
