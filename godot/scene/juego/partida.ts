/**
 * La partida de Stick Rush en Godot: lo que en la web es `lib/gameStore.ts`, sin React.
 *
 * El store de la web es un hook (`useState`, `useEffect`, `useSyncExternalStore`) y el motor no
 * tiene React, así que aquí se escribe la misma máquina como una clase que la escena avanza a cada
 * fotograma. **Las reglas no se reescriben**: el final sale de `gameMode.ts` (`runOutcome`, las
 * vidas), los puntos de `scoring.ts`, los niveles y sus estrellas de `levels.ts`, la altura del aro
 * de `hoopHeight.ts`, la lección de `tutorial.ts` y lo guardado de `marcas.ts` y `progress.ts`. Lo
 * que queda aquí es lo que en la web hacen los `useState` y los `useEffect`: qué se ha elegido, en
 * qué fase se está, los contadores de la partida en curso y los relojes (la cuenta atrás y el plazo
 * de cada paso de la lección).
 *
 * Igual que en la web, **casi todo se deriva**: la fase sale de si hay partida, de la cuenta atrás y
 * de los palos resueltos; las vidas, de los perdidos; el paso del tutorial, de los atrapados y de lo
 * saltado. Lo que no se deriva es lo que la web guarda en estado, con los mismos nombres.
 *
 * **La partida a dos también**, como en la web (`lib/duel.ts`): en el desafío, a dos, cada partida es
 * la tanda de uno, con la semilla del primero para el segundo; la tanda recién acabada se deduce de
 * los puntos y se apunta al empezar la siguiente; al acabar la segunda se apunta a la pareja
 * (`duelTally.ts`) y se le cuenta al salón una vez, sin tocar el récord.
 *
 * No toca el motor (ni `godot` ni nodos), así que se prueba entera en `partida.motor.test.ts` sin
 * montar la escena.
 */
import { MAX_STICKS, MIN_STICKS, type Difficulty } from '@/lib/gameConfig'
import type { Lang } from '@/lib/ajustes'
import { llevaLaCuenta, partidaDelCartel } from '@/lib/cartelDeLaMaquina'
import { CHALLENGE_SETUP, DEFAULT_GAME_MODE, remainingLives, runOutcome, type GameMode, type RunOutcome } from '@/lib/gameMode'
import {
  controllerHolder,
  createDuel,
  duelOver,
  duelWinner,
  juegaADos,
  mejorDelDuelo,
  recordTurn,
  type Duel,
  type Player,
  type PlayerCount,
} from '@/lib/duel'
import { saveDuelResult } from '@/lib/duelTally'
import {
  SIN_HAZANAS,
  conHazanas,
  contarAtrape,
  contarTanda,
  estrenarHazanas,
  type CuentaDeHazanas,
  type ResultadoConHazanas,
} from '@/lib/hazanas'
import { HOOP_ADJUST_STEP, clampHoopAdjustment, getHoopAdjustment, hoopHeightFor, saveHoopAdjustment } from '@/lib/hoopHeight'
import { LEVEL_COUNT, clampLevel, levelPassed, levelSpec, levelStars, type Stars } from '@/lib/levels'
import { getBestEndlessStreak, getBestPoints, saveBestEndlessStreak, saveBestPoints } from '@/lib/marcas'
import {
  cartelDeObjetivo,
  medallaQueCelebra,
  type FaseDelObjetivo,
  type Medalla,
  type Objetivo,
  type Partida as PartidaDelObjetivo,
  type VistaDelCartel,
} from '@/lib/objetivo'
import { getStarsList, getUnlockedLevel, saveLevelResult } from '@/lib/progress'
import { stickPoints } from '@/lib/scoring'
import { semillaAlAzar, semillaDe, type Reto } from '@/lib/semilla'
import { traductorSuave } from '@/lib/textos'
import {
  PLAZO_DEL_PASO,
  hitosAtrapando,
  markTutorialSeen,
  saltarPaso,
  tutorialSeen as leerTutorialVisto,
  tutorialStep as pasoDelTutorial,
  type TutorialStepKey,
} from '@/lib/tutorial'

/** Las fases de la web (`GameState`). La pregunta de salir va aparte, en `prompt`, como allí. */
export type FaseDeLaPartida = 'menu' | 'countdown' | 'playing' | 'finished'

/** Segundos de cuenta atrás entre pulsar «jugar» y el primer palo (`COUNTDOWN_SECONDS`). */
export const COUNTDOWN_SECONDS = 3

/** El modo que se juega con el `reto` del salón: el del récord de la cabina (`MODO_DEL_RETO`). */
export const MODO_DEL_RETO: GameMode = 'challenge'

/** Cómo acabó el nivel jugado: lo que enseña el final (`levelResult` de la web). */
export interface ResultadoDelNivel {
  stars: Stars
  passed: boolean
  /** El nivel que abre esta partida, si abre alguno. */
  unlocked: number | null
}

/** Restringe el número de palos al rango permitido (`clampStickCount`). */
export function acotarPalos(palos: number): number {
  if (Number.isNaN(palos)) return MIN_STICKS
  return Math.min(MAX_STICKS, Math.max(MIN_STICKS, Math.round(palos)))
}

export interface OpcionesDeLaPartida {
  /** Jugar este reto: se entra directamente en una partida del desafío, con los palos de su semilla. */
  reto?: Reto | null
  /**
   * Se llama una vez al acabar cada partida con puntuación (no al dejarla a medias), con las
   * hazañas estrenadas en ella si hay alguna (`hazanas.ts`).
   */
  alTerminar?: (resultado: ResultadoConHazanas) => void
  /** De dónde sale la semilla de una partida que no es el reto. Por defecto, al azar. */
  semillas?: () => number
  /**
   * Los listones de medalla del juego y la marca de quien juega, para el cartel de encima del
   * marcador (`objetivo.ts`). Sin él, el cartel dice la misión y el récord guardado aquí.
   */
  objetivo?: Objetivo | null
}

export class Partida {
  // Lo que se elige en el menú.
  stickCount = MIN_STICKS
  difficulty: Difficulty = 'easy'
  /** Se abre en el reto, con salón o sin él (`DEFAULT_GAME_MODE`): la práctica queda a un toque. */
  gameMode: GameMode = DEFAULT_GAME_MODE
  endless = false
  /** Nivel elegido en Niveles, o `null` = el más alto desbloqueado. */
  level: number | null = null
  /** Solo, o a dos pasándose el mando: solo cuenta en el desafío (`juegaADos`). */
  players: PlayerCount = 1

  // La partida en curso.
  running = false
  /** Segundos que quedan de cuenta atrás, con decimales: se enseña redondeado hacia arriba (`countdown`). */
  cuentaAtras = 0
  prompt: 'quit' | null = null
  runId = 0
  /** De dónde sale el reparto de la partida: la del reto, o una nueva en cada partida. */
  semilla = 0
  /** Lo que se juega ahora es el reto que pasó el salón. Solo la primera: «otra vez» ya es suya. */
  enReto = false
  wave = 0
  private waveStart = { score: 0, resolved: 0 }
  score = 0
  resolved = 0
  points = 0
  streak = 0
  bestStreak = 0

  // Lo que la web lleva en estado aunque no sea de la partida.
  /** Corrección manual de la altura del aro, guardada entre visitas. */
  hoopAdjustment: number
  /** Lo que mide el visor, o `null` sin visor o sin suelo. */
  playerEyeHeight: number | null = null
  tutorialSeen: boolean
  /** Si esta partida va enseñando a jugar (la lección corre con la partida, no la para). */
  teaching = false
  /** Si se juega con las gafas puestas: decide a quién se enseña la lección. */
  immersive = false
  /** Si se juega con las manos desnudas: cambia la frase de la lección, no el gesto. */
  bareHanded = false

  private tutorialSkipped = 0
  /** Segundos que lleva el paso de ahora a la vista, para su plazo de seguridad (`PLAZO_DEL_PASO`). */
  private plazo = 0
  private pasoDelPlazo: TutorialStepKey | null = null
  private endedByPlayer = false
  private recordToBeat = 0
  private unlockedAtStart = 1
  private levelAtStart = 1
  private readonly alTerminar: ((resultado: ResultadoConHazanas) => void) | undefined
  private readonly semillas: () => number
  private readonly objetivo: Objetivo | null
  /** La partida (su `runId`) cuyo final ya se guardó y se contó al salón. */
  private avisada = -1
  /** Si la lección de esta partida ya se anotó como vista al superar sus pasos. */
  private anotada = false
  /** De qué tanda se pasó ya en la partida sin fin: dos pasadas por la misma no suman dos. */
  private advancedWave = -1
  /** La partida a dos con las tandas ya cerradas apuntadas; la recién acabada se deduce (`duel`). */
  private duelo: Duel | null = null
  /** Las hazañas de la partida en curso; a dos, las de los dos turnos (`hazanas` de la web). */
  private hazanas: CuentaDeHazanas = SIN_HAZANAS

  constructor({ reto = null, alTerminar, semillas = semillaAlAzar, objetivo = null }: OpcionesDeLaPartida = {}) {
    this.objetivo = objetivo
    this.alTerminar = alTerminar
    this.semillas = semillas
    this.hoopAdjustment = getHoopAdjustment()
    this.tutorialSeen = leerTutorialVisto()
    if (reto != null) {
      // Con el reto del salón se entra directamente a jugar, como en la web: sin menú ni lección.
      this.gameMode = MODO_DEL_RETO
      this.enReto = true
      this.semilla = reto.semilla >>> 0
      this.recordToBeat = getBestPoints(MODO_DEL_RETO)
      this.running = true
      this.cuentaAtras = COUNTDOWN_SECONDS
    }
  }

  get levels(): boolean {
    return this.gameMode === 'levels'
  }

  /** Práctica sin fin: la máquina se recarga cada vez que se vacía. */
  get endlessRun(): boolean {
    return this.gameMode === 'practice' && this.endless
  }

  get unlockedLevel(): number {
    return getUnlockedLevel()
  }

  /** Las estrellas de cada nivel, del primero al último. */
  get levelStars(): Stars[] {
    return getStarsList().split(',').map((s) => Number(s) as Stars)
  }

  private get selectedLevel(): number {
    const abierto = getUnlockedLevel()
    return clampLevel(Math.min(this.level ?? abierto, abierto))
  }

  /** El nivel que se juega: el elegido, o el más alto; durante la partida, el de al empezar. */
  get activeLevel(): number {
    return this.running ? this.levelAtStart : this.selectedLevel
  }

  /** Lo que cuelga: lo elegido en práctica, lo del nivel en Niveles y lo fijo del desafío. */
  private get setup(): { difficulty: Difficulty; stickCount: number } {
    if (this.levels) return levelSpec(this.activeLevel)
    if (this.gameMode === 'challenge') return CHALLENGE_SETUP
    return { difficulty: this.difficulty, stickCount: this.stickCount }
  }

  get activeDifficulty(): Difficulty {
    return this.setup.difficulty
  }

  get activeStickCount(): number {
    return this.setup.stickCount
  }

  /** La semilla del reparto de la tanda en curso: cada tanda de la partida sin fin trae palos nuevos. */
  get stickSeed(): number {
    return semillaDe(this.semilla, this.wave)
  }

  get waveScore(): number {
    return this.score - this.waveStart.score
  }

  get waveResolved(): number {
    return this.resolved - this.waveStart.resolved
  }

  get misses(): number {
    return this.resolved - this.score
  }

  get lives(): number | null {
    return remainingLives(this.gameMode, this.misses)
  }

  get outcome(): RunOutcome | null {
    if (!this.running) return null
    if (this.endlessRun) return this.endedByPlayer ? 'cleared' : null
    return runOutcome({ mode: this.gameMode, resolved: this.resolved, misses: this.misses, stickCount: this.activeStickCount })
  }

  /** La cifra de la cuenta atrás, como la lleva la web: 3, 2, 1 y 0 fuera de ella (`countdown`). */
  get countdown(): number {
    return Math.ceil(this.cuentaAtras)
  }

  get gameState(): FaseDeLaPartida {
    if (!this.running) return 'menu'
    if (this.countdown > 0) return 'countdown'
    if (this.outcome != null) return 'finished'
    return 'playing'
  }

  /** Qué paso de la lección toca enseñar, o `null` si no hay lección o ya no queda nada. */
  get tutorialStep(): TutorialStepKey | null {
    return this.teaching ? pasoDelTutorial(hitosAtrapando(this.score), this.tutorialSkipped) : null
  }

  get levelResult(): ResultadoDelNivel | null {
    if (!this.levels || this.gameState !== 'finished') return null
    const stars = levelStars(this.score, this.activeStickCount)
    const passed = levelPassed(stars)
    const nivel = this.activeLevel
    const abre = passed && nivel + 1 > this.unlockedAtStart && nivel < LEVEL_COUNT
    return { stars, passed, unlocked: abre ? nivel + 1 : null }
  }

  /** La marca de este modo: puntos, o la racha en la partida sin fin; en Niveles no hay marca. */
  get bestPoints(): number {
    return this.endlessRun ? getBestEndlessStreak() : this.levels ? 0 : getBestPoints(this.gameMode)
  }

  /**
   * La partida recién terminada ha batido la marca con la que empezó y lo guardado es justo esta
   * puntuación (con el almacenamiento bloqueado la marca a batir se quedaría a cero para siempre).
   */
  get isRecord(): boolean {
    const hecho = this.endlessRun ? this.bestStreak : this.points
    return this.gameState === 'finished' && !this.levels && this.duelo == null && hecho > this.recordToBeat && this.bestPoints === hecho
  }

  /**
   * La partida a dos, con la tanda recién acabada ya apuntada, o `null` si se juega solo: el aviso
   * de pasar el mando y el de quién ha ganado salen de aquí (`duelAhora` de la web).
   */
  get duel(): Duel | null {
    return this.duelo != null && this.gameState === 'finished' ? recordTurn(this.duelo, this.points) : this.duelo
  }

  /** Quién tiene el mando en la partida a dos, o `null` si se juega solo. */
  get player(): Player | null {
    const duelo = this.duel
    return duelo == null ? null : controllerHolder(duelo)
  }

  /** Si el final suena a ganar encima del cierre: un récord, o el final de una partida a dos. */
  get celebra(): boolean {
    const duelo = this.duel
    return this.isRecord || (duelo != null && duelOver(duelo))
  }

  /** La partida tal y como se le cuenta al cartel del objetivo (`partidaDelCartel` de la web). */
  private paraElCartel(lang: Lang): PartidaDelObjetivo | null {
    return partidaDelCartel(
      {
        objetivo: this.objetivo,
        gameMode: this.gameMode,
        aDos: this.duel != null,
        gameState: this.gameState,
        points: this.points,
        lives: this.lives,
        resolved: this.resolved,
        stickCount: this.activeStickCount,
        record: this.recordToBeat,
      },
      traductorSuave(lang),
    )
  }

  /**
   * Lo que dice el cartel de encima del marcador, en ese idioma, o `null` si no hay nada que colgar:
   * en el menú, y fuera del reto con el juego abierto suelto.
   */
  cartel(lang: Lang): VistaDelCartel | null {
    const partida = this.paraElCartel(lang)
    return partida == null ? null : cartelDeObjetivo(partida, traductorSuave(lang))
  }

  /**
   * En qué momento va la partida que cuenta para medalla, o `null` si lo que se juega no cuenta: con
   * ella el cartel ya dice los puntos y las vidas, y el marcador los calla (`faseDelCartel` de la web).
   */
  get faseDelCartel(): FaseDelObjetivo | null {
    const partida = this.paraElCartel('en')
    return llevaLaCuenta(partida) ? partida.fase : null
  }

  /** La medalla que ya es de quien juega en esta partida: cuando sube, se celebra el listón. */
  get medalla(): Medalla | null {
    const partida = this.paraElCartel('en')
    return partida == null ? null : medallaQueCelebra(partida)
  }

  /** La altura del aro para quien juega: la del visor más la corrección, con sus topes. */
  get hoopHeight(): number {
    return hoopHeightFor({ eyeHeight: this.playerEyeHeight, adjustment: this.hoopAdjustment })
  }

  /** Los palos se quedan colgando fuera de la partida y con la pregunta delante (`paused`). */
  get paused(): boolean {
    return this.gameState !== 'playing' || this.prompt !== null
  }

  // Lo que se elige entre partidas.

  setStickCount(palos: number): void {
    this.stickCount = acotarPalos(palos)
  }

  setDifficulty(nivel: Difficulty): void {
    this.difficulty = nivel
  }

  setEndless(sinFin: boolean): void {
    this.endless = sinFin
  }

  /** Solo, o a dos pasándose el mando. Se lee al empezar cada partida. */
  setPlayers(cuantos: PlayerCount): void {
    this.players = cuantos
  }

  /** El modo es de la partida entera: con el resumen en pantalla, cambiarlo copiaría los puntos a otro récord. */
  setGameMode(modo: GameMode): void {
    if (!this.running) this.gameMode = modo
  }

  setLevel(nivel: number): void {
    if (!this.running) this.level = clampLevel(Math.min(nivel, getUnlockedLevel()))
  }

  /** Sube o baja el aro por pasos; se guarda al tocarlo, y solo si cambia. */
  adjustHoop(pasos: number): void {
    const siguiente = clampHoopAdjustment(this.hoopAdjustment + pasos * HOOP_ADJUST_STEP)
    if (siguiente === this.hoopAdjustment) return
    saveHoopAdjustment(siguiente)
    this.hoopAdjustment = siguiente
  }

  setPlayerEyeHeight(alto: number | null): void {
    this.playerEyeHeight = alto
  }

  setImmersive(conVisor: boolean): void {
    this.immersive = conVisor
  }

  setBareHanded(conLasManos: boolean): void {
    this.bareHanded = conLasManos
  }

  private clearRun(): void {
    this.score = 0
    this.resolved = 0
    this.points = 0
    this.streak = 0
    this.bestStreak = 0
    this.wave = 0
    this.waveStart = { score: 0, resolved: 0 }
    this.endedByPlayer = false
    this.advancedWave = -1
  }

  /**
   * Empieza una partida con lo elegido. Enciende la lección cuando toca —con las gafas puestas y
   * sin haberla visto—, y `tutorial` fuerza la decisión (el botón de volver a verla).
   */
  startGame(opciones?: { tutorial?: boolean }): void {
    // La partida a dos con la tanda que acaba de terminar: antes de vaciar los contadores, que es de
    // donde sale.
    const ahora = this.duel
    this.prompt = null
    // Se relee: la lección que se termina atrapando queda anotada sin pasar por aquí.
    const visto = leerTutorialVisto()
    this.tutorialSeen = visto
    this.clearRun()
    this.enReto = false
    // A dos, el segundo juega la semilla del primero: los mismos palos en el mismo orden. Con la
    // partida acabada, o sin ninguna, empieza otra con una semilla nueva.
    this.duelo = !juegaADos(this.gameMode, this.players) ? null : ahora == null || duelOver(ahora) ? createDuel(this.semillas() >>> 0) : ahora
    // Las hazañas empiezan de cero con cada partida, salvo el segundo turno de una a dos.
    if (this.duelo == null || this.duelo !== ahora) this.hazanas = SIN_HAZANAS
    this.semilla = this.duelo?.semilla ?? this.semillas() >>> 0
    this.recordToBeat = this.endlessRun ? getBestEndlessStreak() : getBestPoints(this.gameMode)
    this.unlockedAtStart = getUnlockedLevel()
    this.levelAtStart = this.selectedLevel
    this.runId++
    this.teaching = opciones?.tutorial ?? (this.immersive && !visto)
    this.tutorialSkipped = 0
    this.plazo = 0
    this.anotada = false
    this.cuentaAtras = COUNTDOWN_SECONDS
    this.running = true
  }

  /** Retira la lección y la da por vista (saltarla o acabarla). No toca la partida. */
  finishTutorial(): void {
    if (!this.teaching) return
    markTutorialSeen()
    this.tutorialSeen = true
    this.teaching = false
  }

  /** Da por pasado el paso de ahora: el botón de siguiente. */
  nextTutorialStep(): void {
    const paso = this.tutorialStep
    if (paso == null) return
    this.tutorialSkipped = saltarPaso(this.tutorialSkipped, paso)
  }

  /**
   * Palo atrapado: `fallProgress` (0 recién soltado, 1 a ras de suelo) decide el bonus por reflejos.
   * `espaldas`, si se cogió de espaldas a él (`deEspaldas` de `hazanas.ts`).
   */
  catchStick(fallProgress: number, espaldas = false): void {
    this.hazanas = contarAtrape(this.hazanas, { espaldas })
    this.score++
    this.resolved++
    this.streak++
    this.bestStreak = Math.max(this.bestStreak, this.streak)
    this.points += stickPoints({ difficulty: this.activeDifficulty, streak: this.streak, fallProgress })
    this.alCambiar()
  }

  /** Palo perdido: rompe la racha, cuenta para cerrar la partida y, en desafío, cuesta una vida. */
  missStick(): void {
    this.resolved++
    this.streak = 0
    this.alCambiar()
  }

  /** Termina la partida sin fin a voluntad: es su única salida con resumen. */
  endRun(): void {
    this.endedByPlayer = true
    this.alCambiar()
  }

  askToQuit(): void {
    this.prompt = 'quit'
  }

  keepPlaying(): void {
    this.prompt = null
  }

  /** Vuelve al menú sin guardar nada. Dejar la lección a medias no cuenta como haberla visto. */
  resetGame(): void {
    // Volver al menú deja la partida a dos: la siguiente empieza de cero. Lo conseguido en la
    // partida dejada a medias no se cuenta, como sus puntos.
    this.duelo = null
    this.hazanas = SIN_HAZANAS
    this.prompt = null
    this.clearRun()
    this.cuentaAtras = 0
    this.teaching = false
    this.tutorialSkipped = 0
    this.enReto = false
    this.running = false
  }

  /**
   * Un fotograma de reloj: la cuenta atrás (parada con la pregunta delante) y el plazo del paso de
   * la lección, que solo corre jugando de verdad y vuelve a empezar al pararse, como el `setTimeout`
   * de la web que se rehace con cada cambio de sus dependencias.
   */
  tick(delta: number): void {
    const d = Math.max(0, delta)
    // El plazo cuenta lo jugado de verdad: el fotograma en que se acaba la cuenta atrás no es suyo.
    const jugaba = this.gameState === 'playing' && this.prompt === null
    if (this.running && this.cuentaAtras > 0 && this.prompt === null) {
      this.cuentaAtras = Math.max(0, this.cuentaAtras - d)
    }
    const paso = this.tutorialStep
    const corre = paso != null && jugaba && this.gameState === 'playing' && this.prompt === null
    if (!corre || paso !== this.pasoDelPlazo) {
      this.plazo = 0
      this.pasoDelPlazo = paso
    }
    if (corre) {
      this.plazo += d
      if (this.plazo >= PLAZO_DEL_PASO[paso]) this.tutorialSkipped = saltarPaso(this.tutorialSkipped, paso)
    }
    // Superados los pasos, la lección queda anotada como vista, aunque el panel ya se haya ido solo.
    if (this.teaching && this.tutorialStep === null && !this.anotada) {
      markTutorialSeen()
      this.anotada = true
    }
    this.alCambiar()
  }

  /**
   * Lo que en la web hacen los efectos al cambiar los contadores: recargar la máquina en la partida
   * sin fin al resolver la tanda, y al acabar, guardar y contárselo al salón una sola vez.
   */
  private alCambiar(): void {
    if (this.running && this.endlessRun && this.gameState === 'playing' && this.waveResolved >= this.activeStickCount) {
      if (this.advancedWave !== this.wave) {
        this.advancedWave = this.wave
        this.hazanas = contarTanda(this.hazanas, { palos: this.activeStickCount, atrapados: this.waveScore, ajusteDelAro: this.hoopAdjustment })
        this.waveStart = { score: this.score, resolved: this.resolved }
        this.wave++
      }
    }
    // Guardar solo hace algo si mejora lo que había, así que basta una vez por partida: en la web
    // el efecto se repite con cada render de la pantalla final sin cambiar nada.
    if (this.gameState !== 'finished' || this.avisada === this.runId) return
    this.avisada = this.runId
    // La tanda de la partida, si se ha resuelto entera (la que acaba sin vidas no). La partida sin
    // fin cuenta cada tanda al recargar, y la que se deja a medias al terminarla no es tanda.
    if (!this.endlessRun && this.resolved === this.activeStickCount) {
      this.hazanas = contarTanda(this.hazanas, { palos: this.activeStickCount, atrapados: this.score, ajusteDelAro: this.hoopAdjustment })
    }
    // A dos no hay récord que guardar: una tanda a dos no es la marca de nadie. Al acabar la
    // segunda se apunta quién gana y se le cuenta al salón la partida entera, con lo mejor.
    const duelo = this.duel
    if (duelo != null) {
      if (!duelOver(duelo)) return
      saveDuelResult(duelWinner(duelo))
      this.alTerminar?.(conHazanas({ modo: 'duel', puntos: mejorDelDuelo(duelo), reto: false }, estrenarHazanas(this.hazanas.logradas)))
      return
    }
    const nivel = this.levelResult
    if (nivel != null) saveLevelResult(this.activeLevel, nivel.stars)
    else if (this.endlessRun) saveBestEndlessStreak(this.bestStreak)
    else saveBestPoints(this.gameMode, this.points)
    this.alTerminar?.(conHazanas({ modo: this.gameMode, puntos: this.points, reto: this.enReto }, estrenarHazanas(this.hazanas.logradas)))
  }
}
