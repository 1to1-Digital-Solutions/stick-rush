/**
 * La interfaz de Stick Rush en Godot, entera: el menú, el marcador, la cuenta atrás, volver al menú
 * y su aviso, terminar la partida sin fin y el tutorial, el cartel del objetivo, y la puntería que
 * los hace pulsables. Lo que en la web montan `XRMenu`, `XRHud`, `CartelDeLaMaquina`, `XRCountdown` y
 * `XRTutorial` dentro de `XRGazeAnchor`.
 *
 * **Con el visor, en las cotas de la web** (`lib/xrLayout.ts`): el menú en la columna de la izquierda
 * —a metro y medio, 55° y agrandado (`XR_MENU_POSE`)—, el marcador por debajo del aro, volver al menú
 * arriba a la izquierda, el aviso y la cuenta atrás delante y el tutorial por encima del marcador.
 * Todo cuelga de `raiz`, en el mundo del jugador (que ya se planta donde lo presta el salón y gira con
 * el stick), y sube o baja con los ojos de quien juega lo que el mundo no haya bajado ya
 * (`xrUiRiseOverWorld`). **Una diferencia**: la web la lleva además con la mirada (`XRGazeAnchor`,
 * con su zona muerta); aquí se queda donde se plantó el mundo, como en los demás ports.
 *
 * **En plano** la web no pinta estos paneles —pone su menú y su marcador en DOM—; aquí no hay DOM,
 * así que los mismos paneles se cuelgan **de la cámara** (`SITIOS_EN_PLANO`), cerca, para que nada de
 * la escena se meta por delante.
 *
 * **Quien manda es la partida** (`juego/partida.ts`, el `gameStore` de la web): esto solo la lee para
 * pintar y le pasa lo que se pulsa.
 */
import { Node3D, Transform3D, Vector3, type Camera3D, type InputEvent } from 'godot'

import type { Puntero } from '@kit/lib/ui/puntero'
import { Punteria } from '@kit/runtime/ui/punteria'
import { PunteroDeRaton } from '@kit/runtime/ui/raton'
import type { MandoEnLaMano } from '@kit/runtime/ui/tutorial'

import type { Lang, Scenery } from '@/lib/ajustes'
import { sitioDelCartel } from '@/lib/cartelDeLaMaquina'
import type { Medalla } from '@/lib/objetivo'
import { GAME_MODE_ORDER, startingLives } from '@/lib/gameMode'
import { duelSummary } from '@/lib/duel'
import { getDuelTally } from '@/lib/duelTally'
import { scoreRatio } from '@/lib/scoring'
import { sceneryModeOf, sceneryOf } from '@/lib/sceneryPreference'
import { stickStatuses } from '@/lib/stickLayout'
import { traductor } from '@/lib/textos'
import {
  XR_CONFIRM_POSITION,
  XR_COUNTDOWN_POSITION,
  XR_DUEL_POSITION,
  XR_HUD_POSITION,
  XR_TUTORIAL_POSITION,
  menuPoseFor,
  xrUiRiseOverWorld,
} from '@/lib/xrLayout'

import type { Partida } from '../juego/partida'
import { alCambiarElIdioma, idioma } from '@kit/runtime/ajustes'
import { AvisoDeSalir, BotonDeTerminar, BotonDeVolver, CuentaAtras, PanelDelDuelo } from './aviso'
import { CARTEL, Cartel } from './cartel'
import { Marcador, SUBIDA_DEL_FINAL, type EstadoDelMarcador } from './marcador'
import { MenuDelJuego, type EstadoDelMenu } from './menu'
import { TutorialDelJuego } from './tutorial'

/** Lo que la interfaz le pide a la escena, además de lo que le pide a la partida. */
export interface EscenaDelJuego {
  /** Volver al salón, o cerrar el juego. */
  salir(): void
}

/** El escenario del salón visto desde el menú: qué hay elegido, si hay habitación y cómo cambiarlo. */
export interface EscenarioDelMenu {
  readonly elegido: Scenery
  readonly hayHabitacion: boolean
  elegir(escenario: Scenery): void
}

/** La altura de los ojos que mide el visor, y si el salón pide jugar a la altura de los ojos. */
export interface OjosDeQuienJuega {
  alto: number | null
  aLaAlturaDeLosOjos: boolean
}

export interface OpcionesDeLaInterfaz {
  /** Donde cuelga: el mundo del jugador con visor, o la escena. */
  padre: Node3D
  /** La cámara de plano, de la que sale el rayo del ratón y de la que cuelgan los paneles. Con visor, `null`. */
  camara: Camera3D | null
  /** Los punteros del visor (`XRPlayer.punteros()`), además del ratón. */
  punteros?: readonly Puntero[]
  visor: boolean
  /** Idioma forzado por la línea de órdenes (`--lang=es`), para mirar sin tocar el guardado. */
  lang?: string | null
  /** Enseñar el tutorial también en plano (`--tutorial`). */
  tutorial?: boolean
  /** El mando de verdad de cada mano, para el tutorial. */
  manos?: readonly MandoEnLaMano[]
  ojos?: () => OjosDeQuienJuega | null
  escenario?: EscenarioDelMenu
}

/** Dónde se cuelga cada panel en plano, en el espacio de la cámara (`−Z` es hacia la máquina). */
export interface SitioEnPlano {
  posicion: readonly [number, number, number]
  escala: number
}

/**
 * Los paneles en plano, con la cámara de la web (52° de campo): el menú a la izquierda, dejando ver
 * la máquina; jugando, el marcador arriba a la derecha (donde la web tiene los puntos) y volver arriba
 * a la izquierda, fuera del aro; la pregunta y el final, en medio; la cuenta atrás, encima de la
 * máquina; el tutorial (`--tutorial`), a la derecha; el cartel del objetivo, arriba en medio, por
 * encima de la máquina (al acabar baja con el panel del final, justo encima de él).
 */
export const SITIOS_EN_PLANO = {
  menu: { posicion: [-0.55, 0, -1.25], escala: 1 },
  marcador: { posicion: [0.72, 0.5, -1.4], escala: 0.7 },
  final: { posicion: [0, -0.02, -1.3], escala: 1 },
  volver: { posicion: [-0.95, 0.48, -1.4], escala: 1 },
  terminar: { posicion: [0.95, 0.12, -1.4], escala: 1 },
  aviso: { posicion: [0, 0, -1.2], escala: 1 },
  // A dos, encima del final: el aviso de pasar el mando o quién gana.
  duelo: { posicion: [0, 0.4, -1.3], escala: 0.8 },
  cuenta: { posicion: [0, 0.18, -1.4], escala: 1 },
  // El cartel mide a esa distancia lo que mide a la de dibujo: los mismos grados que con el visor.
  cartel: { posicion: [0, 0.56, -1.4], escala: 1.4 / CARTEL.distancia },
  cartelDelFinal: { posicion: [0, 0.13, -1.3], escala: 1.3 / CARTEL.distancia },
  tutorial: { posicion: [0.8, -0.1, -1.6], escala: 0.8 },
} as const satisfies Record<string, SitioEnPlano>

export class InterfazDelJuego {
  readonly punteria: Punteria
  readonly raton: PunteroDeRaton | null
  /** Lo que sube con los ojos, con visor. */
  readonly raiz: Node3D
  readonly menu: MenuDelJuego
  readonly marcador: Marcador
  /** El cartel del objetivo, encima del marcador. */
  readonly cartel: Cartel
  /** El listón de medalla cruzado en el último fotograma, para que la escena lo haga sonar y sentir. */
  listonCruzado: Medalla | null = null
  readonly volver: BotonDeVolver
  readonly terminar: BotonDeTerminar
  readonly aviso: AvisoDeSalir
  readonly duelo: PanelDelDuelo
  readonly cuenta: CuentaAtras
  readonly tutorial: TutorialDelJuego
  private readonly visor: boolean
  private readonly camara: Camera3D | null
  private readonly langForzado: string | null
  private readonly tutorialEnPlano: boolean
  private readonly ojos: () => OjosDeQuienJuega | null
  private readonly escenario: EscenarioDelMenu | null
  private readonly dejarDeEscuchar: () => void
  private pintadoMenu = ''
  private pintadoMarcador = ''
  private pintadoAviso = ''
  private pintadoDuelo = ''
  private colocadoEnPlano = ''

  constructor(
    private readonly partida: Partida,
    private readonly escena: EscenaDelJuego,
    opciones: OpcionesDeLaInterfaz,
  ) {
    this.visor = opciones.visor
    this.camara = opciones.camara
    this.langForzado = opciones.lang ?? null
    this.tutorialEnPlano = opciones.tutorial ?? false
    this.ojos = opciones.ojos ?? (() => null)
    this.escenario = opciones.escenario ?? null
    this.raton = opciones.camara == null ? null : new PunteroDeRaton(opciones.camara)
    this.punteria = new Punteria([...(this.raton == null ? [] : [this.raton]), ...(opciones.punteros ?? [])])

    this.raiz = new Node3D()
    this.raiz.set_name('Interfaz')
    opciones.padre.add_child(this.raiz)

    const p = partida
    this.menu = new MenuDelJuego(
      {
        siguienteModo: () => p.setGameMode(GAME_MODE_ORDER[(GAME_MODE_ORDER.indexOf(p.gameMode) + 1) % GAME_MODE_ORDER.length]),
        elegirDificultad: (d) => p.setDifficulty(d),
        elegirPalos: (n) => p.setStickCount(n),
        alternarSinFin: () => p.setEndless(!p.endless),
        alternarJugadores: () => p.setPlayers(p.players === 2 ? 1 : 2),
        elegirNivel: (n) => p.setLevel(n),
        elegirEscenario: (modo) => this.escenario?.elegir(sceneryOf(modo)),
        moverElAro: (pasos) => p.adjustHoop(pasos),
        verElTutorial: () => p.startGame({ tutorial: true }),
        jugar: () => p.startGame(),
        salir: () => this.escena.salir(),
      },
      this.punteria,
    )
    this.raiz.add_child(this.menu.nodo)
    this.marcador = new Marcador({ repetir: () => p.startGame(), volverAlMenu: () => p.resetGame() }, this.punteria)
    this.raiz.add_child(this.marcador.nodo)
    this.cartel = new Cartel()
    this.raiz.add_child(this.cartel.nodo)
    this.volver = new BotonDeVolver(() => p.askToQuit(), this.punteria)
    this.raiz.add_child(this.volver.nodo)
    this.terminar = new BotonDeTerminar(() => p.endRun(), this.punteria)
    this.raiz.add_child(this.terminar.nodo)
    this.aviso = new AvisoDeSalir({ dejar: () => p.resetGame(), seguir: () => p.keepPlaying() }, this.punteria)
    this.raiz.add_child(this.aviso.nodo)
    this.duelo = new PanelDelDuelo()
    this.raiz.add_child(this.duelo.nodo)
    this.cuenta = new CuentaAtras()
    this.raiz.add_child(this.cuenta.nodo)
    this.tutorial = new TutorialDelJuego({ siguiente: () => p.nextTutorialStep(), saltar: () => p.finishTutorial() }, this.punteria, opciones.manos)
    this.raiz.add_child(this.tutorial.vista.nodo)

    if (this.visor) {
      const pose = menuPoseFor(true)
      this.menu.nodo.position = new Vector3(...pose.position)
      this.menu.nodo.rotation = new Vector3(0, pose.yaw, 0)
      this.menu.nodo.scale = new Vector3(pose.scale, pose.scale, pose.scale)
      this.marcador.nodo.position = new Vector3(...XR_HUD_POSITION)
      this.cartel.colocar(sitioDelCartel())
      this.aviso.nodo.position = new Vector3(...XR_CONFIRM_POSITION)
      this.duelo.nodo.position = new Vector3(...XR_DUEL_POSITION)
      this.cuenta.nodo.position = new Vector3(...XR_COUNTDOWN_POSITION)
      // Delante del marcador: el fondo opaco del tutorial lo tapa donde se cruzan, como en la web.
      this.tutorial.vista.nodo.position = new Vector3(XR_TUTORIAL_POSITION[0], XR_TUTORIAL_POSITION[1], XR_TUTORIAL_POSITION[2] + 0.03)
    }

    // Si el salón cambia el idioma con el juego abierto, se repinta al siguiente fotograma.
    this.dejarDeEscuchar = alCambiarElIdioma(() => {
      this.pintadoMenu = ''
      this.pintadoMarcador = ''
      this.pintadoAviso = ''
      this.pintadoDuelo = ''
    })
    this.actualizar(0)
  }

  /** El idioma de ahora: el forzado o el del salón. */
  get lang(): Lang {
    return idioma(this.langForzado)
  }

  /** Un evento de entrada: el ratón lo lleva la puntería. */
  recibir(evento: InputEvent): boolean {
    return this.raton?.recibir(evento) ?? false
  }

  /** Si ese puntero está sobre un botón: entonces su clic es del botón, no un palo. */
  apunta(puntero: string): boolean {
    return this.punteria.apuntando(puntero) != null
  }

  /**
   * Escape (y B/Y o menú en el mando): en el menú sale del juego; con la pregunta delante, sigue; en
   * el final, al menú; jugando o contando, pregunta.
   */
  escape(): void {
    const p = this.partida
    if (p.prompt != null) p.keepPlaying()
    else if (p.gameState === 'menu') this.escena.salir()
    else if (p.gameState === 'finished') p.resetGame()
    else p.askToQuit()
  }

  /** Lo que enseña el menú ahora mismo. */
  estadoDelMenu(): EstadoDelMenu {
    const p = this.partida
    return {
      lang: this.lang,
      modo: p.gameMode,
      dificultad: p.activeDifficulty,
      palos: p.stickCount,
      sinFin: p.endless,
      nivel: p.activeLevel,
      abierto: p.unlockedLevel,
      estrellas: p.levelStars,
      ajusteDelAro: p.hoopAdjustment,
      habitacion: this.escenario?.hayHabitacion ?? false,
      escenario: sceneryModeOf(this.escenario?.elegido ?? 'place'),
      jugadores: p.players,
    }
  }

  /** Lo que enseña el marcador ahora mismo: lo de `XRHud.tsx`, y la letra del final de `HUD.tsx`. */
  estadoDelMarcador(): EstadoDelMarcador {
    const p = this.partida
    const t = traductor(this.lang)
    const sinFin = p.endlessRun
    const terminada = p.gameState === 'finished'
    const n = p.activeStickCount
    const record = p.bestPoints
    const lleno = sinFin ? Math.min(1, p.streak / Math.max(record, p.streak, 1)) : scoreRatio(p.points, p.activeDifficulty, n)
    const marca = sinFin ? (record > 0 ? Math.min(1, record / Math.max(record, p.streak, 1)) : 0) : scoreRatio(record, p.activeDifficulty, n)
    const nivel = p.levelResult
    const titulo = p.levels
      ? `${t('Level')} ${p.activeLevel}`
      : p.isRecord
        ? t(sinFin ? 'Best streak!' : 'New record!')
        : p.gameMode !== 'challenge'
          ? t('Game over!')
          : p.outcome === 'cleared'
            ? t('Challenge cleared!')
            : t('You are out of lives')
    return {
      lang: this.lang,
      modo: p.gameMode,
      terminada,
      fichas: stickStatuses(sinFin ? p.waveScore : p.score, sinFin ? p.waveResolved : p.resolved, n),
      racha: p.streak,
      lleno,
      marca,
      record: p.isRecord,
      vidas: startingLives(p.gameMode) == null ? null : p.lives,
      estrellas: terminada && nivel != null ? nivel.stars : null,
      titulo,
      puntos: p.points,
      // Jugando, de quién es la tanda; al acabar lo dice el aviso de pasar el mando, encima.
      jugador: terminada ? null : p.player,
      // Con el cartel del objetivo encima, los puntos y las vidas se leen allí.
      enElCartel: p.faseDelCartel != null,
    }
  }

  /** Sube la interfaz con los ojos, lo que el mundo no haya bajado ya (`xrUiRiseOverWorld`). */
  private subir(): void {
    if (!this.visor) return
    const ojos = this.ojos()
    const subida = ojos == null ? 0 : xrUiRiseOverWorld(ojos.alto, ojos.aLaAlturaDeLosOjos)
    this.raiz.position = new Vector3(0, subida, 0)
  }

  /** Un fotograma: la puntería (que puede cambiar la fase) y luego pintar lo que toca. */
  actualizar(delta: number): void {
    this.punteria.actualizar()
    this.subir()
    const p = this.partida
    const fase = p.gameState
    const lang = this.lang
    const pregunta = p.prompt != null

    this.menu.nodo.visible = fase === 'menu'
    if (fase === 'menu') {
      const estado = this.estadoDelMenu()
      const clave = JSON.stringify(estado)
      if (clave !== this.pintadoMenu) {
        this.menu.pintar(estado)
        this.pintadoMenu = clave
      }
    } else this.pintadoMenu = ''

    this.marcador.nodo.visible = fase !== 'menu'
    if (fase !== 'menu') {
      const estado = this.estadoDelMarcador()
      // Solo se reescribe cuando cambia: rehacer las etiquetas a cada fotograma es lo más caro.
      const clave = JSON.stringify(estado)
      if (clave !== this.pintadoMarcador) {
        this.marcador.pintar(estado)
        this.pintadoMarcador = clave
      }
    } else this.pintadoMarcador = ''

    // El cartel del objetivo: lo que toca decir y, al cruzar un listón, su celebración.
    this.listonCruzado = this.cartel.actualizar(p.cartel(lang), p.medalla, lang, delta)

    const enPartida = fase === 'playing' || fase === 'countdown'
    this.volver.nodo.visible = enPartida
    this.terminar.nodo.visible = p.endlessRun && fase === 'playing'
    this.aviso.nodo.visible = pregunta
    if (pregunta && this.pintadoAviso !== lang) {
      this.aviso.escribir(lang)
      this.pintadoAviso = lang
    }
    // A dos, al acabar cada tanda: el aviso de pasar el mando o quién gana.
    const duelo = fase === 'finished' ? p.duel : null
    this.duelo.nodo.visible = duelo != null
    if (duelo != null) {
      const dicho = duelSummary(duelo, getDuelTally(), lang)
      const clave = JSON.stringify(dicho)
      if (clave !== this.pintadoDuelo) {
        this.duelo.escribir(dicho)
        this.pintadoDuelo = clave
      }
    } else this.pintadoDuelo = ''
    this.cuenta.mostrar(fase === 'countdown' ? p.countdown : 0, delta)

    const enseña = (this.visor || this.tutorialEnPlano) && fase === 'playing'
    this.tutorial.actualizar(enseña ? p.tutorialStep : null, lang, p.bareHanded, delta)
    this.colocarEnPlano()
  }

  /** En plano, cada panel colgado de la cámara: se recoloca solo al cambiar de fase. */
  private colocarEnPlano(): void {
    const camara = this.camara
    if (this.visor || camara == null) return
    const terminada = this.partida.gameState === 'finished'
    if (this.colocadoEnPlano === String(terminada)) return
    this.colocadoEnPlano = String(terminada)
    const colgar = (nodo: Node3D, sitio: SitioEnPlano, subida = 0) => {
      const [x, y, z] = sitio.posicion
      const k = sitio.escala
      nodo.global_transform = new Transform3D(camara.global_basis.scaled(new Vector3(k, k, k)), camara.to_global(new Vector3(x, y - subida * k, z)))
    }
    colgar(this.menu.nodo, SITIOS_EN_PLANO.menu)
    // El final crece por arriba: se baja lo que sube para que quede en medio.
    if (terminada) colgar(this.marcador.nodo, SITIOS_EN_PLANO.final, SUBIDA_DEL_FINAL / 2)
    else colgar(this.marcador.nodo, SITIOS_EN_PLANO.marcador)
    colgar(this.volver.nodo, SITIOS_EN_PLANO.volver)
    colgar(this.terminar.nodo, SITIOS_EN_PLANO.terminar)
    colgar(this.aviso.nodo, SITIOS_EN_PLANO.aviso)
    colgar(this.duelo.nodo, SITIOS_EN_PLANO.duelo)
    colgar(this.cuenta.nodo, SITIOS_EN_PLANO.cuenta)
    // El cartel lleva su propia escala (crece y vuelve al celebrar un listón): se cuelga y se le dice.
    const cartel = terminada ? SITIOS_EN_PLANO.cartelDelFinal : SITIOS_EN_PLANO.cartel
    colgar(this.cartel.nodo, { ...cartel, escala: 1 })
    this.cartel.escalar(cartel.escala)
    colgar(this.tutorial.vista.nodo, SITIOS_EN_PLANO.tutorial)
  }

  /** Deja de escuchar el guardado: al salir de la escena. */
  soltar(): void {
    this.dejarDeEscuchar()
  }
}
