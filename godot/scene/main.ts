/**
 * Stick Rush en Godot: la escena, la entrada, el sonido y lo que se siente.
 *
 * Todo lo que decide algo —dónde cuelga cada palo y cuándo se suelta, cómo cae, cuándo se puede
 * coger, cuántos puntos da, cuándo acaba la partida, qué suena y qué vibra— viene de
 * `stick-rush/src/lib`, el mismo código que usa la web y con sus mismos tests. La partida
 * (`juego/partida.ts`) es el `gameStore` de la web sin React, y la tanda (`juego/tanda.ts`) lo que en
 * la web hace cada `Stick.tsx` fotograma a fotograma. Aquí se cose todo y se pinta.
 *
 * Tres formas de coger palos, y las tres pasan por el mismo `atrapar`:
 * - con visor, **con la mano**: al apretar el gatillo lateral de cualquiera de los dos mandos, el palo
 *   que queda dentro de la esfera de agarre del puño (la de la web, `CONTROLLER_GRAB_RADIUS`), colgando
 *   o cayendo. El rayo no coge palos: es para el menú. La gramática XR del kit planta la máquina
 *   donde la presta el salón, la baja a los ojos de quien juega sentado y la gira con el stick;
 * - en plano, **con el ratón**: un clic sobre el palo, como en la web;
 * - con `-- --autoplay`, un jugador automático que hace clic en cada palo a media caída (y deja
 *   escapar uno a propósito), para comprobar sin visor que la escena y la lógica están bien cosidas y
 *   para medir el coste. Juega siempre la misma partida: el reparto sale de una semilla fija.
 *
 * La escena de test `tests/xr_mando.tscn` juega con visor sin visor: mandos de mentira del kit y un
 * jugador automático que lleva el puño a cada palo y aprieta el agarre.
 *
 * Suena con los mismos efectos que la web, renderizados de su `sound.ts` por el kit, con la misma
 * regla de qué suena y cuándo (`useGameSound.ts`), y con su música; vibra con la de la web
 * (`pulsosDelAtrape` de `haptics.ts`, con las recetas de `tactos.ts`) en la mano que coge.
 */
import {
  Basis,
  Callable,
  Camera3D,
  DisplayServer,
  InputEvent,
  InputEventKey,
  InputEventMouseButton,
  Key,
  MouseButton,
  Node3D,
  Time,
  Transform3D,
  Vector2,
  Vector3,
  XRServer,
  print,
} from 'godot'

import { ACCION, estaAgarrando, type Mano } from '@kit/lib/xr/manos'
import { aislarElGuardado, argumento, hayBandera } from '@kit/runtime/argumentos'
import { Escenario, vistaDelVisor } from '@kit/runtime/escena/escenario'
import { Music, Sfx } from '@kit/runtime/sfx'
import { MandoDeVerdad } from '@kit/runtime/ui/mando'
import { XRPlayer } from '@kit/runtime/xr/jugador'
import { simularMandos, verConLaCabezaSimulada, type Simulacion } from '@kit/runtime/xr/simulado'

import { DIFFICULTY_SPEEDS, PLAYER_OFFSET_Z, STICK_MISS_Y, type Difficulty } from '@/lib/gameConfig'
import type { GameMode } from '@/lib/gameMode'
import { pulsosDelAtrape } from '@/lib/haptics'
import { headsetEyeHeight, hoopFallSpeed } from '@/lib/hoopHeight'
import * as hostAnchor from '@/lib/hostAnchor'
import { MUSIC_VOLUME } from '@/lib/music'
import { MUSIC_FADE_MS, fadeVolume } from '@/lib/musicFade'
import { semillaAlAzar, type Resultado } from '@/lib/semilla'
import { fallOrder } from '@/lib/stickLayout'
import { gameStorage } from '@/lib/storage'
import { followRatio } from '@/lib/xrAnchor'
import * as xrLayout from '@/lib/xrLayout'

import { niveles } from './interfaz/ajustes'
import { InterfazDelJuego } from './interfaz/interfaz'
import { paloEnElRayo, paloEnLaMano } from './juego/alcance'
import { Partida, type FaseDeLaPartida } from './juego/partida'
import { SOUNDS, sonidosDesde, type Pistas } from './juego/sonido'
import { Tanda, claveDeLaTanda, cuerpoDelPalo, type Palo } from './juego/tanda'
import { AyudasDelJuego } from './mundo/ayudas'
import { Feria } from './mundo/feria'
import { Maquina } from './mundo/maquina'
import { PalosPintados } from './mundo/palos'

const SFX_DIR = 'res://games/stick-rush/sfx'
const MUSIC_PATH = 'res://games/stick-rush/music/feria.mp3'
/** Los modelos de los mandos, copiados de `public/webxr-profiles/` (`npm run godot:mandos`). */
const DIR_DE_LOS_MANDOS = 'res://games/stick-rush/mandos'
const MANOS: readonly Mano[] = ['left', 'right']
/** Cada cuántos fotogramas se vuelve a preguntar al visor si da realidad aumentada (medio segundo). */
const RELEER_EL_VISOR = 36

/**
 * La cámara de la web en plano (`GameCanvas.tsx`): elevada y por detrás del jugador, porque a la
 * altura del aro un semicírculo horizontal se vería de canto, mirando al centro de la máquina.
 */
const CAMARA_EN_PLANO = { posicion: new Vector3(0, 1.9, 3.05), mira: new Vector3(0, 1.12, -0.25), campo: 52, cerca: 0.05, lejos: 60 } as const
/** Una cámara de plano desde un lado, para ver las ayudas: las huellas, el palo fantasma y el mando. */
const CAMARA_DE_LAS_AYUDAS = { posicion: new Vector3(0.45, 2.3, 1.45), mira: new Vector3(0, 0.85, -0.35) } as const

/**
 * La semilla del jugador automático: **siempre la misma partida**, que es lo que hace comparables dos
 * mediciones y deterministas los tests que lo usan.
 */
export const SEMILLA_DEL_BOT = 7

/** La partida del jugador automático: práctica, difícil y nueve palos. */
const PARTIDA_DEL_BOT: { modo: GameMode; dificultad: Difficulty; palos: number } = { modo: 'practice', dificultad: 'hard', palos: 9 }

/**
 * Cuándo coge el jugador automático cada palo: a media caída en tiempo, con el bonus de reflejos a
 * medias. Y el palo que deja escapar a propósito (el tercero en caer): así siempre hay uno que toca
 * el suelo, se tiñe de rojo y corta la racha.
 */
const CAIDA_DEL_BOT = 0.5
const TURNO_QUE_FALLA = 2

/** Lo que espera el informe del jugador automático tras el final, en segundos. */
const ESPERA_DEL_INFORME = 0.5

/** Lo que el jugador automático con visor se queda en el menú antes de jugar. */
const FOTOGRAMAS_EN_EL_MENU = 30

/**
 * La altura de ojos con que se colocan los palos en el menú (`XRPlayerHeight.tsx`): se persigue a
 * esta velocidad y solo se le da a la partida si se mueve más de esto.
 */
const SEGUIR_LA_ALTURA = 1.2
const UMBRAL_DE_LA_ALTURA = 0.02

type Driver = 'xr' | 'mouse' | 'bot'

export default class StickRush extends Node3D {
  private partida!: Partida
  private tanda: Tanda | null = null
  private driver: Driver = 'mouse'

  /** Donde cuelga la escena: el mundo del jugador con visor, o la propia escena. */
  private escena!: Node3D
  /** La máquina y todo lo suyo, corrido para dejar a quien juega un paso por detrás del centro del aro. */
  private maquinaYSuyo!: Node3D
  private maquina!: Maquina
  private palos!: PalosPintados
  private feria!: Feria
  private escenario!: Escenario
  private ayudas!: AyudasDelJuego
  private interfaz!: InterfazDelJuego
  private camera: Camera3D | null = null
  private sfx!: Sfx
  private music!: Music
  /** El mando de verdad en cada puño, para el tutorial. */
  private mandosEnLaMano: MandoDeVerdad[] = []

  /** Con visor: el jugador del kit y, en la escena de test, los mandos de mentira. */
  private player: XRPlayer | null = null
  private sim: Simulacion | null = null
  private agarrado: Record<Mano, boolean> = { left: false, right: false }
  /** La altura de ojos que se persigue en el menú y la última que se dio a la partida. */
  private alturaSeguida: number | null = null
  private alturaDada: number | null = null
  private ayudasEnPlano = false
  /** Hacia dónde mira la cabeza de mentira: a la izquierda y hacia abajo, en radianes (`--mirar`, `--bajar`). */
  private mirar = 0
  private bajar = 0

  /** El clic del ratón de este fotograma, como rayo de la cámara. */
  private clic: { origen: Vector3; dir: Vector3 } | null = null
  private pistas!: Pistas
  /** Lo que el jugador automático con visor tiene entre manos: qué palo, con qué mano. */
  private objetivoDelBot: { indice: number; mano: Mano; fotogramas: number } | null = null
  /** Fotogramas que le quedan al jugador automático para empezar, o `null` si no juega o ya empezó. */
  private arranqueDelBot: number | null = null

  private semillaFija: number | null = null
  private harness = false
  private harnessMenu = false
  private shotPath: string | null = null
  private shotMenuPath: string | null = null
  private shotAyudasPath: string | null = null
  private shotTutorialPath: string | null = null
  private framesDelMenu = 0
  private desdeElAtrape = -1
  private desdeElFinal = 0

  private frames = 0
  private usecTotal = 0
  private usecMax = 0
  private framesJugando = 0
  private usecJugando = 0
  private usecMaxJugando = 0
  private startedMs = 0
  private framesXr = 0
  /** Lo visto, para el informe. */
  private atrapesPorMano: Record<Mano, number> = { left: 0, right: 0 }
  private manosVistas = new Set<string>()
  private ayudasVistas = new Set<string>()
  private tutorialVisto = new Set<string>()
  private clicsFallidos = 0
  private resultados: Resultado[] = []

  _ready(): void {
    this.harnessMenu = this.has_meta('harness_menu')
    this.harness = this.has_meta('harness') || this.harnessMenu
    // Una escena de test o una captura guarda aparte y empieza de cero: si no, la marca del jugador
    // automático acabaría como récord de quien tenga el juego.
    aislarElGuardado(this.harness)
    const autoplay = hayBandera('autoplay') || (this.harness && !this.harnessMenu)
    const lang = argumento('lang')
    let reto: number | null = null
    this.shotPath = argumento('shot')
    this.shotMenuPath = argumento('shot-menu')
    this.shotAyudasPath = argumento('shot-ayudas')
    this.shotTutorialPath = argumento('shot-tutorial')
    const semilla = argumento('semilla')
    if (semilla) this.semillaFija = Number(semilla) >>> 0
    const linea = argumento('reto')
    if (linea) reto = Number(linea) >>> 0
    const mirar = argumento('mirar')
    if (mirar) this.mirar = (Number(mirar) * Math.PI) / 180
    const bajar = argumento('bajar')
    if (bajar) this.bajar = (Number(bajar) * Math.PI) / 180
    if (this.has_meta('semilla')) this.semillaFija = Number(this.get_meta('semilla')) >>> 0
    if (this.has_meta('reto')) reto = Number(this.get_meta('reto')) >>> 0
    // En el hub nativo, la semilla del reto la lleva su autoload como metadato (`challenge_seed`).
    const salon = this.get_node_or_null('/root/XRcade')
    if (salon != null && salon.has_meta('challenge_seed')) reto = Number(salon.get_meta('challenge_seed')) >>> 0
    if (autoplay && this.semillaFija == null) this.semillaFija = SEMILLA_DEL_BOT
    this.ayudasEnPlano = hayBandera('ayudas') || this.shotAyudasPath != null || this.has_meta('ayudas')

    // El visor simulado: el de la escena de test, o `-- --visor-simulado` para mirar en plano lo que
    // se ve con el visor (la cámara es la cabeza de mentira).
    const simulado = (this.harness && this.has_meta('xr_simulado')) || hayBandera('visor-simulado')
    this.driver = simulado ? 'xr' : autoplay ? 'bot' : this.startXr() ? 'xr' : 'mouse'
    this.escena = this
    if (this.driver === 'xr') this.buildXrPlayer(simulado)
    this.buildWorld(hayBandera('habitacion'))
    this.buildSound()

    this.partida = new Partida({
      reto: reto == null ? null : { semilla: reto },
      alTerminar: (resultado) => this.contarAlSalon(resultado),
      semillas: () => this.semillaFija ?? semillaAlAzar(),
    })
    this.partida.setImmersive(this.driver === 'xr')
    // Se empieza comparando con el menú, como la web: el reto, que entra contando, suena su 3.
    this.pistas = { score: 0, missed: 0, countdown: 0, gameState: 'menu', streak: 0, isRecord: false, levelPassed: null, lives: null }
    this.interfaz = new InterfazDelJuego(
      this.partida,
      { salir: () => this.exit() },
      {
        padre: this.escena,
        camara: this.camera,
        punteros: this.player?.punteros() ?? [],
        visor: this.driver === 'xr',
        lang,
        tutorial: hayBandera('tutorial') || this.shotTutorialPath != null,
        manos: this.mandosEnLaMano,
        ojos: () => {
          const player = this.player
          if (player == null) return null
          return { alto: player.estadoDelDecorado.altura.held, aLaAlturaDeLosOjos: player.ajustes.altura === 'eyes' }
        },
        escenario: this.escenario,
      },
    )
    // La captura de las ayudas las mira desde un lado, sin paneles delante.
    if (this.shotAyudasPath != null) this.interfaz.raiz.visible = false
    // El jugador automático no pasa por el menú: juega siempre la misma partida.
    // Con `--menu` se queda en el menú, para mirarlo con el visor simulado.
    // Con visor simulado espera un poco en el menú, que es donde se mide la altura de los ojos para
    // el aro (`XRPlayerHeight.tsx`).
    if ((this.driver === 'bot' || this.sim != null || this.shotTutorialPath != null) && reto == null && !hayBandera('menu')) {
      this.arranqueDelBot = this.sim != null ? FOTOGRAMAS_EN_EL_MENU : 0
    }
    this.arrancarElBot()
    this.startedMs = Time.get_ticks_msec()
  }

  /** La partida del jugador automático, cuando le toca: siempre la misma. */
  private arrancarElBot(): void {
    if (this.arranqueDelBot == null || this.arranqueDelBot > 0) return
    this.arranqueDelBot = null
    const p = this.partida
    p.setGameMode(PARTIDA_DEL_BOT.modo)
    p.setDifficulty(PARTIDA_DEL_BOT.dificultad)
    p.setStickCount(PARTIDA_DEL_BOT.palos)
    p.startGame(this.shotTutorialPath != null ? { tutorial: true } : undefined)
  }

  /** El mismo arranque que el hub: si no hay runtime de OpenXR, sigue en plano. */
  private startXr(): boolean {
    const xr = XRServer.find_interface('OpenXR')
    if (xr == null) return false
    if (!xr.is_initialized() && !xr.initialize()) return false
    DisplayServer.window_set_vsync_mode(DisplayServer.VSyncMode.VSYNC_DISABLED)
    this.get_viewport()!.use_xr = true
    return true
  }

  /**
   * El jugador con visor del kit, con los ficheros comunes tal cual: la altura (`xrLayout.ts`) y el
   * anclaje (`hostAnchor.ts`).
   */
  private buildXrPlayer(simulado: boolean): void {
    if (simulado) {
      this.sim = simularMandos()
      this.applyTestSettings()
    }
    // Stick Rush no tiene `uiHeight.ts`: la altura vive en su `xrLayout.ts`, con las mismas funciones
    // que el kit pide (`startTracking`, `trackHeight`, `worldRise`). Ni `agarre.ts` ni `pellizco.ts`:
    // aquí nada se lleva en la mano, los palos se cogen al apretar, y sin `agarre` el kit sujeta
    // mientras se aprieta (`AGARRE_MANTENIENDO`).
    this.player = new XRPlayer(this, { comunes: { uiHeight: xrLayout, hostAnchor } })
    // Sin visor de verdad, la cabeza de mentira hace de cámara: lo que se captura es lo que se vería.
    if (simulado) verConLaCabezaSimulada(this.player.camara)
    this.escena = this.player.mundo
    for (const mano of MANOS) {
      // B/Y y el botón de menú hacen lo que Escape en plano. Jugar y elegir se hacen apuntando.
      this.player.rayo[mano].button_pressed.connect(
        Callable.create(this, (boton: string) => {
          if (boton === 'by_button' || boton === 'menu_button') this.interfaz.escape()
        }),
      )
      // El mando de verdad en el puño: lo enciende el tutorial con el botón de su paso.
      const mando = new MandoDeVerdad({ mano, dir: DIR_DE_LOS_MANDOS })
      this.player.puno[mano].add_child(mando.nodo)
      this.mandosEnLaMano.push(mando)
    }
  }

  /** Los ajustes del salón que pide la escena de test (metadato `ajustes`), en el guardado. */
  private applyTestSettings(): void {
    const storage = gameStorage()
    if (storage == null || !this.has_meta('ajustes')) return
    const ajustes = JSON.parse(String(this.get_meta('ajustes'))) as Record<string, string>
    for (const [clave, valor] of Object.entries(ajustes)) storage.setItem(clave, valor)
  }

  /** La feria, la máquina, los palos, las ayudas y la cámara de plano. */
  private buildWorld(habitacion: boolean): void {
    // El mundo corrido lo que el jugador se aparta del centro del aro (`GameWorld.tsx`).
    this.maquinaYSuyo = new Node3D()
    this.maquinaYSuyo.set_name('MaquinaYSuyo')
    this.maquinaYSuyo.position = new Vector3(0, 0, -PLAYER_OFFSET_Z)
    this.escena.add_child(this.maquinaYSuyo)
    this.feria = new Feria(this, this.maquinaYSuyo)
    this.escenario = new Escenario({
      mostrar: (enLaPlaza) => this.feria.enLaPlaza(enLaPlaza),
      vista: vistaDelVisor(this.get_viewport()!),
      forzado: habitacion ? 'room' : null,
    })
    this.escenario.actualizar()
    this.maquina = new Maquina(this.maquinaYSuyo)
    this.palos = new PalosPintados(this.maquinaYSuyo)

    // El mando junto al palo fantasma es el de la mano buena; en plano (`--ayudas`), el de Quest 3.
    const player = this.player
    const mano = player?.manoBuena ?? 'right'
    const junto = new MandoDeVerdad({ mano, dir: DIR_DE_LOS_MANDOS, ...(player == null ? { perfil: () => 'oculus-touch-v3' } : {}) })
    this.ayudas = new AyudasDelJuego(this.maquinaYSuyo, [junto])

    if (player != null) return
    const camera = new Camera3D()
    camera.fov = CAMARA_EN_PLANO.campo
    camera.near = CAMARA_EN_PLANO.cerca
    camera.far = CAMARA_EN_PLANO.lejos
    const { posicion, mira } = this.shotAyudasPath != null ? CAMARA_DE_LAS_AYUDAS : CAMARA_EN_PLANO
    camera.transform = new Transform3D(Basis.looking_at(Vector3.SUBTRACT(mira, posicion), Vector3.UP), posicion)
    camera.current = true
    this.add_child(camera)
    this.camera = camera
  }

  /** Los efectos y la música. La escena de test pasa un bus silenciado, que cuenta igual. */
  private buildSound(): void {
    const bus = this.has_meta('sfx_bus') ? String(this.get_meta('sfx_bus')) : undefined
    this.sfx = new Sfx(this, { dir: SFX_DIR, names: SOUNDS, bus, levels: niveles })
    this.music = new Music(this, { path: MUSIC_PATH, volume: MUSIC_VOLUME, fade: fadeVolume, fadeMs: MUSIC_FADE_MS, bus, levels: niveles })
    this.music.start()
  }

  /** Lo que se compara de un fotograma al siguiente para saber qué suena (`useGameSound.ts`). */
  private pistasDeAhora(): Pistas {
    const p = this.partida
    return {
      score: p.score,
      missed: p.misses,
      countdown: p.countdown,
      gameState: p.gameState,
      streak: p.streak,
      isRecord: p.isRecord,
      levelPassed: p.levelResult?.passed ?? null,
      lives: p.lives,
    }
  }

  /** Le cuenta al salón cómo ha acabado una partida (`Resultado` de `semilla.ts`), si hay salón. */
  private contarAlSalon(resultado: Resultado): void {
    this.resultados.push(resultado)
    print(`STICK-RUSH-RESULTADO ${JSON.stringify(resultado)}`)
    const xrcade = this.get_node_or_null('/root/XRcade')
    if (xrcade != null && xrcade.has_method('report_result')) {
      ;(xrcade as unknown as { call(m: string, a: string): unknown }).call('report_result', JSON.stringify(resultado))
    }
  }

  private exit(): void {
    if (this.harnessMenu) {
      this.set_meta('salida', true)
      return
    }
    const xrcade = this.get_node_or_null('/root/XRcade')
    if (xrcade != null) (xrcade as unknown as { call(method: string): unknown }).call('exit_to_hub')
    else this.get_tree().quit()
  }

  /** El ratón va a la puntería de la interfaz, antes que a nada: es su rayo. */
  _input(event: InputEvent): void {
    this.interfaz?.recibir(event)
  }

  _unhandled_input(event: InputEvent): void {
    if (event instanceof InputEventKey && event.is_pressed() && event.keycode === Key.KEY_ESCAPE) this.interfaz.escape()
    // Un clic coge el palo que hay debajo, salvo que sea de un botón. Al apretar, como en la web
    // (`onPointerDown`): con el palo cayendo, esperar a soltar haría fallar clics que se sienten buenos.
    const raton = this.interfaz.raton
    if (
      this.camera != null &&
      raton != null &&
      event instanceof InputEventMouseButton &&
      event.is_pressed() &&
      event.button_index === MouseButton.MOUSE_BUTTON_LEFT &&
      !this.interfaz.apunta(raton.id)
    ) {
      const en: Vector2 = event.position
      this.clic = { origen: this.camera.project_ray_origin(en), dir: this.camera.project_ray_normal(en) }
    }
  }

  _process(delta: number): void {
    const t0 = Time.get_ticks_usec()
    const p = this.partida

    if (this.arranqueDelBot != null) {
      this.arranqueDelBot--
      this.arrancarElBot()
    }
    if (this.sim != null) this.driveXrBot()
    this.player?.update(delta)
    if (this.player != null) {
      this.medirLaAltura(delta)
      this.cogerConLaMano()
    }
    if (this.driver === 'bot') this.driveBot()
    this.cogerConElRaton()

    p.tick(delta)
    this.llevarLaTanda(delta)

    // Lo que suena, de los mismos contadores y con la misma regla que la web.
    const pistas = this.pistasDeAhora()
    for (const sonido of sonidosDesde(this.pistas, pistas)) this.sfx.play(sonido)
    this.pistas = pistas

    this.pintar(delta)
    this.music.update(delta)

    const spent = Time.get_ticks_usec() - t0
    this.frames++
    this.usecTotal += spent
    this.usecMax = Math.max(this.usecMax, spent)
    if (p.gameState === 'playing' && this.frames > 10) {
      this.framesJugando++
      this.usecJugando += spent
      this.usecMaxJugando = Math.max(this.usecMaxJugando, spent)
    }
    this.capturas(delta)
  }

  /**
   * La altura de ojos en el menú, para el aro (`XRPlayerHeight.tsx`): se mide la cabeza sobre el
   * suelo, se persigue despacio y se le da a la partida si se mueve de verdad. Con el mundo a la
   * altura de los ojos no: el aro ya viene con el mundo, y seguirla lo bajaría dos veces.
   */
  private medirLaAltura(delta: number): void {
    const player = this.player!
    const p = this.partida
    if (p.gameState !== 'menu') return
    if (player.ajustes.altura === 'eyes') {
      if (this.alturaDada !== null) p.setPlayerEyeHeight(null)
      this.alturaDada = null
      return
    }
    const medida = headsetEyeHeight(player.camara.position.y, true)
    if (medida == null) return
    this.alturaSeguida = this.alturaSeguida == null ? medida : this.alturaSeguida + (medida - this.alturaSeguida) * followRatio(delta, SEGUIR_LA_ALTURA)
    if (this.alturaDada != null && Math.abs(this.alturaSeguida - this.alturaDada) < UMBRAL_DE_LA_ALTURA) return
    this.alturaDada = this.alturaSeguida
    p.setPlayerEyeHeight(this.alturaSeguida)
  }

  /** La mano cerrada sobre un palo: al apretar el gatillo lateral, el palo que hay en el puño. */
  private cogerConLaMano(): void {
    const player = this.player!
    let conMando = false
    let conManos = false
    for (const mano of MANOS) {
      const puno = player.puno[mano]
      if (puno.get_has_tracking_data()) conMando = true
      if (player.manoDesnuda(mano) != null) conManos = true
      const apretado = estaAgarrando({ valor: puno.get_float(ACCION.agarre), clic: puno.is_button_pressed(ACCION.agarreClic), pellizco: false })
      const flanco = apretado && !this.agarrado[mano]
      this.agarrado[mano] = apretado
      if (!flanco || this.tanda == null) continue
      const pose = player.poseDelPuno(mano)
      if (pose == null) continue
      const punto = this.maquinaYSuyo.to_local(pose.origin)
      const palo = paloEnLaMano(this.tanda.cogibles(this.partida.paused), [punto.x, punto.y, punto.z])
      if (palo != null) this.atrapar(palo, mano)
    }
    // Manos y sin mandos: se enseña el pellizco (`playingBareHanded`).
    this.partida.setBareHanded(conManos && !conMando)
  }

  /** El clic del ratón de este fotograma, si lo hay: el primer palo que corta su rayo. */
  private cogerConElRaton(): void {
    const clic = this.clic
    this.clic = null
    if (clic == null || this.tanda == null) return
    const origen = this.maquinaYSuyo.to_local(clic.origen)
    const hacia = Vector3.SUBTRACT(this.maquinaYSuyo.to_local(Vector3.ADD(clic.origen, clic.dir)), origen).normalized()
    const palo = paloEnElRayo(this.tanda.cogibles(this.partida.paused), [origen.x, origen.y, origen.z], [hacia.x, hacia.y, hacia.z])
    if (palo == null) {
      this.clicsFallidos++
      return
    }
    this.atrapar(palo, null)
  }

  /** Coge un palo: la tanda lo enciende, la partida lo cuenta y vibra la mano que lo cogió. */
  private atrapar(palo: Palo, mano: Mano | null): void {
    const progreso = this.tanda!.atrapar(palo.indice, this.partida.paused)
    if (progreso == null) return
    // Primero el punto y luego el adorno, como en la web: la vibración no puede llevarse el acierto.
    this.partida.catchStick(progreso)
    this.desdeElAtrape = 0
    if (mano == null || this.player == null) return
    this.atrapesPorMano[mano]++
    this.player.vibrar(pulsosDelAtrape(mano, progreso))
  }

  /**
   * La tanda: una por partida y por recarga de la partida sin fin (`claveDeLaTanda`), con los palos
   * colocados a la altura del aro. Los que tocan el suelo cuentan como perdidos.
   */
  private llevarLaTanda(delta: number): void {
    const p = this.partida
    const clave = claveDeLaTanda(p.runId, p.stickSeed)
    const alto = p.hoopHeight
    if (this.tanda == null || this.tanda.clave !== clave) this.tanda = new Tanda(clave, p.stickSeed, p.activeStickCount, alto)
    else this.tanda.colocar(p.activeStickCount, alto)
    const velocidad = hoopFallSpeed(DIFFICULTY_SPEEDS[p.activeDifficulty], alto)
    const sucesos = this.tanda.avanzar(delta, { parada: p.paused, velocidad })
    for (let i = 0; i < sucesos.perdidos.length; i++) p.missStick()
  }

  /** Todo lo que se pinta, después de que la partida y la tanda hayan avanzado. */
  private pintar(delta: number): void {
    const p = this.partida
    this.maquina.colocar(p.hoopHeight)
    this.palos.pintar(this.tanda)
    this.feria.actualizar(delta, p.streak)
    if (this.frames % RELEER_EL_VISOR === 0) this.escenario.releer()
    this.escenario.actualizar()

    const dando = this.driver === 'xr' || this.ayudasEnPlano
    this.ayudas.actualizar(delta, {
      dando,
      hechos: { grab: p.score > 0, cae: p.gameState === 'playing' || (p.gameState === 'countdown' && p.countdown <= 1) },
      aro: p.hoopHeight,
      mano: this.player?.manoBuena ?? 'right',
    })
    for (const ayuda of this.ayudas.visibles()) this.ayudasVistas.add(ayuda)
    for (const mando of this.mandosEnLaMano) {
      mando.actualizar(delta)
      if (mando.visible) this.manosVistas.add(mando.mano)
    }
    this.interfaz.actualizar(delta)
    const paso = this.interfaz.tutorial.paso
    if (paso != null) this.tutorialVisto.add(paso)
  }

  /** Las capturas en plano, y el informe del jugador automático al acabar. */
  private capturas(delta: number): void {
    const p = this.partida
    if (this.desdeElAtrape >= 0) this.desdeElAtrape += delta
    const guardar = (ruta: string, extra: object = {}) => {
      this.get_viewport()!.get_texture()!.get_image()!.save_png(ruta)
      print(`STICK-RUSH-SHOT ${ruta} ${JSON.stringify(extra)}`)
      this.get_tree().quit(0)
    }
    // A mitad de partida: una décima después del segundo palo atrapado, con su destello a la vista.
    if (this.shotPath != null && p.score >= 2 && this.desdeElAtrape > 0.1) {
      guardar(this.shotPath, { puntos: p.points })
      this.shotPath = null
      return
    }
    if (this.shotTutorialPath != null && this.interfaz.tutorial.paso != null && this.framesJugando > 30) {
      guardar(this.shotTutorialPath, { paso: this.interfaz.tutorial.paso })
      this.shotTutorialPath = null
      return
    }
    if (this.shotAyudasPath != null && this.ayudas.visibles().length >= 2 && ++this.framesDelMenu > 90) {
      guardar(this.shotAyudasPath, { ayudas: this.ayudas.visibles() })
      this.shotAyudasPath = null
      return
    }
    if (this.shotMenuPath != null && (p.gameState === 'menu' || p.gameState === 'finished') && ++this.framesDelMenu > 20) {
      // Veinte fotogramas: las etiquetas en MSDF se generan al primer dibujo.
      guardar(this.shotMenuPath, { fase: p.gameState })
      this.shotMenuPath = null
      return
    }
    // El informe espera medio segundo tras el final: los pulsos del último atrape van en cola.
    if ((this.driver === 'bot' || this.sim != null) && p.gameState === 'finished' && this.shotPath == null && this.shotMenuPath == null) {
      this.desdeElFinal += delta
      if (this.desdeElFinal > ESPERA_DEL_INFORME) this.reportAndQuit()
    }
  }

  /** Dónde está ahora el centro del cuerpo de un palo, en el espacio global. */
  private centroDelPalo(palo: Palo): Vector3 {
    const { arriba, abajo } = cuerpoDelPalo(palo)
    return this.maquinaYSuyo.to_global(new Vector3((arriba[0] + abajo[0]) / 2, (arriba[1] + abajo[1]) / 2, (arriba[2] + abajo[2]) / 2))
  }

  /**
   * El palo al que toca ir: uno que ya lleva media caída en tiempo (la raíz de lo bajado, como
   * `stickFallProgress`), salvo el del turno que se deja escapar. `null` si ninguno.
   */
  private paloATiro(): Palo | null {
    const tanda = this.tanda
    const p = this.partida
    if (tanda == null || p.gameState !== 'playing') return null
    const queFalla = fallOrder(tanda.palos.length, p.stickSeed)[TURNO_QUE_FALLA]
    return (
      tanda.cogibles(p.paused).find((palo) => {
        if (palo.estado !== 'falling' || palo.indice === queFalla) return false
        const recorrido = palo.layout.anchor[1] - STICK_MISS_Y
        const bajado = palo.layout.anchor[1] - palo.y
        return recorrido > 0 && Math.sqrt(Math.min(1, bajado / recorrido)) >= CAIDA_DEL_BOT
      }) ?? null
    )
  }

  /** El jugador automático en plano: un clic del ratón en el palo que toca, por el mismo camino. */
  private driveBot(): void {
    const palo = this.paloATiro()
    if (palo == null || this.camera == null) return
    const origen = this.camera.global_position
    const blanco = this.centroDelPalo(palo)
    this.clic = { origen, dir: Vector3.SUBTRACT(blanco, origen).normalized() }
  }

  /**
   * El jugador automático con visor: mueve las manos de mentira como unas de verdad. Lleva el puño
   * de la mano del lado del palo hasta él y, un fotograma después, aprieta el agarre (el flanco es
   * lo que coge). A media partida empuja un momento el stick de la mano libre, que sentado gira el
   * mundo.
   */
  private driveXrBot(): void {
    const sim = this.sim!
    const player = this.player!
    const libre: Mano = player.manoBuena === 'left' ? 'right' : 'left'
    this.framesXr++
    const alto = this.has_meta('ojos') ? Number(this.get_meta('ojos')) : 1.6
    const ojos = new Vector3(0, alto, 0)
    // De frente al entrar, que es cuando se planta el mundo, y luego hacia donde se pida mirar.
    const cabeza = this.framesXr > 5 ? Basis.MULTIPLY(new Basis(Vector3.UP, this.mirar), new Basis(Vector3.RIGHT, -this.bajar)) : Basis.IDENTITY
    sim.cabeza(new Transform3D(cabeza, ojos))
    sim.manos[libre].stick(this.framesXr === 120 ? 1 : 0, 0)

    const objetivo = this.objetivoDelBot
    if (objetivo != null) {
      objetivo.fotogramas++
      const palo = this.tanda?.palos[objetivo.indice]
      const sigue = palo != null && (palo.estado === 'falling' || palo.estado === 'hanging')
      if (!sigue || objetivo.fotogramas > 2) this.objetivoDelBot = null
    }
    if (this.objetivoDelBot == null) {
      const palo = this.paloATiro()
      if (palo != null) {
        // La mano del lado del palo: la que llega sin cruzarse.
        const enElMundo = this.escena.to_local(this.centroDelPalo(palo))
        this.objetivoDelBot = { indice: palo.indice, mano: enElMundo.x < 0 ? 'left' : 'right', fotogramas: 0 }
      }
    }
    for (const mano of MANOS) {
      const va = this.objetivoDelBot?.mano === mano
      // En reposo, delante del pecho; si va, el puño al centro del palo, en el espacio del origen.
      let donde = Vector3.ADD(ojos, new Vector3(mano === 'left' ? -0.2 : 0.2, -0.45, -0.3))
      if (va) donde = player.origen.to_local(this.centroDelPalo(this.tanda!.palos[this.objetivoDelBot!.indice]))
      sim.manos[mano].poner(new Transform3D(Basis.IDENTITY, donde))
      // Apretar el fotograma después de llegar: el flanco de ese fotograma es el que coge.
      sim.manos[mano].agarre(va && this.objetivoDelBot!.fotogramas >= 1 ? 1.0 : 0.0)
    }
  }

  /**
   * En qué fase está la partida (`menu`, `countdown`, `playing`, `finished`, y `quit` con la pregunta
   * delante): para las escenas de test en GDScript, que no ven los objetos de JS.
   */
  fase(): string {
    const p = this.partida
    return p.prompt ?? (p.gameState as FaseDeLaPartida)
  }

  modo_de_la_partida(): string {
    return this.partida.gameMode
  }

  en_reto(): boolean {
    return this.partida.enReto
  }

  semilla_de_la_partida(): number {
    return this.partida.semilla
  }

  /** El reparto de la tanda en curso (turno y anclaje de cada palo): dos iguales son el mismo. */
  reparto_de_la_tanda(): string {
    return (this.tanda?.palos ?? []).map((pl) => `${pl.layout.delay.toFixed(4)}:${pl.layout.anchor.map((v) => v.toFixed(3)).join(',')}`).join(' ')
  }

  /** Cuántos palos se han cogido, y cuántos clics no dieron en ninguno: para la escena del ratón. */
  atrapados(): number {
    return this.partida.score
  }

  clics_fallidos(): number {
    return this.clicsFallidos
  }

  /** Lo elegido en el menú, para la escena de test del ratón. */
  eleccion(): string {
    const p = this.partida
    return `${p.gameMode}:${p.activeDifficulty}:${p.endless ? 'endless' : p.activeStickCount}`
  }

  /** La corrección del aro, para la escena del ratón. */
  ajuste_del_aro(): number {
    return this.partida.hoopAdjustment
  }

  /**
   * Dónde cae en la pantalla un botón de la interfaz (`play`, `exit`, `mode`…), para que una escena
   * de test lo pulse con el ratón como lo haría quien juega. `(-1, -1)` si no está a la vista.
   */
  pantalla_del_boton(id: string): Vector2 {
    const boton = this.interfaz.punteria.boton(id)
    if (boton == null || this.camera == null || !boton.nodo.is_visible_in_tree()) return new Vector2(-1, -1)
    return this.camera.unproject_position(boton.nodo.global_position)
  }

  /**
   * Dónde cae en la pantalla un palo que sigue colgando (el primero), o `(-1, -1)`: para que la
   * escena del ratón haga clic en él, quieto, antes y después de la cuenta atrás.
   */
  pantalla_del_palo(): Vector2 {
    const palo = this.tanda?.palos.find((p) => p.estado === 'hanging')
    if (palo == null || this.camera == null) return new Vector2(-1, -1)
    return this.camera.unproject_position(this.centroDelPalo(palo))
  }

  /** Lo que la escena de test con visor comprueba de la gramática XR. */
  private xrReport() {
    const player = this.player
    if (player == null) return null
    const decorado = player.estadoDelDecorado
    const mundo = player.mundo.global_transform.origin
    return {
      mano: player.manoBuena,
      subida: player.subida,
      colocacion: decorado.colocacion,
      giro: decorado.giro.yaw,
      mundo: { x: mundo.x, y: mundo.y, z: mundo.z },
      aro: this.partida.hoopHeight,
      atrapesPorMano: this.atrapesPorMano,
      vibraciones: player.vibraciones.map((v) => ({ mano: v.mano, amplitud: Number(v.amplitud.toFixed(4)), segundos: v.segundos, t: Math.round(v.t) })),
      ayudas: [...this.ayudasVistas],
      manosConMando: [...this.manosVistas].sort(),
      tutorial: [...this.tutorialVisto],
    }
  }

  private reportAndQuit(): void {
    const p = this.partida
    const result = {
      outcome: p.outcome,
      points: p.points,
      score: p.score,
      resolved: p.resolved,
      misses: p.misses,
      sticks: p.activeStickCount,
      bestStreak: p.bestStreak,
      record: p.isRecord,
      best: p.bestPoints,
      semilla: p.semilla,
      frames: this.frames,
      usecAvg: Math.round(this.usecTotal / this.frames),
      usecMax: this.usecMax,
      usecJugandoAvg: this.framesJugando > 0 ? Math.round(this.usecJugando / this.framesJugando) : 0,
      usecJugandoMax: this.usecMaxJugando,
      wallMs: Time.get_ticks_msec() - this.startedMs,
      sfx: this.sfx.counts,
      variants: Object.fromEntries(SOUNDS.map((name) => [name, this.sfx.variantCount(name)])),
      music: { playing: this.music.playing, volume: Number(this.music.volume.toFixed(3)) },
      levels: niveles(),
      resultados: this.resultados,
      maquina: this.maquina.piezas,
      feria: this.feria.recuento,
      palos: (this.tanda?.palos ?? []).map((pl) => pl.estado),
      xr: this.xrReport(),
    }
    print(`STICK-RUSH-RESULT ${JSON.stringify(result)}`)
    this.set_process(false)
    this.sim?.quitar()
    if (this.harness) {
      this.set_meta('result', JSON.stringify(result))
      return
    }
    if (this.get_node_or_null('/root/XRcade') != null) this.exit()
    else this.get_tree().quit(p.score > 0 ? 0 : 1)
  }
}
